import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildPreview, FREE_PREVIEW_LIMIT } from '@/lib/documents/preview';
import { MASTER_VOICE_PROFILE } from '@/lib/prompts/voiceProfile';
import { normalizeSubscription } from '@/lib/payments/plan';
import { joinClarity } from '@/lib/documents/clarity';
import { logDocumentEvent } from '@/lib/documents/events';
import { buildResearchSystemPrompt, buildResearchUserPrompt } from '@/lib/prompts/researchPlaybook';
import { buildDataSystemPrompt, buildDataUserPrompt } from '@/lib/prompts/dataPlaybook';
import { buildDissertationSystemPrompt, buildDissertationUserPrompt } from '@/lib/prompts/dissertationPlaybook';

// Long generations (especially dissertations) can exceed default serverless limits.
// Raise this to match your hosting plan (value is in seconds).
export const maxDuration = 300;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-5-5';
const MAX_TEXT_INPUT_BYTES = 150 * 1024; // 150 KB
const COOLDOWN_SECONDS = 30;


const VALID_ACTIONS = ['generate_proposal', 'simulate_data', 'compile_dissertation'];

// Pulls the finished document out of the model's reply.
// Anything the model wrote outside <final_document> tags (research notes, planning) is discarded.
function extractDocument(text) {
  const OPEN = '<final_document>';
  const CLOSE = '</final_document>';
  const open = text.indexOf(OPEN);
  if (open === -1) return text.trim();
  const start = open + OPEN.length;
  const close = text.indexOf(CLOSE, start);
  return (close === -1 ? text.slice(start) : text.slice(start, close)).trim();
}

// How many web searches a document may use. Change it in Vercel with PROPOSAL_SEARCH_LIMIT or
// DISSERTATION_SEARCH_LIMIT: more searches give a wider literature review but cost more and take longer.
function searchBudget(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 3 && value <= 30 ? Math.floor(value) : fallback;
}

// Pulls the optional clarity note out of the model's reply.
function extractClarityNote(text) {
  const OPEN = '<clarity_note>';
  const CLOSE = '</clarity_note>';
  const open = text.indexOf(OPEN);
  if (open === -1) return '';
  const start = open + OPEN.length;
  const close = text.indexOf(CLOSE, start);
  return (close === -1 ? text.slice(start) : text.slice(start, close)).trim();
}

