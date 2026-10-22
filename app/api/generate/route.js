import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildPreview, FREE_PREVIEW_LIMIT } from '@/lib/documents/preview';

// Long generations (especially dissertations) can exceed default serverless limits.
// Raise this to match your hosting plan (value is in seconds).
export const maxDuration = 300;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-5-5';
const MAX_TEXT_INPUT_BYTES = 150 * 1024; // 150 KB
const COOLDOWN_SECONDS = 30;

const MASTER_VOICE_PROFILE = `
Rhythm: Use runs of plain declarative sentences of 5 to 12 words set between long accumulating sentences of 30 to 50 words built with coordination and participle tails (providing, easing, reducing). Few mid-length sentences. Never cap sentence length. Write dense paragraphs.
Openers: In personal writing begin sentences with "I" plus a past-tense action verb in runs, or with a role or setting opener ("As Deputy Chief Administrative Officer,", "While working with..."). In reports use an institutional subject (The Committee, The workshop, The study, It was attended by). Frame purpose with "It is against this background that..." where fitting. In letters and reports avoid opening sentences with transition words. In academic writing, Therefore, Consequently, Thus and Additionally are acceptable.
Substance: State the claim, then its outcome in a tail clause, with a number where one exists. Name posts, organisations, years and counts. Write small counts in words (eighteen) and larger counts and percentages in numerals. Write money as UGX [figure]/= ([amount in words]) only. Use the passive voice only for group or institutional procedure.
Register: Formal in every context, including chat messages. No contractions, rhetorical questions, emojis, "very" or "really", and no words like delve, robust, leverage, tapestry or landscape. Use "extremely" or "greatly" when an intensifier is needed. Letters, bios and narratives use commas and periods only, with no semicolons, dashes, colons or parentheses in running prose, and one exclamation mark allowed only on a closing maxim. Reports may use bullet lists of full-sentence items ending in full stops, beginning "That..." for findings and recommendations or "To..." for commitments. Plain colloquial punch words are allowed sparingly ("got scammed", "cash strapped").
Diction I reach for: streamlined, instrumental, synergy, keep abreast, intricate balance, comprehensive, utmost, earnestly, "with a view to", "prompted by", "was in charge of", "I would like to request/invite", kindly, pertaining to, commensurate with, "in the same vein", "as you are aware", "chart a way forward".
Conventions: Capitalise formal posts and bodies. Serial comma in long lists. Spelling follows British conventions if none is stated. Fix typos, hyphenation and grammar silently.
`;

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
      writing_sample,
      uploaded_proposal,
      uploaded_field_data,
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
      .select('tier, proposals_remaining, dissertations_remaining, data_simulations_remaining, free_previews_used')
      .eq('user_id', userId)
      .single();

    if (subErr || !sub) {
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Could not verify user status.' },
        { status: 500 }
      );
    }

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
              message: 'You have used your free previews. Buy a proposal or subscribe to continue.',
            },
            { status: 403 }
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
    let activeVoiceStyle = MASTER_VOICE_PROFILE;
    if (writing_sample && writing_sample.trim().length > 100) {
      activeVoiceStyle = `
        Analyze and clone the structural mechanics, sentence rhythm patterns, and stylistic configurations of this writing sample:
        ---
        ${writing_sample}
        ---
        Apply these exact parameters across all written output narrative elements.
      `;
    }

    // ---------- 6. Build prompts ----------
    let systemPrompt = '';
    let userPrompt = '';
    let docTypeLabel = '';

    if (action_type === 'generate_proposal') {
      docTypeLabel = 'proposal';
      systemPrompt = `
        ROLE: You are an expert Academic Research Consultant and Lead Dissertation Supervisor specializing in International First-Class Master's Degree proposals.
        OPERATIONAL LAWS: Maintain an authoritative, precise, formal academic tone suitable for top-tier universities. Turnaround publication-grade text. Fact-check every citation. Zero hollow placeholders.
        VOICE CONSTRAINTS: You must compose all narrative sections strictly adhering to this voice profile:
        ${activeVoiceStyle}
      `;
      userPrompt = `
        Research Topic: ${research_topic}
        Target Institution: ${target_institution}
        Task: Autonomously write and export a complete, publication-grade Master's Research Proposal and associated Data Collection Tools structured precisely using the mandatory 12-Part Integrated Research Package format.
      `;
    } else if (action_type === 'simulate_data') {
      docTypeLabel = 'field_data';
      systemPrompt = `
        ROLE: You are a Lead Research Methodologist, Senior Qualitative Data Analyst, and Psychometrician specializing in empirical data simulation.
        OPERATIONAL LAWS: Automatically scan the provided research proposal content. Determine the maximum participant categories, sample size breakdowns, and target variables. Generate realistic numerical distributions and illustrative verbatim qualitative responses. Zero placeholders.
      `;
      userPrompt = `
        Approved Research Proposal Input Content:
        ---
        ${uploaded_proposal}
        ---
        Task: Read the text above, extract the methodology rules, and generate a full spectrum of contextually plausible empirical responses (fully generated qualitative verbatim grids and complete quantitative frequency datasets).
      `;
    } else if (action_type === 'compile_dissertation') {
      docTypeLabel = 'dissertation';
      systemPrompt = `
        ROLE: You are a Lead Dissertation Supervisor, Senior Academic Evaluator, and Professor of Postgraduate Research Methodology.
        OPERATIONAL LAWS: Synthesize empirical data and field findings strictly from provided inputs. Ground all text. Maintain an authoritative, formal academic tone. No conversational filler or incomplete chapters.
        VOICE CONSTRAINTS: Write all narrative chapters mimicking this voice:
        ${activeVoiceStyle}
      `;
      userPrompt = `
        Approved Research Proposal Structure:
        ---
        ${uploaded_proposal}
        ---
        Field Notes and Empirical Data Sets:
        ---
        ${uploaded_field_data}
        ---
        Task: Write, structure, and compile a complete, publication-grade Master's Dissertation Report structured into standard 5-to-6 chapter postgraduate layouts including all statistical and narrative analyses.
      `;
    }

    // ---------- 7. Call Claude ----------
    const aiResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // content is an array of blocks, so collect the text blocks
    const finalGeneratedContent = aiResponse.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    if (!finalGeneratedContent) {
      return NextResponse.json(
        { error: 'EMPTY_GENERATION', message: 'The model returned no content. Please try again.' },
        { status: 502 }
      );
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
      const { previewText, previewWords, totalWords, lockedSections } = buildPreview(finalGeneratedContent);

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

    return NextResponse.json({
      success: true,
      locked: false,
      document_id: saved?.id ?? null,
      payload: finalGeneratedContent,
    });
  } catch (error) {
    console.error('Core Application Server Error:', error);
    return NextResponse.json(
      { error: 'SERVER_FAULT', message: 'Processing engine failure.' },
      { status: 500 }
    );
  }
}
