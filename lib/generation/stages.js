// Splits each document into stages that each fit inside one short server request.
// Stage 1 (proposals and dissertations) researches and verifies sources; the later stages write
// the document part by part from those verified notes.
import { MASTER_VOICE_PROFILE } from "@/lib/prompts/voiceProfile";
import { buildResearchSystemPrompt, buildResearchUserPrompt } from "@/lib/prompts/researchPlaybook";
import { buildDataSystemPrompt, buildDataUserPrompt } from "@/lib/prompts/dataPlaybook";
import { buildDissertationSystemPrompt, buildDissertationUserPrompt } from "@/lib/prompts/dissertationPlaybook";

function budget(name, fallback, min = 0, max = 30) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= min && value <= max ? Math.floor(value) : fallback;
}

const PROPOSAL_STAGES = () => [
  {
    key: "research",
    kind: "research",
    label: "Researching and verifying sources",
    searchLimit: budget("PROPOSAL_SEARCH_LIMIT", 12, 3),
    maxTokens: 32000,
    task: `Carry out PHASE 1 (web research and guideline extraction) and PHASE 2 (internal structuring) only, including the trial run of the QUALITY GATE. Aim for at least 30 verified sources across strands A to E.`,
  },
  {
    key: "introduction",
    kind: "write",
    label: "Writing the cover page, abstract and introduction",
    maxTokens: 28000,
    task: `Write the Cover Page, the Table of Contents (list every section of the WHOLE proposal, including the sections that later stages will write: Literature Review & Theoretical Framework, Research Methodology & Design, Ethical Considerations & Risk Mitigation, Project Timeline & Feasibility, References and Appendices A to C), the Title & Abstract, and the complete Introduction & Background section, including the clearly headed "Why Me, Why Now, Why Them" passage.`,
  },
  {
    key: "literature",
    kind: "write",
    label: "Writing the literature review",
    maxTokens: 28000,
    searchLimit: budget("PROPOSAL_WRITING_SEARCH_LIMIT", 0, 0, 5),
    task: `Write the complete Literature Review & Theoretical Framework section, organised into at least five thematic strands that follow strands A to E in the research notes, ending with the literature gap and the theoretical framing of the study.`,
  },
  {
    key: "methodology",
    kind: "write",
    label: "Writing the methodology, ethics and timeline",
    maxTokens: 28000,
    task: `Write the complete Research Methodology & Design section, the Ethical Considerations & Risk Mitigation section and the Project Timeline & Feasibility section (with the timeline as a Markdown table).`,
  },
  {
    key: "closing",
    kind: "write",
    label: "Compiling references and appendices",
    maxTokens: 28000,
    clarity: true,
    verification: true,
    task: `Write the References section (every source cited anywhere in the document so far, and only those, in the required citation style), and Appendices A to C in full and ready for field use.`,
  },
];

const DISSERTATION_STAGES = () => [
  {
    key: "research",
    kind: "research",
    label: "Reading your data and verifying sources",
    searchLimit: budget("DISSERTATION_SEARCH_LIMIT", 12, 3),
    maxTokens: 32000,
    task: `Carry out PHASE 1 (data ingestion, audit and guideline alignment) and PHASE 2 (internal structuring and analytical reasoning) only. Use web_search to confirm the institution's guidelines and to verify the literature the dissertation will cite. In the notes, also record the key quantitative indicators and qualitative themes extracted from the supplied data, mapped to each objective, with exact figures and participant tags.`,
  },
  {
    key: "preliminaries",
    kind: "write",
    label: "Writing the preliminary pages and Chapter 1",
    maxTokens: 28000,
    task: `Write the Preliminary Pages (Title Page, Declaration, Approval and Dedication pages, the structured Abstract, the Table of Contents listing every chapter and section of the WHOLE dissertation, the List of Tables, the List of Figures and the List of Acronyms) and Chapter 1: Introduction in full.`,
  },
  {
    key: "chapter2",
    kind: "write",
    label: "Writing Chapter 2: Literature Review",
    maxTokens: 28000,
    task: `Write Chapter 2: Literature Review in full.`,
  },
  {
    key: "chapter3",
    kind: "write",
    label: "Writing Chapter 3: Methodology",
    maxTokens: 28000,
    task: `Write Chapter 3: Research Methodology in full.`,
  },
  {
    key: "chapter4",
    kind: "write",
    label: "Writing Chapter 4: Findings",
    maxTokens: 28000,
    task: `Write Chapter 4: Data Presentation, Analysis & Findings in full, using only the supplied data.`,
  },
  {
    key: "chapter5_6",
    kind: "write",
    label: "Writing Chapters 5 and 6",
    maxTokens: 28000,
    task: `Write Chapter 5: Discussion, Synthesis & Implications and Chapter 6: Summary, Conclusions & Recommendations in full.`,
  },
  {
    key: "closing",
    kind: "write",
    label: "Compiling references and appendices",
    maxTokens: 28000,
    clarity: true,
    verification: true,
    task: `Write the References section (every source cited anywhere in the dissertation so far, and only those, in the required citation style), and Appendices A to D in full.`,
  },
];