// Calls Claude. When searchLimit > 0 the model gets the web search tool, so it can find and
// confirm real sources. If web search is not available we stop instead of letting the model
// write references from memory.
async function runClaude({ systemPrompt, userPrompt, maxTokens, searchLimit }) {
  const messages = [{ role: 'user', content: userPrompt }];
  const tools =
    searchLimit > 0
      ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: searchLimit }]
      : undefined;

  const texts = [];
  const turns = []; // a short record of each round, for the logs
  let last = null;

  for (let turn = 0; turn < 8; turn++) {
    let response;
    try {
      response = await anthropic.messages
        .stream({
          model: MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
          ...(tools ? { tools } : {}),
        })
        .finalMessage();
    } catch (err) {
      const mentionsSearch = /web.?search|tool/i.test(String(err?.message || ''));
      if (tools && mentionsSearch && [400, 403].includes(err?.status)) {
        console.error('Web search unavailable:', err.message);
        throw Object.assign(new Error('WEB_SEARCH_UNAVAILABLE'), { code: 'WEB_SEARCH_UNAVAILABLE' });
      }
      throw err;
    }

    last = response;
    turns.push({
      stop_reason: response.stop_reason,
      blocks: (response.content || []).map((block) => block.type),
      output_tokens: response.usage?.output_tokens,
    });
    for (const block of response.content || []) {
      if (block.type === 'text') texts.push(block.text);
    }

    // Long research turns can pause; send the work so far back to carry on.
    if (response.stop_reason !== 'pause_turn') break;
    if ((response.usage?.input_tokens || 0) > 150000) {
      console.warn('Research conversation is too large to continue safely, stopping.', JSON.stringify(response.usage));
      break;
    }
    messages.push({
      role: 'assistant',
      content: (response.content || []).filter(
        (block) => block.type !== 'text' || String(block.text || '').trim()
      ),
    });
  }

  return {
    text: texts.join('\n'),
    stopReason: last?.stop_reason,
    usage: last?.usage,
    blockTypes: (last?.content || []).map((block) => block.type),
    turns,
  };
}

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
          message: `Your input is too large. Please keep the total under ${Math.round(MAX_TEXT_INPUT_BYTES / 1024)} KB.`,
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

    // ---------- 4b. Cooldown between requests ----------
    const { data: lastDoc, error: lastDocErr } = await supabase
      .from('documents')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastDocErr) {
      console.error('Cooldown check error:', lastDocErr);
    } else if (lastDoc?.created_at) {
      const secondsSince = (Date.now() - new Date(lastDoc.created_at).getTime()) / 1000;
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

    // ---------- 5. Voice style ----------
    // The project background is context for the task, and also a light guide to how the user writes.
    const projectBackground = String(project_background ?? writing_sample ?? '').trim().slice(0, 4000);

    let activeVoiceStyle = MASTER_VOICE_PROFILE;
    if (projectBackground.length > 100) {
      activeVoiceStyle = `${MASTER_VOICE_PROFILE}
The user's project background is supplied separately. It also shows how the user writes. Take gentle cues from it, such as terminology and regional spelling, but keep the formal academic register and every rule above.`;
    }

    // ---------- Cover page details (from the customer's profile) ----------
    const meta = user?.user_metadata || {};
    const cover = meta.cover || {};
    const coverDetails = {
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
    };

    // ---------- 6. Build prompts from the three playbooks ----------
    let systemPrompt = '';
    let userPrompt = '';
    let docTypeLabel = '';
    let maxTokens = 16000;
    let searchLimit = 0; // 0 = no web search; above 0 = the model may search to verify sources

    if (action_type === 'generate_proposal') {
      docTypeLabel = 'proposal';
      systemPrompt = buildResearchSystemPrompt(activeVoiceStyle);
      userPrompt = buildResearchUserPrompt({
        researchTopic: research_topic,
        targetInstitution: target_institution,
        sourceMaterial: source_material,
        projectBackground,
        coverDetails,
      });
      maxTokens = 24000;
      searchLimit = searchBudget('PROPOSAL_SEARCH_LIMIT', 14);
    } else if (action_type === 'simulate_data') {
      docTypeLabel = 'field_data';
      systemPrompt = buildDataSystemPrompt();
      userPrompt = buildDataUserPrompt({
        approvedProposal: uploaded_proposal,
        additionalContext: [research_topic, target_institution, projectBackground].filter(Boolean).join('\n\n'),
      });
      maxTokens = 32000;
      searchLimit = 0;
    } else if (action_type === 'compile_dissertation') {
      docTypeLabel = 'dissertation';
      systemPrompt = buildDissertationSystemPrompt(activeVoiceStyle);
      userPrompt = buildDissertationUserPrompt({
        approvedProposal: uploaded_proposal,
        fieldData: uploaded_field_data,
        transcripts: uploaded_transcripts,
        projectBackground,
        coverDetails,
        targetInstitution: target_institution,
      });
      maxTokens = 32000;
      searchLimit = searchBudget('DISSERTATION_SEARCH_LIMIT', 20);
    }

    // ---------- 7. Call Claude ----------
    const ai = await runClaude({ systemPrompt, userPrompt, maxTokens, searchLimit });
    const mainDocument = extractDocument(ai.text);
    const clarityNote = projectBackground && docTypeLabel !== 'field_data' ? extractClarityNote(ai.text) : '';
    const finalGeneratedContent = joinClarity(mainDocument, clarityNote);

    if (!mainDocument) {
      // Record WHY it was empty so it can be read in the Vercel logs.
      console.error(
        'Empty generation:',
        JSON.stringify({
          stop_reason: ai.stopReason,
          block_types: ai.blockTypes,
          turns: ai.turns,
          usage: ai.usage,
          action_type,
        })
      );
      const declined = ai.stopReason === 'refusal';
      return NextResponse.json(
        {
          error: 'EMPTY_GENERATION',
          message: declined
            ? 'The request could not be completed. Please rephrase your research topic and try again.'
            : 'The model returned no content. Please try again.',
        },
        { status: 502 }
      );
    }

    if (ai.stopReason === 'max_tokens') {
      console.warn('Generation hit the length limit and may be cut short:', JSON.stringify(ai.usage));
    }

    // ---------- 8. Save the document ----------
    const admin = createAdminClient();
    const baseRow = {
      user_id: userId,
      document_type: docTypeLabel,
      research_topic: research_topic || 'Extracted from Document Input',
      target_institution: target_institution || 'Extracted Guidelines',
    };

    // ----- Free preview: the user sees a few pages, the full text stays on the server -----
    if (previewMode) {
      const { previewText, previewWords, totalWords, lockedSections } = buildPreview(mainDocument);

      // The saved document only holds the preview while it is locked.
      const { data: savedPreview, error: previewSaveErr } = await supabase
        .from('documents')
        .insert({ ...baseRow, generated_content: previewText, is_unlocked: false })
        .select('id')
        .single();

      if (previewSaveErr || !savedPreview) {
        console.error('Preview save error:', previewSaveErr);
        return NextResponse.json(
          { error: 'DATABASE_ERROR', message: 'Your preview was generated but could not be saved.' },
          { status: 500 }
        );
      }

      // The full text goes in a table users cannot read directly.
      const { error: secretErr } = await admin
        .from('document_secrets')
        .insert({ document_id: String(savedPreview.id), content: finalGeneratedContent });

      if (secretErr) {
        console.error('Locked content save error:', secretErr);
        await admin.from('documents').delete().eq('id', savedPreview.id);
        return NextResponse.json(
          { error: 'DATABASE_ERROR', message: 'Your preview could not be saved. Please try again.' },
          { status: 500 }
        );
      }

      const previewsUsed = (sub.free_previews_used ?? 0) + 1;
      const { error: usedErr } = await admin
        .from('subscriptions')
        .update({ free_previews_used: previewsUsed })
        .eq('user_id', userId);
      if (usedErr) console.error('Preview counter error:', usedErr);

      return NextResponse.json({
        success: true,
        locked: true,
        document_id: savedPreview.id,
        preview: previewText,
        preview_words: previewWords,
        total_words: totalWords,
        locked_sections: lockedSections,
        free_previews_remaining: Math.max(0, FREE_PREVIEW_LIMIT - previewsUsed),
      });
    }

    // ----- Normal generation: full document, credit spent -----
    const { data: saved, error: insertErr } = await supabase
      .from('documents')
      .insert({ ...baseRow, generated_content: finalGeneratedContent, is_unlocked: true })
      .select('id')
      .single();

    if (insertErr) {
      console.error('Document save error:', insertErr);
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Content was generated but could not be saved.' },
        { status: 500 }
      );
    }

    // ---------- 9. Decrement usage credits (service role, so users cannot edit their own balances) ----------
    let creditUpdate = null;
    if (action_type === 'generate_proposal' && !isEnterprise && sub.proposals_remaining > 0) {
      creditUpdate = { proposals_remaining: sub.proposals_remaining - 1 };
    } else if (action_type === 'compile_dissertation' && !isEnterprise && sub.dissertations_remaining > 0) {
      creditUpdate = { dissertations_remaining: sub.dissertations_remaining - 1 };
    } else if (action_type === 'simulate_data' && !hasDataTier && sub.data_simulations_remaining > 0) {
      creditUpdate = { data_simulations_remaining: sub.data_simulations_remaining - 1 };
    }

    if (creditUpdate) {
      const { error: creditErr } = await admin
        .from('subscriptions')
        .update(creditUpdate)
        .eq('user_id', userId);

      if (creditErr) {
        // Do not fail the request after a successful generation, but log it.
        console.error('Credit decrement error:', creditErr);
      }
    }

    if (saved?.id) await logDocumentEvent(admin, saved.id, userId, 'generated');

    return NextResponse.json({
      success: true,
      locked: false,
      document_id: saved?.id ?? null,
      payload: finalGeneratedContent,
    });
  } catch (error) {
    console.error(
      'AI request error:',
      JSON.stringify({
        status: error?.status,
        type: error?.error?.error?.type,
        message: error?.error?.error?.message || error?.message,
        request_id: error?.request_id,
      })
    );
    console.error('Core Application Server Error:', error);
    if (error?.code === 'WEB_SEARCH_UNAVAILABLE') {
      return NextResponse.json(
        {
          error: 'RESEARCH_UNAVAILABLE',
          message: 'Source verification is temporarily unavailable, so nothing was generated and you have not been charged. Please try again shortly.',
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'SERVER_FAULT', message: 'Processing engine failure.' },
      { status: 500 }
    );
  }
}
