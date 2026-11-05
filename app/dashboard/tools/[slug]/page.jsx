"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getTool, runToolRequest, listProjects, isUnauthorized, isLimitReached } from "@/lib/api/client";
import { serviceBySlug } from "@/lib/site/content";

const LIVE = ["topic-validator", "smart-objectives"];
const LEVELS = ["Master's", "PhD", "Undergraduate", "Postgraduate diploma", "Professional or workplace study"];
const APPROACHES = ["No preference", "Quantitative", "Qualitative", "Mixed methods"];
const WAIT_MESSAGES = {
  "topic-validator": ["Searching published studies", "Comparing your topic with existing work", "Scoring clarity, originality, relevance and feasibility", "Drafting stronger titles"],
  "smart-objectives": ["Reading your topic", "Drafting objectives", "Testing each one against SMART", "Matching research questions and methods"],
};

const field =
  "mt-1.5 w-full rounded-xl border border-[#C9CCC4] bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-[#BFE0D6] disabled:opacity-60";

function ToolPage() {
  const { slug } = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const service = serviceBySlug(slug);

  const [usage, setUsage] = useState(null);
  const [runs, setRuns] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(search.get("project") || "");
  const [form, setForm] = useState({
    topic: search.get("topic") || "",
    level: "Master's",
    institution: "",
    notes: "",
    approach: "No preference",
    timeframe: "",
  });
  const [running, setRunning] = useState(false);
  const [waitIndex, setWaitIndex] = useState(0);
  const [error, setError] = useState("");
  const [limitHit, setLimitHit] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!LIVE.includes(slug)) return;
    getTool(slug)
      .then((d) => {
        setUsage(d.usage);
        setRuns(d.runs || []);
      })
      .catch((err) => (isUnauthorized(err) ? router.push("/login") : setError(err.message)));
    listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, [slug, router]);

  // Choosing a project fills in its topic, preferring a title chosen in the Topic Validator.
  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  useEffect(() => {
    if (!project || search.get("topic")) return;
    setForm((f) => ({
      ...f,
      topic: project.topic || project.title || f.topic,
      level: project.level || f.level,
      institution: project.institution || f.institution,
    }));
  }, [project, search]);

  useEffect(() => {
    if (!running) return;
    setWaitIndex(0);
    const t = setInterval(() => setWaitIndex((i) => Math.min(i + 1, (WAIT_MESSAGES[slug] || [""]).length - 1)), 18000);
    return () => clearInterval(t);
  }, [running, slug]);

  if (!service || service.group !== "tools") {
    return <main className="px-8 py-10">This tool does not exist. <Link href="/dashboard/tools" className="text-brand">See all tools</Link></main>;
  }
  if (!LIVE.includes(slug)) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <h1 className="font-serif text-4xl font-medium">{service.name}</h1>
        <p className="mt-3 text-ink-soft">{service.intro}</p>
        <p className="mt-6 inline-block rounded-xl bg-sand px-4 py-2.5 text-sm text-[#7A4A0C]">Opening soon.</p>
      </main>
    );
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (running) return;
    setError("");
    setLimitHit(false);
    if (form.topic.trim().length < 10) {
      setError("Please describe your topic in at least a few words.");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const data = await runToolRequest(slug, { ...form, project_id: projectId || undefined });
      setResult(data.run);
      setUsage(data.usage);
      setRuns((r) => [data.run, ...r].slice(0, 10));
      if (data.run?.project_id && data.run.project_id !== projectId) {
        setProjectId(data.run.project_id);
        listProjects().then((d) => setProjects(d.projects || [])).catch(() => {});
      }
      setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      if (isUnauthorized(err)) router.push("/login");
      else if (isLimitReached(err)) {
        setLimitHit(true);
        setUsage(err.data?.usage || usage);
      } else setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  const usageText = !usage
    ? ""
    : usage.unlimited
    ? "Unlimited use on your plan"
    : `${usage.remaining} of ${usage.limit} free uses left this month`;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/dashboard/tools" className="hover:text-brand">Tools</Link> / {service.name}
      </nav>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">Step {service.step} of 5</p>
          <h1 className="mt-1.5 font-serif text-4xl font-medium tracking-tight">{service.name}</h1>
        </div>
        {usage && <span className="rounded-full bg-mint px-3.5 py-2 text-sm font-semibold text-brand-dark">{usageText}</span>}
      </div>

      <div className="mt-8 flex flex-wrap gap-6">
        <form onSubmit={submit} noValidate className="min-w-0 flex-[1_1_420px] space-y-5 rounded-2xl border border-line bg-white p-6">
          <div>
            <label htmlFor="project" className="block text-sm font-semibold">Project</label>
            <select id="project" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={running} className={field}>
              <option value="">Start a new project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title.length > 70 ? `${p.title.slice(0, 70)}...` : p.title}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">Results are saved to the project, so the next step can carry them forward.</p>
          </div>
          <div>
            <label htmlFor="topic" className="block text-sm font-semibold">Your topic or working title</label>
            <textarea id="topic" rows={3} maxLength={600} value={form.topic} onChange={set("topic")} disabled={running} className={field}
              placeholder="For example: Mobile money use and saving behaviour among market vendors in Mbale" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="level" className="block text-sm font-semibold">Level</label>
              <select id="level" value={form.level} onChange={set("level")} disabled={running} className={field}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="institution" className="block text-sm font-semibold">Institution <span className="font-normal text-muted">(optional)</span></label>
              <input id="institution" type="text" maxLength={200} value={form.institution} onChange={set("institution")} disabled={running} className={field} />
            </div>
          </div>
          {slug === "smart-objectives" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="approach" className="block text-sm font-semibold">Approach</label>
                <select id="approach" value={form.approach} onChange={set("approach")} disabled={running} className={field}>
                  {APPROACHES.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="timeframe" className="block text-sm font-semibold">Time for the study <span className="font-normal text-muted">(optional)</span></label>
                <input id="timeframe" type="text" maxLength={100} value={form.timeframe} onChange={set("timeframe")} disabled={running} className={field} placeholder="For example: six months" />
              </div>
            </div>
          )}
          <div>
            <label htmlFor="notes" className="block text-sm font-semibold">
              {slug === "topic-validator" ? "Setting and access" : "Anything else"} <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea id="notes" rows={3} maxLength={2000} value={form.notes} onChange={set("notes")} disabled={running} className={field}
              placeholder={slug === "topic-validator" ? "Where you plan to collect data, who you can reach, and any limits on time or money." : "Anything your supervisor has asked for, or points you want the objectives to cover."} />
          </div>

          <div aria-live="polite">
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            {limitHit && (
              <div role="alert" className="rounded-xl bg-sand px-4 py-3 text-sm text-[#7A4A0C]">
                You have used this month&apos;s free uses of this tool. They reset on the 1st of next month, or{" "}
                <Link href="/pricing" className="font-semibold underline">choose a plan</Link> for unlimited use.
              </div>
            )}
          </div>

          <button type="submit" disabled={running} className="w-full rounded-full bg-brand px-5 py-3.5 text-base font-semibold text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-70">
            {running ? `${(WAIT_MESSAGES[slug] || ["Working"])[waitIndex]}...` : slug === "topic-validator" ? "Check my topic" : "Build my objectives"}
          </button>
          {running && <p className="text-center text-xs text-muted">This usually takes {slug === "topic-validator" ? "one to two minutes" : "under a minute"}. Please keep this page open.</p>}
        </form>

        <aside className="min-w-0 flex-[1_1_280px] space-y-4">
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-sm font-semibold">What you get</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
              {service.features.map((f) => <li key={f}>· {f}</li>)}
            </ul>
          </div>
          {runs.length > 0 && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="text-sm font-semibold">Your recent results</p>
              <ul className="mt-3 space-y-2">
                {runs.map((r) => (
                  <li key={r.id || r.created_at}>
                    <button type="button" onClick={() => { setResult(r); setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth" }), 50); }}
                      className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-paper">
                      <span className="line-clamp-1 font-medium">{r.input?.topic}</span>
                      <span className="text-xs text-muted">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {result?.output && (
        <section id="result" className="mt-8 scroll-mt-6">
          {slug === "topic-validator" ? (
            <TopicResult run={result} onUseTitle={(title) => router.push(`/dashboard/tools/smart-objectives?project=${result.project_id || ""}&topic=${encodeURIComponent(title)}`)} />
          ) : (
            <ObjectivesResult run={result} />
          )}
        </section>
      )}
    </main>
  );
}

const VERDICT = {
  ready: ["Ready to go", "bg-mint text-brand-dark"],
  refine: ["Worth refining", "bg-sand text-[#7A4A0C]"],
  rethink: ["Needs rethinking", "bg-red-50 text-red-800"],
};

function TopicResult({ run, onUseTitle }) {
  const o = run.output;
  const [label, tone] = VERDICT[o.verdict] || VERDICT.refine;
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-serif text-2xl font-medium">Your result</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>
        </div>
        <p className="mt-3 max-w-3xl leading-relaxed text-ink-soft">{o.summary}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(o.scores || []).map((s) => (
            <div key={s.criterion} className="rounded-2xl border border-[#ECECE6] bg-paper p-5">
              <div className="flex items-baseline justify-between">
                <span className="font-bold">{s.criterion}</span>
                <span className="font-serif text-2xl">{s.score}<span className="text-sm text-muted">/5</span></span>
              </div>
              <div className="mt-2.5 h-1.5 rounded-full bg-[#EEF0EA]"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.min(5, Math.max(0, Number(s.score) || 0)) * 20}%` }} /></div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{s.reason}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="min-w-0 flex-[1_1_360px] rounded-2xl bg-mint p-6">
          <h3 className="font-bold">Stronger titles</h3>
          <ol className="mt-3 space-y-3">
            {(o.titles || []).map((t, i) => (
              <li key={t} className="rounded-xl bg-white p-4">
                <p className="text-[15px] leading-snug"><span className="mr-1 font-bold text-brand">{i + 1}.</span>{t}</p>
                <button type="button" onClick={() => onUseTitle(t)} className="mt-2.5 text-sm font-semibold text-brand hover:text-brand-dark">
                  Use this title for my objectives →
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="min-w-0 flex-[1_1_360px] space-y-6">
          {(o.red_flags || []).length > 0 && (
            <div className="rounded-2xl bg-sand p-6">
              <h3 className="font-bold">Watch out for</h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#5A3A0C]">
                {o.red_flags.map((f) => <li key={f}>· {f}</li>)}
              </ul>
            </div>
          )}
          <div className="rounded-2xl border border-line bg-white p-6">
            <h3 className="font-bold">Closest existing studies</h3>
            {(o.related_studies || []).length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No closely matching studies were found in our searches.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {o.related_studies.map((r) => (
                  <li key={r.title} className="text-sm leading-relaxed">
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:text-brand-dark">{r.title}</a>
                    ) : (
                      <span className="font-semibold">{r.title}</span>
                    )}
                    <span className="text-muted"> {[r.authors, r.year].filter(Boolean).join(", ")}</span>
                    <p className="text-ink-soft">{r.relevance}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted">Originality is reported as what our searches found. No tool can prove that a topic has never been studied.</p>
          </div>
        </div>
      </div>
      {o.next_step && <p className="rounded-2xl border border-line bg-white px-6 py-4 text-sm"><span className="font-semibold">Next: </span>{o.next_step}</p>}
    </div>
  );
}

const SMART_LETTERS = [
  ["specific", "S"],
  ["measurable", "M"],
  ["achievable", "A"],
  ["relevant", "R"],
  ["time_bound", "T"],
];

function objectivesAsText(o) {
  const lines = [`General objective: ${o.general_objective}`, "", "Specific objectives:"];
  (o.objectives || []).forEach((x, i) => {
    lines.push(`${i + 1}. ${x.objective}`, `   Research question: ${x.research_question}`);
    if (x.hypothesis) lines.push(`   Hypothesis: ${x.hypothesis}`);
    lines.push(`   Method: ${x.method}`);
  });
  return lines.join("\n");
}

function ObjectivesResult({ run }) {
  const o = run.output;
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(objectivesAsText(o));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // still visible on screen
    }
  }
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-medium">Your objectives</h2>
          <button type="button" onClick={copy} className="rounded-full border border-[#C9CCC4] px-4 py-2 text-sm font-semibold hover:border-ink">
            {copied ? "Copied" : "Copy all"}
          </button>
        </div>
        <p className="mt-4 text-[13px] font-semibold uppercase tracking-wider text-brand">General objective</p>
        <p className="mt-1.5 font-serif text-xl leading-snug">{o.general_objective}</p>
        {o.scope_note && <p className="mt-3 text-sm text-ink-soft">{o.scope_note}</p>}
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span>S M A R T: specific, measurable, achievable, relevant, time-bound.</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-mint" />passed first time</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-sand ring-1 ring-amber" />fixed in the rewrite</span>
        </p>
      </div>

      <ol className="space-y-4">
        {(o.objectives || []).map((x, i) => (
          <li key={x.objective} className="rounded-2xl border border-line bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="min-w-0 flex-[1_1_420px] text-[17px] font-semibold leading-snug">
                <span className="mr-1.5 text-brand">{i + 1}.</span>{x.objective}
              </p>
              <div className="flex gap-1.5" aria-label="SMART check">
                {SMART_LETTERS.map(([key, letter]) => {
                  const ok = x.smart?.[key] !== false;
                  return (
                    <span key={key} title={ok ? `${key.replace("_", "-")}: passed` : `${key.replace("_", "-")}: fixed in the rewrite`} className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${ok ? "bg-mint text-brand-dark" : "bg-sand text-[#7A4A0C] ring-1 ring-amber"}`}>
                      {letter}
                    </span>
                  );
                })}
              </div>
            </div>
            {x.note && <p className="mt-2 text-sm text-[#7A4A0C]">{x.note}</p>}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="font-semibold text-muted">Research question</dt><dd className="mt-1 leading-relaxed">{x.research_question}</dd></div>
              <div><dt className="font-semibold text-muted">Hypothesis</dt><dd className="mt-1 leading-relaxed">{x.hypothesis || "Not needed for this objective"}</dd></div>
              <div><dt className="font-semibold text-muted">Method</dt><dd className="mt-1 leading-relaxed">{x.method}</dd></div>
            </dl>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink px-6 py-5 text-white">
        <p className="text-[15px]">{o.next_step || "Next, turn these objectives into a full research proposal."}</p>
        <Link href="/dashboard/write" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink">Write the full proposal</Link>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ToolPage />
    </Suspense>
  );
}
