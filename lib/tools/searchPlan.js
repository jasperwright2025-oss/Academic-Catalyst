// Turns a research question into short key-word searches, the way an experienced researcher
// would type them into a database. Long questions searched word for word find few, often
// off-topic studies; two or three focused key-word searches find the core literature.
import { runClaude, extractTag } from "@/lib/generation/claude";

const SYSTEM = `You help researchers search a scholarly database (OpenAlex) well.
Given a research question or topic, write 3 key-word searches that together find the most relevant published studies.

Rules:
- Each search is 3 to 6 words, in the field's own vocabulary (the terms used in titles and abstracts of published studies).
- No question words, no full sentences, no quotation marks, no Boolean operators.
- Search 1: the core concepts plus the country or region, if one is named.
- Search 2: the same core relationship in wider or synonym terms (for example "informal traders" for "market vendors"), with the region or a wider region.
- Search 3: the main concept and the key outcome without place names, to catch comparable studies elsewhere.
- Drop names of single towns, markets, schools or organisations; they rarely appear in published titles.
- Write in English.

Reply with only this, nothing else:
<searches>
first search
second search
third search
</searches>`;

export async function planSearches(question) {
  try {
    const ai = await runClaude({
      systemPrompt: SYSTEM,
      userPrompt: `<question>${String(question).slice(0, 300)}</question>`,
      maxTokens: 400,
      searchLimit: 0,
      deadlineMs: Date.now() + 20000,
      effort: "low",
    });
    const block = extractTag(ai.text, "searches") || "";
    const searches = block
      .split("\n")
      .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").replace(/["“”]/g, "").trim())
      .filter((l) => l.split(/\s+/).length >= 2 && l.length <= 80)
      .slice(0, 3);
    return [...new Set(searches)];
  } catch (err) {
    console.error("Search planning error:", err?.message);
    return [];
  }
}
