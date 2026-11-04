"use client";

import { useState } from "react";
import Link from "next/link";

// The five-step journey on the homepage. steps: [{ n, name, tag, intro, features, href, cta }]
export default function JourneyTabs({ steps }) {
  const [active, setActive] = useState(0);
  const step = steps[active];

  function onKeyDown(event) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const next = (active + (event.key === "ArrowDown" ? 1 : steps.length - 1)) % steps.length;
    setActive(next);
    document.getElementById(`journey-tab-${next}`)?.focus();
  }

  return (
    <div className="mt-11 flex flex-wrap gap-8">
      <div role="tablist" aria-label="The five steps" aria-orientation="vertical" className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5" onKeyDown={onKeyDown}>
        {steps.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.name}
              id={`journey-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="journey-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className={`flex min-h-16 w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition ${
                on ? "border-ink bg-ink text-white shadow-lg" : "border-line bg-white text-ink hover:border-[#C9CCC4]"
              }`}
            >
              <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-bold ${on ? "bg-amber text-ink" : "bg-[#F0F2EC] text-ink"}`}>
                {s.n}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-semibold">{s.name}</span>
                <span className={`text-[13px] ${on ? "text-[#C7CFDC]" : "text-muted"}`}>{s.tag}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div id="journey-panel" role="tabpanel" aria-labelledby={`journey-tab-${active}`} className="min-w-0 flex-[2_1_520px] rounded-3xl bg-[#F4F6F1] p-8 sm:p-10">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">Step {step.n}</p>
        <h3 key={step.name} className="mt-2.5 font-serif text-3xl font-medium text-ink motion-safe:animate-[fadeUp_.35s_ease-out]">{step.name}</h3>
        <p className="mt-3.5 max-w-xl text-base leading-relaxed text-ink-soft">{step.intro}</p>
        <ul className="mt-6 space-y-3">
          {step.features.slice(0, 3).map((f) => (
            <li key={f} className="flex items-start gap-3 text-[15px] leading-normal text-ink">
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 flex-none">
                <circle cx="10" cy="10" r="9" fill="#E3F2EE" />
                <path d="M6 10.5l2.5 2.5L14 7.5" fill="none" stroke="#0E7C66" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Link href={step.href} className="mt-7 inline-block font-semibold text-brand hover:text-brand-dark">
          {step.cta} →
        </Link>
      </div>
    </div>
  );
}
