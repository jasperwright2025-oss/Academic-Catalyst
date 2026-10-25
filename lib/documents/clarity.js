// The clarity note is a plain-language companion written for the person who gave a project background.
// It is stored after the document, behind a marker, and shown separately from the document itself.

const MARKER = "<!--CLARITY_NOTE-->";
export const CLARITY_MARKER = `\n\n${MARKER}\n\n`;

export function joinClarity(main, note) {
  return note ? `${main}${CLARITY_MARKER}${note}` : main;
}

// Returns { main, note }. "main" is the proposal or report; "note" is the clarity note, or "".
export function splitClarity(text) {
  const value = String(text ?? "");
  const index = value.indexOf(MARKER);
  if (index === -1) return { main: value, note: "" };
  return {
    main: value.slice(0, index).trim(),
    note: value.slice(index + MARKER.length).trim(),
  };
}
