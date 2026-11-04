// Companion notes are written for the customer, not for submission. They are stored after the
// document, behind markers, and shown separately on the dashboard. They never go into downloads.
//   - Clarity note: a plain-language explanation of the document.
//   - Reference check: what was verified about the references, and anything to check by hand.

const MARKER = "<!--CLARITY_NOTE-->";
const VERIFY_MARKER = "<!--REFERENCE_CHECK-->";
export const CLARITY_MARKER = `\n\n${MARKER}\n\n`;

export function joinNotes(main, { clarity = "", verification = "" } = {}) {
  let text = String(main ?? "");
  if (clarity) text += `${CLARITY_MARKER}${clarity}`;
  if (verification) text += `\n\n${VERIFY_MARKER}\n\n${verification}`;
  return text;
}

// Kept for older code: joins only a clarity note.
export function joinClarity(main, note) {
  return joinNotes(main, { clarity: note });
}

// Older documents carry the verification note as a section inside the document. Move it out.
const VERIFY_HEADING = /^(#{1,4})\s*\**\s*Reference Verification Note\s*\**\s*$/im;

function extractVerificationSection(main) {
  const match = VERIFY_HEADING.exec(main);
  if (!match) return { main, verification: "" };
  const level = match[1].length;
  const start = match.index;
  const afterHeading = start + match[0].length;
  const rest = main.slice(afterHeading);
  const next = new RegExp(`^#{1,${level}}\\s+\\S`, "m").exec(rest);
  const end = next ? afterHeading + next.index : main.length;
  return {
    main: (main.slice(0, start) + main.slice(end)).replace(/\n{3,}/g, "\n\n").trim(),
    verification: main.slice(afterHeading, end).trim(),
  };
}

/**
 * Returns { main, note, verification }.
 * main: the document itself. note: the clarity note, or "". verification: the reference check, or "".
 */
export function splitClarity(text) {
  let value = String(text ?? "");
  let verification = "";

  const v = value.indexOf(VERIFY_MARKER);
  if (v !== -1) {
    verification = value.slice(v + VERIFY_MARKER.length).trim();
    value = value.slice(0, v);
  }

  let main = value;
  let note = "";
  const c = value.indexOf(MARKER);
  if (c !== -1) {
    main = value.slice(0, c);
    note = value.slice(c + MARKER.length).trim();
  }
  main = main.trim();

  const moved = extractVerificationSection(main);
  if (moved.verification) {
    main = moved.main;
    if (!verification) verification = moved.verification;
  }

  return { main, note, verification };
}
