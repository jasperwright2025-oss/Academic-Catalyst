// Helpers for the "free preview, then unlock" flow.

// How many free previews each account gets in total (never resets, even if the user deletes documents).
export const FREE_PREVIEW_LIMIT = 1;

// Roughly one and a half pages: enough to judge the quality, not enough to use.
export const PREVIEW_WORD_TARGET = 600;

const HEADING_REGEX = /^#{1,3}\s+(.+)$/gm;

const cleanHeading = (text) => text.replace(/[*_`#]/g, "").trim();

function headingsOf(text) {
  return [...text.matchAll(HEADING_REGEX)].map((m) => cleanHeading(m[1])).filter(Boolean);
}

const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

// Where the free preview stops: at the first heading after the objectives section
// (decision of 11 Nov 2026: the preview shows the introduction and objectives, the rest is paid).
// Returns the text before that heading, or null when the document has no objectives heading.
export function cutAfterObjectives(text) {
  const headings = [...text.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => ({
    index: m.index,
    level: m[1].length,
    title: cleanHeading(m[2]),
  }));
  const objIdx = headings.findIndex((h) => /objective/i.test(h.title));
  if (objIdx === -1) return null;
  const obj = headings[objIdx];
  const next = headings
    .slice(objIdx + 1)
    .find((h) => h.level <= obj.level && !/objective/i.test(h.title));
  return next ? text.slice(0, next.index).trim() : null;
}

/**
 * Cuts a generated document down to a teaser.
 * Returns the preview text plus the titles of the sections that stay locked.
 * The preview is never more than 40% of the document, so short documents are not given away.
 */
export function buildPreview(fullText, wordTarget = PREVIEW_WORD_TARGET) {
  const text = String(fullText || "").trim();
  const totalWords = countWords(text);

  // The table of contents is left out of the preview, so the words go on real writing.
  const noContents = text.replace(/^(#{1,4})\s*\**\s*(table of )?contents\s*\**\s*\n[\s\S]*?(?=^#{1,4}\s+(?!.*contents))/im, "");

  // Introduction and objectives only; never more than 40% of the document.
  const upToObjectives = cutAfterObjectives(noContents);
  const cap = Math.floor(totalWords * 0.4);
  const target = upToObjectives
    ? Math.max(50, Math.min(countWords(upToObjectives), cap))
    : Math.max(50, Math.min(wordTarget, cap));
  const withoutContents = upToObjectives ?? noContents;
  const paragraphs = withoutContents.split(/\n\s*\n/);
  const isHeadingOnly = (p) => /^#{1,6}\s+[^\n]+$/.test(p.trim());
  const kept = [];
  let words = 0;

  for (const paragraph of paragraphs) {
    const n = countWords(paragraph);

    if (words + n > target) {
      // Room left: take the start of this paragraph rather than stop short.
      if (target - words >= 80 && !isHeadingOnly(paragraph)) {
        const take = target - words;
        kept.push(paragraph.trim().split(/\s+/).slice(0, take).join(" ") + " ...");
        words = target;
      }
      break;
    }

    kept.push(paragraph);
    words += n;
  }

  // Never end the preview on a heading with nothing under it.
  while (kept.length > 0 && isHeadingOnly(kept[kept.length - 1])) {
    words -= countWords(kept.pop());
  }

  let previewText = kept.join("\n\n").trim();
  if (!previewText) {
    previewText = text.split(/\s+/).slice(0, target).join(" ") + " ...";
    words = target;
  }

  // List only the main chapters and sections (## headings) that stay locked, not every sub-heading.
  const shown = new Set(headingsOf(previewText));
  const mainHeadings = [...text.matchAll(/^##\s+(.+)$/gm)].map((m) => cleanHeading(m[1])).filter(Boolean);
  const lockedSections = mainHeadings.filter((h) => !shown.has(h) && !/^(table of )?contents$/i.test(h));

  return { previewText, previewWords: words, totalWords, lockedSections };
}
