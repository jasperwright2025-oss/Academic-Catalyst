// Searches the OpenAlex scholarly database and builds references from its records in code,
// so reference details always come from the database, never from the AI.
import { LEGAL } from "@/lib/legal";

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

/**
 * Searches works. Returns up to 25 papers, most relevant first.
 * options: fromYear (number), openAccessOnly (boolean), reviewsOnly (boolean)
 */
export async function searchWorks(query, { fromYear, openAccessOnly, reviewsOnly } = {}) {
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
