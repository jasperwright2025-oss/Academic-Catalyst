// Searches the OpenAlex scholarly database and builds references from its records in code,
// so reference details always come from the database, never from the AI.
import { LEGAL } from "@/lib/legal";
import { planSearches } from "@/lib/tools/searchPlan";

const BASE = "https://api.openalex.org";
const SELECT = [
  "id",
  "doi",
  "title",
  "publication_year",
  "type",
  "authorships",
  "primary_location",
  "cited_by_count",
  "abstract_inverted_index",
  "open_access",
  "biblio",
].join(",");

function withAccess(params) {
  // The contact address puts requests in OpenAlex's "polite pool"; an API key is used when one is set.
  params.set("mailto", LEGAL.contactEmail);
  if (process.env.OPENALEX_API_KEY) params.set("api_key", process.env.OPENALEX_API_KEY);
  return params;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url, attempt = 0) {
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  // Busy or rate-limited: wait briefly and try once more.
  if ((res.status === 429 || res.status >= 500) && attempt === 0) {
    await wait(2500);
    return getJson(url, 1);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`OpenAlex ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function abstractFrom(index) {
  if (!index || typeof index !== "object") return "";
  const words = [];
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word;
  return words.filter(Boolean).join(" ");
}

const shortId = (id) => String(id || "").replace("https://openalex.org/", "");

export function toPaper(w) {
  const source = w.primary_location?.source;
  const authors = (w.authorships || []).map((a) => a.author?.display_name).filter(Boolean);
  return {
    id: shortId(w.id),
    title: (w.title || "Untitled").replace(/\s+/g, " ").trim(),
    year: w.publication_year || null,
    authors,
    journal: source?.display_name || "",
    volume: w.biblio?.volume || "",
    issue: w.biblio?.issue || "",
    pages: w.biblio?.first_page ? [w.biblio.first_page, w.biblio.last_page].filter(Boolean).join("–") : "",
    doi: w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//i, "") : "",
    type: w.type || "",
    cited_by: w.cited_by_count ?? 0,
    open_access_url: w.open_access?.is_oa ? w.open_access?.oa_url || w.primary_location?.landing_page_url || "" : "",
    landing_url: w.primary_location?.landing_page_url || (w.doi ? `https://doi.org/${String(w.doi).replace(/^https?:\/\/doi\.org\//i, "")}` : ""),
    abstract: abstractFrom(w.abstract_inverted_index).slice(0, 2500),
  };
}

// Words that carry no search meaning in a research question.
const STOPWORDS = new Set(
  ("a about above after against all among an and any are as at be been before being between both but by can could did do does " +
   "doing during each effect effects examine examining extent factors few for from further had has have having how however in into " +
   "is it its level levels more most of on or other our out over own role same should so some study such than that the their them " +
   "then there these they this those through to towards under until up use used using very was we were what when where which while " +
   "who whom why will with within would among influence influences relationship relate related registered selected case often frequently much many current currently").split(/\s+/)
);

// Turns a research question into its key words, keeping their order.
export function keywordsFrom(query) {
  const words = String(query || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  return [...new Set(words)];
}

async function searchOnce(query, { fromYear, openAccessOnly, reviewsOnly }) {
  const filters = ["has_abstract:true"];
  if (fromYear) filters.push(`from_publication_date:${fromYear}-01-01`);
  if (openAccessOnly) filters.push("is_oa:true");
  filters.push(reviewsOnly ? "type:review" : "type:article|review|book-chapter|dissertation");
  const params = withAccess(
    new URLSearchParams({ search: query, filter: filters.join(","), "per-page": "25", select: SELECT })
  );
  const data = await getJson(`${BASE}/works?${params}`);
  return { total: data.meta?.count ?? 0, papers: (data.results || []).map(toPaper) };
}

/**
 * Searches works. Returns up to 25 papers, most relevant first.
 * A long question is reduced to its key words. If fewer than 5 studies are found, the search is
 * widened step by step (no year limit, then fewer and broader key words), and `broadened` says how.
 * options: fromYear (number), openAccessOnly (boolean), reviewsOnly (boolean)
 */
export async function searchWorks(query, options = {}) {
  const keywords = keywordsFrom(query);
  const base = keywords.length >= 2 ? keywords.slice(0, 7) : [String(query).trim()];
  const attempts = [
    { terms: base, opts: options, note: "" },
    { terms: base, opts: { ...options, fromYear: undefined }, note: "Widened to all years." },
    { terms: base.slice(0, 4), opts: { ...options, fromYear: undefined }, note: "Widened to fewer, broader key words and all years." },
    { terms: base.slice(0, 3), opts: { ...options, fromYear: undefined }, note: "Widened to the three main key words and all years." },
  ];

  let best = null;
  const tried = new Set();
  for (const attempt of attempts) {
    const q = attempt.terms.join(" ");
    const key = `${q}|${attempt.opts.fromYear || ""}`;
    if (!q || tried.has(key)) continue;
    tried.add(key);
    const result = await searchOnce(q, attempt.opts);
    if (!best || result.papers.length > best.papers.length) {
      best = { ...result, searched_for: q, broadened: attempt.note };
    }
    if (result.papers.length >= 5) break;
  }
  return best || { total: 0, papers: [], searched_for: base.join(" "), broadened: "" };
}

// Ranks papers found by several searches: a paper near the top of more than one search, or one
// that is widely cited, rises; a paper found once near the bottom of one search falls.
function mergeResults(lists) {
  const scored = new Map();
  lists.forEach(({ papers }) => {
    papers.forEach((paper, rank) => {
      const entry = scored.get(paper.id) || { paper, score: 0 };
      entry.score += 25 - rank;
      scored.set(paper.id, entry);
    });
  });
  for (const entry of scored.values()) entry.score += 4 * Math.log10((entry.paper.cited_by || 0) + 1);
  return [...scored.values()].sort((a, b) => b.score - a.score).map((e) => e.paper);
}

/**
 * The search used by the Literature Review Assistant. A short key-word search runs as typed.
 * A research question is turned into three key-word searches, which run together; the results
 * are merged, duplicates removed and the best 25 kept. If that still finds fewer than 5 studies,
 * the step-by-step widening of searchWorks takes over.
 */
export async function smartSearch(query, options = {}) {
  if (keywordsFrom(query).length <= 5) return searchWorks(query, options);

  const searches = await planSearches(query);
  if (!searches.length) return searchWorks(query, options);

  const settled = await Promise.allSettled(searches.map((q) => searchOnce(q, options)));
  const lists = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (!lists.length) {
    throw settled.find((r) => r.status === "rejected")?.reason || new Error("Search failed");
  }
  const papers = mergeResults(lists).slice(0, 25);
  if (papers.length < 5) return searchWorks(searches[0], options);

  return {
    total: Math.max(...lists.map((l) => l.total)),
    papers,
    searched_for: searches.join(" · "),
    broadened: "Your question was turned into these key-word searches, and the results were combined.",
  };
}

// Fetches specific works by their OpenAlex ids (W123...). Order follows the ids given.
export async function getWorks(ids) {
  const clean = [...new Set(ids.map(shortId).filter((id) => /^W\d+$/.test(id)))].slice(0, 20);
  if (!clean.length) return [];
  const params = withAccess(
    new URLSearchParams({ filter: `openalex:${clean.join("|")}`, "per-page": String(clean.length), select: SELECT })
  );
  const data = await getJson(`${BASE}/works?${params}`);
  const byId = new Map((data.results || []).map((w) => [shortId(w.id), toPaper(w)]));
  return clean.map((id) => byId.get(id)).filter(Boolean);
}
