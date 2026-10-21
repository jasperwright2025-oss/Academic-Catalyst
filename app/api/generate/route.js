import { createClient } from '../../../lib/supabase/server';
import { createClient as createServiceRoleClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const maxDuration = 300; 

// --- SECURITY AND CONSTANT BALANCING BOUNDS ---
const MODEL_TAG = 'claude-sonnet-5-5';
const MAX_TEXT_INPUT_BYTES = 150 * 1024; // 150 KB Safer max size (~22,000 words maximum per transaction)
const COOLDOWN_WINDOW_SECONDS = 30;     // Forces an explicit 30-second wait between button clicks

const MASTER_VOICE_PROFILE = `
Rhythm: Use runs of plain declarative sentences of 5 to 12 words set between long accumulating sentences of 30 to 50 words built with coordination and participle tails (providing, easing, reducing). Few mid-length sentences. Never cap sentence length. Write dense paragraphs.
Openers: In personal writing begin sentences with "I" plus a past-tense action verb in runs, or with a role or setting opener ("As Deputy Chief Administrative Officer,", "While working with..."). In reports use an institutional subject (The Committee, The workshop, The study, It was attended by). Frame purpose with "It is against this background that..." where fitting. In letters and reports avoid opening sentences with transition words. In academic writing, Therefore, Consequently, Thus and Additionally are acceptable.
Substance: State the claim, then its outcome in a tail clause, with a number where one exists. Name posts, organisations, years and counts. Write small counts in words (eighteen) and larger counts and percentages in numerals. Write money as UGX [figure]/= ([amount in words]) only. Use the passive voice only for group or institutional procedure.
Register: Formal in every context, including chat messages. No contractions, rhetorical questions, emojis, "very" or "really", and no words like delve, robust, leverage, tapestry or landscape. Use "extremely" or "greatly" when an intensifier is needed. Letters, bios and narratives use commas and periods only, with no semicolons, dashes, colons or parentheses in running prose, and one exclamation mark allowed only on a closing maxim. Reports may use bullet lists of full-sentence items ending in full stops, beginning "That..." for findings and recommendations or "To..." for commitments. Plain colloquial punch words are allowed sparingly ("got scammed", "cash strapped").
Diction I reach for: streamlined, instrumental, synergy, keep abreast, intricate balance, comprehensive, utmost, earnestly, "with a view to", "prompted by", "was in charge of", "I would like to request/invite", kindly, pertaining to, commensurate with, "in the same vein", "as you are aware", "chart a way forward".
Conventions: Capitalise formal posts and bodies. Serial comma in long lists. Spelling follows British conventions if none is stated. Fix typos, hyphenation and grammar silently.
`;

export async function POST(request) {
  const supabase = await createClient();
  
  // 1. SECURE USER AUTHENTICATION CHECK
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Valid login required.' }, { status: 401 });
  }
  const userId = user.id;

  try {
    // SECURITY CHECK A: Measure absolute raw payload size to protect server resources
    const rawTextData = await request.text();
    if (Buffer.byteLength(rawTextData, 'utf8') > MAX_TEXT_INPUT_BYTES) {
      return NextResponse.json({ 
        error: 'PAYLOAD_TOO_LARGE', 
        message: 'File upload exceeds security bounds (150KB maximum). Compress your text inputs.' 
      }, { status: 413 });
    }

    // Safely parse body after size clearance validation passes
    const body = JSON.parse(rawTextData);
    const { 
      action_type,          
      research_topic,       
      target_institution,   
      writing_sample,       
      uploaded_proposal,    
      uploaded_field_data   
    } = body;

    if (!action_type) {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'Missing field: action_type is mandatory.' }, { status: 400 });
    }

    // SECURITY CHECK B: Rate Limiting Cooldown Check via Database History Logs
    const thirtySecondsAgo = new Date(Date.now() - COOLDOWN_WINDOW_SECONDS * 1000).toISOString();
    const { data: recentDocs, error: rateError } = await supabase
      .from('documents')
      .select('created_at')
      .eq('user_id', userId)
      .gt('created_at', thirtySecondsAgo)
      .limit(1);

    if (rateError) {
      return NextResponse.json({ error: 'SERVER_FAULT', message: 'Rate calculation fault.' }, { status: 500 });
    }

    if (recentDocs && recentDocs.length > 0) {
      return NextResponse.json({ 
        error: 'RATE_LIMIT_EXCEEDED', 
        message: `Please wait ${COOLDOWN_WINDOW_SECONDS} seconds between compilation requests to protect system balance.` 
      }, { status: 429 });
    }

    // 2. FETCH SUBSCRIPTION CONDITIONS
    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .select('tier, proposals_remaining, dissertations_remaining')
      .eq('user_id', userId)
      .single();

    if (subErr || !sub) {
      return NextResponse.json({ error: 'DATABASE_ERROR', message: 'Could not resolve licensing profiles.' }, { status: 500 });
    }

    // 3. ENFORCE REVENUE TIERS AND ACCESS BLOCKS
    if (action_type === 'generate_proposal') {
      if (sub.tier === 'free' && sub.proposals_remaining <= 0) {
        return NextResponse.json({ error: 'PAYWALL_TRIGGERED', target: 'tier_1' }, { status: 403 });
      }
    } else if (action_type === 'simulate_data') {
      if (sub.tier !== 'data_suite' && sub.tier !== 'consultant_enterprise') {
        return NextResponse.json({ error: 'PAYWALL_TRIGGERED', target: 'tier_2_data' }, { status: 403 });
      }
    } else if (action_type === 'compile_dissertation') {
      if (sub.tier !== 'consultant_enterprise' && sub.dissertations_remaining <= 0) {
        return NextResponse.json({ error: 'PAYWALL_TRIGGERED', target: 'tier_3_dissertation' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'Invalid engine instruction context.' }, { status: 400 });
    }

    // 4. PREPARE STYLISTIC DICTION CONSTRAINTS
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

    // 5. ASSEMBLE SYSTEM PROMPTS AND DEPLOY THE PROPRIETARY PLAYBOOKS
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
        NOTICE: Explicitly label output structures as generated empirical research indicators.
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
