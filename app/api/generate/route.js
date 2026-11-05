import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FREE_PREVIEW_LIMIT } from '@/lib/documents/preview';
import { normalizeSubscription } from '@/lib/payments/plan';
import { stagesFor } from '@/lib/generation/stages';
import { kickJob, ACTIVE_STATUSES } from '@/lib/generation/runner';
import { planningWork } from '@/lib/tools/projectText';

// This route only checks the request and starts a background job, so it answers in seconds.
// The writing itself happens in /api/jobs/run, one stage at a time.
export const maxDuration = 60;

// About 100,000 words in all: room for a full proposal with appendices plus field data and transcripts,
// while every writing stage still fits comfortably in the model's context.
const MAX_TEXT_INPUT_BYTES = 400 * 1024; // 400 KB
const COOLDOWN_SECONDS = 30;

const VALID_ACTIONS = ['generate_proposal', 'simulate_data', 'compile_dissertation'];

export async function POST(request) {
  // ---------- 1. Authenticate (getUser validates the token with Supabase Auth) ----------
  let supabase;
  let user;
  try {
    supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();

    if (authError || !data?.user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }
    user = data.user;
  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json(
      { error: 'AUTH_FAULT', message: 'Could not verify your session.' },
      { status: 500 }
    );
  }
  const userId = user.id;

  try {
    // ---------- 2. Parse and validate the request ----------
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_TEXT_INPUT_BYTES) {
      return NextResponse.json(
        {
          error: 'PAYLOAD_TOO_LARGE',
          message: `Your text is above the ${Math.round(MAX_TEXT_INPUT_BYTES / 1024)} KB limit. Remove what the writing does not need, such as blank forms in the appendices or raw data columns you will not analyse, and try again.`,
        },
        { status: 413 }
      );
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Request body must be valid JSON.' },
        { status: 400 }
      );
    }

    const {
      action_type,
      research_topic,
      target_institution,
      writing_sample, // older name for project_background, still accepted
      project_background,
      uploaded_proposal,
      uploaded_field_data,
      why_you, // optional: the researcher's own experience and motivation, for "Why Me"
      why_now, // optional: the researcher's view of why the study is timely, for "Why Now"
      source_material, // optional: extra papers or notes for a proposal
      uploaded_transcripts, // optional: interview transcripts for a dissertation
    } = body;

    if (!VALID_ACTIONS.includes(action_type)) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: `action_type must be one of: ${VALID_ACTIONS.join(', ')}.` },
        { status: 400 }
      );
    }

    if (action_type === 'generate_proposal' && !research_topic?.trim()) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'research_topic is required for generate_proposal.' },
        { status: 400 }
      );
    }

    if (
      (action_type === 'simulate_data' || action_type === 'compile_dissertation') &&
      !uploaded_proposal?.trim()
    ) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'uploaded_proposal is required for this action.' },
        { status: 400 }
      );
    }

    if (action_type === 'compile_dissertation' && !uploaded_field_data?.trim()) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'uploaded_field_data is required for compile_dissertation.' },
        { status: 400 }
      );
    }

    // ---------- 3. Load subscription (RLS scopes this to the signed-in user) ----------
    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .select('tier, proposals_remaining, dissertations_remaining, data_simulations_remaining, free_previews_used, plan_expires_at')
      .eq('user_id', userId)
      .single();

    if (subErr || !sub) {
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Could not verify user status.' },
        { status: 500 }
      );
    }

    // A paid plan whose period has run out counts as free.
    Object.assign(sub, normalizeSubscription(sub));

    // ---------- 4. Paywall checks ----------
    const isEnterprise = sub.tier === 'consultant_enterprise';
    const hasDataTier = sub.tier === 'data_suite' || isEnterprise;

    // Proposals: with no credits left, a user gets a limited number of free PREVIEWS
    // (a few pages shown, the rest locked until they unlock it).
    let previewMode = false;
    if (action_type === 'generate_proposal') {
      if (!isEnterprise && sub.proposals_remaining <= 0) {
        if ((sub.free_previews_used ?? 0) >= FREE_PREVIEW_LIMIT) {
          return NextResponse.json(
            {
              error: 'PAYWALL_TRIGGERED',
              target: 'tier_1',
              message: 'You have used your free preview. Buy a proposal or subscribe to continue.',
            },
            { status: 403 }
          );
        }
        // Daily safety cap on free previews across all accounts, to protect the AI budget.
        const dailyCap = Number(process.env.FREE_PREVIEW_DAILY_CAP || 30);
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const { count: previewsToday } = await createAdminClient()
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('is_unlocked', false)
          .gte('created_at', startOfDay.toISOString());
        if ((previewsToday ?? 0) >= dailyCap) {
          return NextResponse.json(
            {
              error: 'PREVIEW_LIMIT_REACHED',
              message: 'Free previews are fully booked for today. Please try again tomorrow, or buy a proposal to continue.',
            },
            { status: 429 }
          );
        }
        previewMode = true;
      }
    } else if (action_type === 'simulate_data') {
      if (!hasDataTier && !(sub.data_simulations_remaining > 0)) {
        return NextResponse.json({ error: 'PAYWALL_TRIGGERED', target: 'tier_2_data' }, { status: 403 });
      }
    } else if (action_type === 'compile_dissertation') {
      if (!isEnterprise && sub.dissertations_remaining <= 0) {
        return NextResponse.json({ error: 'PAYWALL_TRIGGERED', target: 'tier_3_dissertation' }, { status: 403 });
      }
    }

    // ---------- 5. One document at a time, and a short pause between requests ----------
    const admin = createAdminClient();
    const { data: activeJob } = await admin
      .from('generation_jobs')
      .select('id, created_at')
      .eq('user_id', userId)
      .in('status', ACTIVE_STATUSES)
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeJob) {
      return NextResponse.json(
        {
          error: 'JOB_IN_PROGRESS',
          message: 'A document is already being written for you. Please wait for it to finish.',
          job_id: activeJob.id,
        },
        { status: 409 }
      );
    }

    const { data: lastJob } = await admin
      .from('generation_jobs')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastJob?.created_at) {
      const secondsSince = (Date.now() - new Date(lastJob.created_at).getTime()) / 1000;
      if (secondsSince < COOLDOWN_SECONDS) {
        const retryAfter = Math.ceil(COOLDOWN_SECONDS - secondsSince);
        return NextResponse.json(
          {
            error: 'RATE_LIMITED',
            message: `Please wait ${retryAfter} seconds before requesting another document.`,
            retry_after: retryAfter,
          },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
      }
    }

    // ---------- 6. Save the inputs and start the background job ----------
    const meta = user?.user_metadata || {};
    const cover = meta.cover || {};
    const clip = (value, max) => String(value ?? '').trim().slice(0, max);

    const input = {
      research_topic: clip(research_topic, 2000),
      target_institution: clip(target_institution, 4000),
      project_background: clip(project_background ?? writing_sample, 4000),
      why_you: clip(why_you, 2000),
      why_now: clip(why_now, 2000),
      source_material: clip(source_material, 60000),
      uploaded_proposal: String(uploaded_proposal ?? ''),
      uploaded_field_data: String(uploaded_field_data ?? ''),
      uploaded_transcripts: String(uploaded_transcripts ?? ''),
      cover: {
        prepared_by: meta.full_name || '',
        position: cover.position || '',
        organisation: cover.affiliation || '',
        registration_number: cover.registration_number || '',
        programme: cover.programme || '',
        supervisors: cover.supervisors || '',
        date: new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'Africa/Kampala',
        }),
      },
    };

    // A project from the planning tools: its title, objectives and methodology go into the proposal.
    const projectId = /^[0-9a-f-]{36}$/i.test(String(body.project_id || '')) ? body.project_id : null;
    if (projectId) {
      const work = await planningWork(supabase, userId, projectId);
      if (work) {
        input.project_id = work.project.id;
        if (action_type === 'generate_proposal') input.planning_work = work.text;
      }
    }

    const stages = stagesFor(action_type);
    const { data: job, error: jobErr } = await admin
      .from('generation_jobs')
      .insert({
        user_id: userId,
        action_type,
        preview_mode: previewMode,
        stage_index: 0,
        stage_count: stages.length,
        stage_label: stages[0].label,
        input,
      })
      .select('id, status, stage_index, stage_count, stage_label')
      .single();

    if (jobErr || !job) {
      console.error('Job create error:', jobErr);
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Could not start your document. Please try again.' },
        { status: 500 }
      );
    }

    const origin = new URL(request.url).origin;
    after(() => kickJob(origin, job.id));

    return NextResponse.json(
      {
        success: true,
        job_id: job.id,
        status: job.status,
        stage_index: job.stage_index,
        stage_count: job.stage_count,
        stage_label: job.stage_label,
        preview_mode: previewMode,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Generate route error:', error);
    return NextResponse.json(
      { error: 'SERVER_FAULT', message: 'Could not start your document. Please try again.' },
      { status: 500 }
    );
  }
}