const DATA_STAGES = () => [
  {
    key: "parts1_4",
    kind: "write",
    label: "Mapping the proposal (Parts 1 to 4)",
    maxTokens: 28000,
    task: `Write PART 1 to PART 4 of the 12-part package in full. PART 1 opens with the mandatory disclaimer.`,
  },
  {
    key: "parts5_6",
    kind: "write",
    label: "Simulating responses (Parts 5 and 6)",
    maxTokens: 28000,
    task: `Write PART 5 and PART 6 of the 12-part package in full.`,
  },
  {
    key: "parts7_9",
    kind: "write",
    label: "Coding and triangulation (Parts 7 to 9)",
    maxTokens: 28000,
    task: `Write PART 7, PART 8 and PART 9 of the 12-part package in full.`,
  },
  {
    key: "parts10_12",
    kind: "write",
    label: "Quality checks and evidence index (Parts 10 to 12)",
    maxTokens: 28000,
    task: `Write PART 10, PART 11 and PART 12 of the 12-part package in full. PART 12 ends with the mandatory disclaimer.`,
  },
];

export function stagesFor(actionType) {
  if (actionType === "generate_proposal") return PROPOSAL_STAGES();
  if (actionType === "compile_dissertation") return DISSERTATION_STAGES();
  if (actionType === "simulate_data") return DATA_STAGES();
  return [];
}

export const DOC_TYPE = {
  generate_proposal: "proposal",
  simulate_data: "field_data",
  compile_dissertation: "dissertation",
};

// The voice profile always governs the writing. What the customer supplies is context.
function voiceFor(input) {
  if (String(input.project_background || "").length > 100) {
    return `${MASTER_VOICE_PROFILE}
The customer's project background is supplied separately as context for the document. You may follow its regional spelling and subject terminology, but the voice profile above governs the writing.`;
  }
  return MASTER_VOICE_PROFILE;
}

// The playbook prompts, unchanged, built from the job's saved inputs.
export function basePrompts(actionType, input) {
  if (actionType === "generate_proposal") {
    return {
      system: buildResearchSystemPrompt(voiceFor(input)),
      user: buildResearchUserPrompt({
        researchTopic: input.research_topic,
        targetInstitution: input.target_institution,
        sourceMaterial: input.source_material,
        projectBackground: input.project_background,
        whyYou: input.why_you,
        whyNow: input.why_now,
        coverDetails: input.cover,
        planningWork: input.planning_work,
      }),
    };
  }
  if (actionType === "compile_dissertation") {
    return {
      system: buildDissertationSystemPrompt(voiceFor(input)),
      user: buildDissertationUserPrompt({
        approvedProposal: input.uploaded_proposal,
        fieldData: input.uploaded_field_data,
        transcripts: input.uploaded_transcripts,
        projectBackground: input.project_background,
        coverDetails: input.cover,
        targetInstitution: input.target_institution,
      }),
    };
  }
  return {
    system: buildDataSystemPrompt(),
    user: buildDataUserPrompt({
      approvedProposal: input.uploaded_proposal,
      additionalContext: [input.research_topic, input.target_institution, input.project_background]
        .filter(Boolean)
        .join("\n\n"),
    }),
  };
}

const safe = (text) => String(text || "").replaceAll("</", "<\\/");

// Keeps the "document so far" within a sensible size; the earliest text matters least for continuity
// once the table of contents and the latest sections are visible.
function documentSoFar(text, maxChars = 90000) {
  const value = String(text || "");
  if (value.length <= maxChars) return value;
  const head = value.slice(0, 15000);
  const tail = value.slice(-(maxChars - 15000));
  return `${head}\n\n[... earlier sections omitted here for length; they are already written ...]\n\n${tail}`;
}

