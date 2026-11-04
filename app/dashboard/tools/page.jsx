import Link from "next/link";
import { TOOLS, serviceHref } from "@/lib/site/content";

export const metadata = { title: "Tools" };

export default function ToolsPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Tools</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Four steps that prepare your research project. Each one carries forward into the next, and into your full proposal.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <div key={t.slug} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-6">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
              Step {t.step}
              {t.status === "soon" && <span className="rounded-full bg-sand px-2 py-0.5 normal-case tracking-normal text-[#7A4A0C]">Opening soon</span>}
            </span>
            <h2 className="font-serif text-2xl font-medium">{t.name}</h2>
            <p className="text-[15px] leading-relaxed text-ink-soft">{t.intro}</p>
            <div className="mt-auto flex flex-wrap items-center gap-4 pt-2">
              {t.status === "soon" ? (
                <span className="rounded-full bg-[#EEF0EA] px-4 py-2.5 text-sm font-semibold text-ink-soft">Opening soon</span>
              ) : (
                <Link href={`/dashboard/tools/${t.slug}`} className="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white">Open</Link>
              )}
              <Link href={serviceHref(t)} className="text-sm font-semibold text-brand">What it does →</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
