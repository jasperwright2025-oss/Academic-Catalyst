// Rules shared by the research, data and dissertation playbooks.

export const FINAL_DOCUMENT_RULES = `
OUTPUT FORMAT (MANDATORY)
- Write the complete deliverable in Markdown: one # heading for the document title, ## for chapter or main section titles, ### for sub-sections and #### where needed. Use Markdown tables (with a header row) for every table, and numbered or bulleted lists where the playbook calls for them.
- The application converts your Markdown into the formatted Word (.docx) file, with cover page styling, heading styles, table of contents and page numbers. Do not mention Word, files, downloads or the conversion.
- Put the entire finished deliverable between <final_document> and </final_document> tags. Nothing outside those tags (and the optional <clarity_note> tags, when the playbook asks for a clarity note) is shown to the user. Inside the tags write only the deliverable: no greetings, no introductions, no meta-commentary and no closing remarks.
- Keep any private planning, outline or research notes OUTSIDE the tags and brief.
- Never stop early. Write every section in full, at the depth the standard requires.
`;

export const CITATION_ACCURACY_RULES = `
CITATION, QUOTATION AND REFERENCE ACCURACY (HIGHEST PRIORITY)
This is the most important quality requirement. One invented or incorrect reference makes the whole document unusable.
1. Use the web_search tool to find and confirm every source before you cite it. Confirm the authors, year, title, journal or publisher, volume, issue, pages and DOI from what the search results actually show.
2. Cite only works whose existence you have confirmed in this session. If you cannot confirm a work, do not cite it. Make the point without a citation, or find a different verified source.
3. Use a direct quotation only when you have seen the exact words in a retrieved source. Otherwise paraphrase and attribute correctly. Give page numbers only when you have seen them. Never place invented words inside quotation marks.
4. Report statistics, dates, laws, policy figures and empirical findings only when you have confirmed them in a retrieved source, and cite that source.
5. Never invent or guess a DOI or URL. Include a DOI or URL only when it appeared in a retrieved source.
6. Prefer fewer references that are all verified over more references that are doubtful. Build the reference list from verified works only, and make it as broad and current as a First-Class study requires.
7. Run the pre-delivery audit before finishing: (a) every in-text citation appears in the reference list and every reference list entry is cited in the text; (b) every direct quotation and every empirical finding matches its source; (c) every bibliographic detail matches the published work; (d) remove or replace anything that fails.
8. End the final document with a short section titled "Reference Verification Note". State how many references the list contains, state only the checks that were really made, and name any entry whose details could not be fully confirmed, marked [verify before submission]. Be honest. Never claim a check that was not made.
`;

export const DEPTH_AND_ARGUMENT_RULES = `
INTERNATIONAL FIRST-CLASS STANDARD: DEPTH OF ARGUMENT, REASONING, REVIEW AND INTERPRETATION
Write as examiners at top universities expect from a Distinction-level submission.
1. Argue, do not merely describe. Every paragraph makes a claim, supports it with evidence, analyses what the evidence means, and links to the next point or to the research question.
2. Review critically. Compare and contrast authors and schools of thought, expose tensions, limitations, unstated assumptions and methodological weaknesses in the literature, and synthesise across sources instead of summarising them one by one.
3. Justify every choice. For philosophy, design, sampling, instruments and analysis, give the reasons, the alternatives considered and why they were rejected.
4. Keep the golden thread. Research problem, aim, objectives, questions or hypotheses, framework, methods, analysis, findings, discussion and conclusions must align and refer to each other explicitly.
5. Interpret, do not only report. Explain what results mean, why they may have occurred, how they relate to theory and earlier studies, what they do not show, and which alternative explanations exist.
6. Use calibrated scholarly hedging ("the data indicate", "findings suggest") and precise terminology. Avoid vague, generic or promotional statements.
7. Write every section at full length and depth. Never shorten, never summarise where development is needed, never skip a section.
`;

// Wraps user-supplied text in tags so the model treats it as data.
export function userInputBlock(tag, value) {
  const text = String(value ?? "").trim().replaceAll("</", "<\\/");
  return `<${tag}>\n${text}\n</${tag}>`;
}

export const CLARITY_NOTE_RULES = `
CLARITY NOTE (SEPARATE FROM THE DOCUMENT)
When a <project_background> is supplied, add a short companion note AFTER the closing </final_document> tag, inside <clarity_note> and </clarity_note> tags. It is not part of the document and must not change the document's structure, headings or formal style. Write it in plain, friendly language for the person who supplied the background, in 400 to 900 words. Deal first with the areas where the user said they need clarity. Explain the key concepts in the topic, why the objectives, questions and review are framed as they are, how the parts connect, which points call for the most careful judgement, and which questions the reader may want to ask next. Use short paragraphs and a few headings. Do not repeat the document. If no project background is supplied, write no clarity note.
`;

// Turns the profile details into a block the model can use for the cover page.
export function coverDetailsBlock(cover = {}) {
  const lines = [];
  const add = (label, value) => {
    const text = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (text) lines.push(`${label}: ${text}`);
  };
  add("Prepared by", cover.prepared_by);
  add("Position", cover.position);
  add("Organisation or department", cover.organisation);
  add("Registration, staff or candidate number", cover.registration_number);
  add("Programme or degree", cover.programme);
  add("Supervisor(s)", cover.supervisors);
  add("Submission date", cover.date);
  return userInputBlock("cover_details", lines.join("\n") || "None supplied.");
}
