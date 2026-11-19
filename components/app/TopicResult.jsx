"use client";

const VERDICT = {
  ready: ["Ready to go", "bg-mint text-brand-dark"],
  refine: ["Worth refining", "bg-sand text-[#7A4A0C]"],
  rethink: ["Needs rethinking", "bg-red-50 text-red-800"],
};

// The Topic validator result. Used in the dashboard and for the one free check on /tools/topic-validator.
// onUseTitle is optional: without it the "Use this title" links are hidden.
export default function TopicResult({ run, onUseTitle }) {
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
                {onUseTitle && (
                  <button type="button" onClick={() => onUseTitle(t)} className="mt-2.5 text-sm font-semibold text-brand hover:text-brand-dark">
                    Use this title for my objectives →
                  </button>
                )}
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