// The extra instructions for one stage, added after the playbook's own user prompt.
export function stagePrompt({ stage, stageNumber, stageCount, job, hasBackground }) {
  const header = `
=== STAGED GENERATION: STAGE ${stageNumber} OF ${stageCount} ===
This document is produced in stages, each in a separate request. The instructions in this block override any instruction above to deliver the complete document in a single reply, and any instruction to place the deliverable in final_document tags. Every other rule in the playbook, the citation rules and the voice profile still applies in full.`;

  if (stage.kind === "research") {
    const continuing = job.continuation && job.research_notes
      ? `\nYour earlier research request was cut off. The notes gathered so far are below. Continue from where they stop, without repeating them, and complete every part of the notes.\n<notes_so_far>\n${safe(job.research_notes)}\n</notes_so_far>\n`
      : "";
    return `${header}

THIS STAGE: ${stage.task}
Do not write any part of the document itself in this stage. Instead, write complete research notes inside <research_notes> and </research_notes> tags. The later writing stages will rely on these notes and will have little or no web search, so make them complete and exact:
1. Guidelines: the institution's requirements you found (structure, length, citation style, formatting), or the fallback you will apply.
1b. Length budget: the word or page limit found (with its source) or the default from the LENGTH BUDGET rules, converted to words for the main body, and the number of words allocated to each main section of the whole document.
2. Verified sources: one entry per source, each with the full reference in the required citation style exactly as confirmed (include a DOI or URL only if you saw it in a search result), the strand it belongs to, and one or two sentences on the finding or argument it will support.
3. Coverage map: where the strands agree, where they clash, and the gap each leaves.
4. Draft aim, objectives and research questions (or, for a dissertation, the objectives restated from the proposal with the data mapped to each), and the planned heading structure for the whole document.
5. Argument map: for each research question or objective, the main claim, the evidence, the strongest counter-argument and the limit of the evidence.
6. Quality gate trial: one line per check, beginning with "Yes" or "No", with what will be done about any "No".
Keep everything outside the tags to a minimum.${continuing}`;
  }

  const notes = job.research_notes
    ? `\n<research_notes>\n${safe(job.research_notes)}\n</research_notes>\nCite only sources listed in these research notes${
        stage.searchLimit ? " or newly verified with web_search in this stage" : ""
      }, and copy their bibliographic details exactly.`
    : "";

  const soFar = job.document_text
    ? `\n<document_so_far>\n${safe(documentSoFar(job.document_text))}\n</document_so_far>`
    : "\nNothing has been written yet: this stage begins the document.";

  const continuing = job.continuation
    ? `\nIMPORTANT: your previous reply for this stage was cut off before it finished. The document so far ends at the point where it stopped, possibly mid-sentence. Continue from exactly that point, without repeating any text and without restarting the section heading, and then complete the rest of THIS STAGE.`
    : "";

  const clarity =
    stage.clarity && hasBackground
      ? `\nAfter the closing </section_text> tag, write the clarity note for the WHOLE document (as described in the CLARITY NOTE rules) inside <clarity_note> and </clarity_note> tags.`
      : "";
  const verification = stage.verification
    ? `\nAfter the closing </section_text> tag, write the reference check note (citation rule 8) inside <verification_note> and </verification_note> tags. It is for the customer only and must not appear inside the document.`
    : "";

  return `${header}
${notes}
${soFar}

THIS STAGE: ${stage.task}
Write only this stage's part of the document, inside <section_text> and </section_text> tags. Heading levels: a single # heading is used once, for the document title on the cover page; every chapter or main part (for example Abstract, Chapter One, References, each Appendix) is a ## heading; its numbered sections are ### headings; sub-sections are #### headings. Do not repeat anything already in the document so far. Keep the sections of this stage within their word allocation in the length budget in the research notes (or, where there are no research notes, the LENGTH BUDGET rules). Continue its heading levels, numbering and terminology, keep the golden thread with the earlier sections, and refer back to them where it helps. Keep any private planning to a few lines and begin writing promptly. Inside the tags write only document text: no greetings, no notes about stages and no remarks about what comes next.${continuing}${clarity}${verification}`;
}
