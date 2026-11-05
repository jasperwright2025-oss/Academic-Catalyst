"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getTool, runToolRequest, listProjects, searchLiterature, isUnauthorized, isLimitReached } from "@/lib/api/client";
import { risExport, bibtexExport } from "@/lib/tools/references";
import UnlockBox from "@/components/app/UnlockBox";
import ReportLink from "@/components/app/ReportLink";

const MAX_SELECTED = 15;
const field =
  "mt-1.5 w-full rounded-xl border border-[#C9CCC4] bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-[#BFE0D6] disabled:opacity-60";

const shortAuthors = (a) => (a.length === 0 ? "Unknown authors" : a.length <= 2 ? a.join(" and ") : `${a[0]} and others`);

function download(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Renders *italic* markers from the APA references.
function Italics({ text }) {
  return String(text)
    .split(/(\*[^*]+\*)/g)
    .map((part, i) => (part.startsWith("*") && part.endsWith("*") ? <em key={i}>{part.slice(1, -1)}</em> : <span key={i}>{part}</span>));
}

export default function LiteratureTool({ service }) {
  const router = useRouter();
  const search = useSearchParams();
  const [usage, setUsage] = useState(null);
  const [runs, setRuns] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(search.get("project") || "");
  const [query, setQuery] = useState("");
  const [fromYear, setFromYear] = useState(String(new Date().getFullYear() - 10));
  const [oaOnly, setOaOnly] = useState(false);
  const [reviewsOnly, setReviewsOnly] = useState(false);
  const [results, setResults] = useState(null);
  const [total, setTotal] = useState(0);
  const [searchNote, setSearchNote] = useState("");
  const [selected, setSelected] = useState(new Map());
  const [searching, setSearching] = useState(false);
  const [summarising, setSummarising] = useState(false);
  const [error, setError] = useState("");
  const [limitHit, setLimitHit] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getTool("literature-review")
      .then((d) => {
        setUsage(d.usage);
        setRuns(d.runs || []);
      })
      .catch((err) => (isUnauthorized(err) ? router.push("/login") : setError(err.message)));
    listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, [router]);

  // A project fills the search with its chosen title, which covers the whole study; the search turns it into key words.
  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  useEffect(() => {
    if (!project) return;
    const rq = project.latest?.smart_objectives?.output?.objectives?.[0]?.research_question;
    setQuery(project.topic || project.title || rq || "");
  }, [project]);

  async function runSearch(event) {
    event?.preventDefault();
    if (searching) return;
    setError("");
    if (query.trim().length < 3) {
      setError("Please type a research question or a few key words.");
      return;
    }
    setSearching(true);
    try {
      const data = await searchLiterature(query.trim(), { from: fromYear, oa: oaOnly, reviews: reviewsOnly });
      setResults(data.papers || []);
      setTotal(data.total || 0);
      setSearchNote(
        [data.searched_for ? `Searched for: ${data.searched_for}.` : "", data.broadened || ""].filter(Boolean).join(" ")
      );
    } catch (err) {
      if (isUnauthorized(err)) router.push("/login");
      else setError(err.message || "The search did not work. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function toggle(paper) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(paper.id)) next.delete(paper.id);
      else if (next.size < MAX_SELECTED) next.set(paper.id, paper);
      return next;
    });
  }

  async function summarise() {
    if (summarising || selected.size < 2) return;
    setError("");
    setLimitHit(false);
    setSummarising(true);
    try {
      const data = await runToolRequest("literature-review", {
        topic: query.trim(),
        project_id: projectId || undefined,
        paper_ids: [...selected.keys()],
      });
      setResult(data.run);
      setSelected(new Map());
      setUsage(data.usage);
      setRuns((r) => [data.run, ...r].slice(0, 10));
      if (data.run?.project_id && data.run.project_id !== projectId) setProjectId(data.run.project_id);
      setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      if (isUnauthorized(err)) router.push("/login");
      else if (isLimitReached(err)) setLimitHit(true);
      else setError(err.message || "The summary could not be made. Please try again.");
    } finally {
      setSummarising(false);
    }
  }

  const usageText = !usage ? "" : usage.unlimited ? "Unlimited summaries on your plan" : `${usage.remaining} of ${usage.limit} free summaries left this month`;

  return (
    <main className="mx-auto max-w-6xl px-5 pb-32 pt-8 sm:px-8 sm:pt-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/dashboard/tools" className="hover:text-brand">Tools</Link> / {service.name}
      </nav>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">Step {service.step} of 5</p>
          <h1 className="mt-1.5 font-serif text-4xl font-medium tracking-tight">{service.name}</h1>
          <p className="mt-2 text-sm text-muted">Searching is free. Choose the studies that matter, then summarise the evidence.</p>
        </div>
        {usage && <span className="rounded-full bg-mint px-3.5 py-2 text-sm font-semibold text-brand-dark">{usageText}</span>}
      </div>

      <form onSubmit={runSearch} className="mt-8 rounded-2xl border border-line bg-white p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <div>
            <label htmlFor="project" className="block text-sm font-semibold">Project</label>
            <select id="project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
              <option value="">Start a new project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title.length > 60 ? `${p.title.slice(0, 60)}...` : p.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="q" className="block text-sm font-semibold">Research question or key words</label>
            <input id="q" type="search" maxLength={300} value={query} onChange={(e) => setQuery(e.target.value)} className={field}
              placeholder="For example: mobile money saving small traders" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-5">
          <div>
            <label htmlFor="from" className="block text-sm font-semibold">Published from</label>
            <select id="from" value={fromYear} onChange={(e) => setFromYear(e.target.value)} className={`${field} w-36`}>
              {[5, 10, 15, 20].map((n) => {
                const y = new Date().getFullYear() - n;
                return <option key={y} value={y}>{y}</option>;
              })}
              <option value="">Any year</option>
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={oaOnly} onChange={(e) => setOaOnly(e.target.checked)} className="h-4 w-4 accent-[#0E7C66]" />
            Free to read only
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={reviewsOnly} onChange={(e) => setReviewsOnly(e.target.checked)} className="h-4 w-4 accent-[#0E7C66]" />
            Reviews only
          </label>
          <button type="submit" disabled={searching} className="ml-auto rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
        <div aria-live="polite">
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error} <ReportLink error={error} topic="search" /></p>}
          {limitHit && (
            <p role="alert" className="mt-4 rounded-xl bg-sand px-4 py-3 text-sm text-[#7A4A0C]">
              You have used this month&apos;s free summaries. Searching stays free. They reset on the 1st, or{" "}
              <Link href="/pricing" className="font-semibold underline">choose a plan</Link> for unlimited use.
            </p>
          )}
        </div>
      </form>

      {results && (
        <section aria-labelledby="results" className="mt-6">
          <h2 id="results" className="text-sm font-semibold text-muted">
            {results.length ? `Showing the ${results.length} most relevant of ${total.toLocaleString()} works found` : "No works found. Try fewer or broader key words."}
          </h2>
          {results.length < 2 && (
            <p className="mt-2 rounded-xl bg-sand px-4 py-3 text-sm text-[#7A4A0C]">
              Too few studies to summarise. Try three to six key words without place names, for example: mobile money saving market traders.
              Still stuck? <ReportLink error={`Search returned ${results.length} studies for: ${query}`} topic="search" />
            </p>
          )}
          {searchNote && <p className="mt-1 text-xs text-muted">{searchNote} Tip: three to six key words usually work best.</p>}
          <ul className="mt-3 space-y-3">
            {results.map((p) => {
              const on = selected.has(p.id);
              return (
                <li key={p.id} className={`rounded-2xl border bg-white p-5 transition ${on ? "border-brand ring-1 ring-brand" : "border-line"}`}>
                  <div className="flex gap-4">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(p)}
                      disabled={!on && selected.size >= MAX_SELECTED}
                      aria-label={`Select: ${p.title}`}
                      className="mt-1 h-5 w-5 flex-none accent-[#0E7C66]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug text-ink">{p.title}</p>
                      <p className="mt-1 text-sm text-muted">
                        {shortAuthors(p.authors)} · {p.year || "n.d."}{p.journal ? ` · ${p.journal}` : ""} · cited {p.cited_by.toLocaleString()} times
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                        {p.open_access_url && <a href={p.open_access_url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-brand-dark">Free to read</a>}
                        {p.landing_url && <a href={p.landing_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand">Open</a>}
                      </div>
                      {p.abstract && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-semibold text-ink-soft">Abstract</summary>
                          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{p.abstract}</p>
                        </details>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
            <p className="text-sm">
              <span className="font-bold">{selected.size}</span> of {MAX_SELECTED} studies selected
              {selected.size < 2 && <span className="text-muted"> (choose at least 2)</span>}
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setSelected(new Map())} className="rounded-full border border-[#C9CCC4] px-4 py-2.5 text-sm font-semibold">Clear</button>
              <button type="button" onClick={summarise} disabled={summarising || selected.size < 2} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {summarising ? "Reading the studies..." : "Summarise the evidence"}
              </button>
            </div>
          </div>
        </div>
      )}

      {runs.length > 0 && !result && (
        <section className="mt-8 rounded-2xl border border-line bg-white p-5">
          <p className="text-sm font-semibold">Your recent summaries</p>
          <ul className="mt-3 space-y-1">
            {runs.map((r) => (
              <li key={r.id || r.created_at}>
                <button type="button" onClick={() => setResult(r)} className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper">
                  <span className="font-medium">{r.input?.topic}</span>{" "}
                  <span className="text-xs text-muted">{r.output?.papers?.length || 0} studies · {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result?.output && <LiteratureResult run={result} />}
    </main>
  );
}

function LiteratureResult({ run }) {
  const o = run.output;
  const limited = Boolean(o.limited);
  const papers = o.papers || [];
  const byKey = Object.fromEntries(papers.map((p) => [p.key, p]));

  // Replaces [P1; P3] keys with in-text citations built from the database records.
  const cite = (text) =>
    String(text || "").replace(/\[(P\d+(?:\s*[;,]\s*P\d+)*)\]/g, (_, keys) => {
      const list = keys.split(/\s*[;,]\s*/).map((k) => byKey[k]?.citation).filter(Boolean);
      return list.length ? `(${list.join("; ")})` : "";
    });

  const references = limited ? [] : papers.map((p) => p.reference).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const hidden = o.hidden || {};
  const proposalHref = `/dashboard/write?project=${run.project_id || ""}`;

  return (
    <section id="result" className={`mt-10 scroll-mt-6 space-y-6 ${limited ? "select-none" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-3xl font-medium">What the evidence says</h2>
        {!limited && papers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => download("references.ris", risExport(papers))} className="rounded-full border border-[#C9CCC4] bg-white px-4 py-2 text-sm font-semibold">Export RIS</button>
            <button type="button" onClick={() => download("references.bib", bibtexExport(papers))} className="rounded-full border border-[#C9CCC4] bg-white px-4 py-2 text-sm font-semibold">Export BibTeX</button>
          </div>
        )}
      </div>
      {limited && <UnlockBox what="literature review" projectId={run.project_id} />}
      {o.overview && <p className="max-w-3xl text-[17px] leading-relaxed text-ink-soft">{cite(o.overview)}</p>}

      {(o.themes || []).map((t) => (
        <div key={t.theme} className="relative overflow-hidden rounded-2xl border border-line bg-white p-6">
          <h3 className="font-serif text-xl font-medium">{t.theme}</h3>
          <p className="mt-2.5 leading-relaxed text-ink-soft">{cite(t.synthesis)}</p>
          {limited && (
            <div aria-hidden="true" className="mt-2 space-y-2">
              <div className="h-3 w-full rounded bg-[#EEF0EA]" />
              <div className="h-3 w-11/12 rounded bg-[#EEF0EA]" />
              <div className="h-3 w-4/6 rounded bg-[#EEF0EA]" />
            </div>
          )}
        </div>
      ))}

      <div className="rounded-2xl border border-line bg-white p-6">
        <h3 className="font-bold">Synthesis matrix</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted">
                {["Study", "Aim", "Method", "Setting and sample", "Key finding", "Limitation or gap"].map((h) => (
                  <th key={h} scope="col" className="border-b border-line px-2 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(o.matrix || []).map((m) => (
                <tr key={m.key} className="align-top">
                  <td className="border-b border-[#F0F0EA] px-2 py-2.5 font-semibold text-ink">{byKey[m.key]?.citation || m.key}</td>
                  <td className="border-b border-[#F0F0EA] px-2 py-2.5">{m.aim}</td>
                  <td className="border-b border-[#F0F0EA] px-2 py-2.5">{m.method}</td>
                  <td className="border-b border-[#F0F0EA] px-2 py-2.5">{m.setting_sample}</td>
                  <td className="border-b border-[#F0F0EA] px-2 py-2.5">{m.finding}</td>
                  <td className="border-b border-[#F0F0EA] px-2 py-2.5">{m.limitation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {limited && hidden.matrix_rows > 0 && (
          <p className="mt-3 text-sm text-muted">🔒 {hidden.matrix_rows} more {hidden.matrix_rows === 1 ? "study" : "studies"} in your full proposal</p>
        )}
      </div>

      {(o.gaps || []).length > 0 && (
        <div className="rounded-2xl bg-sand p-6">
          <h3 className="font-bold">Gaps your study could fill</h3>
          <ul className="mt-2.5 space-y-1.5 text-[15px] text-[#5A3A0C]">{o.gaps.map((g) => <li key={g}>· {g}</li>)}</ul>
          {limited && hidden.gaps > 0 && <p className="mt-2 text-sm text-[#7A4A0C]">🔒 {hidden.gaps} more in your full proposal</p>}
        </div>
      )}

      {limited ? (
        <div className="rounded-2xl border border-line bg-white p-6">
          <h3 className="font-bold">References</h3>
          <p className="mt-2 text-[15px] text-ink-soft">
            🔒 {hidden.references || papers.length} verified references, in APA 7th edition, are included in your full research proposal.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-6">
          <h3 className="font-bold">References (APA 7th)</h3>
          <ul className="mt-3 space-y-2.5 text-sm leading-relaxed">
            {references.map((r) => <li key={r} className="pl-6 -indent-6"><Italics text={r} /></li>)}
          </ul>
          <p className="mt-4 text-xs text-muted">Built from the database records. Summaries are based on the abstracts; read the full studies before you rely on them.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink px-6 py-5 text-white">
        <p className="text-[15px]">
          {limited
            ? "Your chosen studies are saved to the project. The full literature review is written into your proposal."
            : "These studies are saved to your project and will be cited in your proposal."}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link href={`/dashboard/tools/methodology?project=${run.project_id || ""}`} className="rounded-full border border-white/40 px-5 py-3 text-sm font-semibold">Plan the methodology</Link>
          <Link href={proposalHref} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink">
            {limited ? "Get the full proposal" : "Write the full proposal"}
          </Link>
        </div>
      </div>
    </section>
  );
}
