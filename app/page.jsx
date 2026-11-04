import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import JourneyTabs from "@/components/site/JourneyTabs";
import PlanGrid from "@/components/site/PlanGrid";
import { SITE, SERVICES, JOURNEY, SINGLE_PRICES, serviceHref } from "@/lib/site/content";

const EXAMPLE_SCORES = [
  ["Clarity", 4],
  ["Originality", 3],
  ["Relevance", 5],
  ["Feasibility", 4],
];

export default function HomePage() {
  const steps = JOURNEY.map((s) => ({
    n: s.step,
    name: s.name,
    tag: `${s.kind}${s.status === "soon" ? " · opening soon" : ""}`,
    intro: s.intro,
    features: s.features,
    href: serviceHref(s),
    cta: `About the ${s.name}`,
  }));

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="mx-auto flex max-w-6xl flex-wrap items-center gap-14 px-6 pb-20 pt-20 sm:pt-24">
          <div className="min-w-0 flex-[1_1_520px]">
            <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-brand">
              <span className="inline-block h-2 w-2 rounded-full bg-amber" aria-hidden="true" />
              Research support for postgraduates and professionals
            </p>
            <h1 className="mt-5 font-serif text-5xl font-medium leading-[1.04] tracking-tight sm:text-6xl">{SITE.tagline}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-[19px]">
              Test your topic, sharpen your objectives, map the literature and plan your methods. Then turn the whole project
              into a formatted proposal, with every reference checked against live sources.
            </p>
            <div className="mt-9 flex flex-wrap gap-3.5">
              <Link href="/register" className="rounded-full bg-brand px-6 py-4 text-base font-semibold text-white transition hover:bg-brand-dark">
                Start free
              </Link>
              <Link href="#services" className="rounded-full border border-[#C9CCC4] px-6 py-4 text-base font-semibold text-ink transition hover:border-ink">
                See all services
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">Free account. One free proposal preview, and free tools opening soon.</p>
          </div>

          <div className="min-w-0 flex-[1_1_420px]">
            <div className="rounded-[20px] border border-line bg-white p-7 shadow-[0_24px_48px_-32px_rgba(16,32,58,0.35)]">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-muted">Topic check · Example</p>
                <span className="rounded-full bg-mint px-2.5 py-1.5 text-xs font-semibold text-brand-dark">Ready to refine</span>
              </div>
              <p className="mt-4 font-serif text-[22px] leading-snug">Mobile money use and saving behaviour among market vendors in Mbale</p>
              <div className="mt-5 grid grid-cols-2 gap-3.5">
                {EXAMPLE_SCORES.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-[#ECECE6] p-3.5">
                    <div className="flex justify-between text-sm font-semibold">
                      <span>{label}</span>
                      <span>{value}/5</span>
                    </div>
                    <div className="mt-2.5 h-1.5 rounded-full bg-[#EEF0EA]">
                      <div className="h-1.5 rounded-full bg-brand" style={{ width: `${value * 20}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                Suggested refinement: define savings as something you can measure, such as how often and how much, and limit the
                study to one market.
              </p>
            </div>
          </div>
        </section>

        {/* Journey */}
        <section id="how" className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">How it works</p>
            <h2 className="mt-3 max-w-2xl font-serif text-4xl font-medium tracking-tight sm:text-[44px]">Five steps. Each one feeds the next.</h2>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
              Whatever you build in one step carries forward, so the full proposal starts from your own thinking, not a blank page.
            </p>
            <JourneyTabs steps={steps} />
          </div>
        </section>

        {/* Services */}
        <section id="services" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">Services</p>
              <h2 className="mt-3 font-serif text-4xl font-medium tracking-tight sm:text-[44px]">Everything a research project needs</h2>
            </div>
            <Link href="/pricing" className="font-semibold text-brand hover:text-brand-dark">Compare prices →</Link>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <Link
                key={s.slug}
                href={serviceHref(s)}
                className="group flex min-h-48 flex-col gap-3 rounded-[18px] border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#C9CCC4] hover:shadow-lg"
              >
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                  <span className={s.group === "tools" ? "text-brand" : "text-[#9A5B10]"}>{s.kind}</span>
                  {s.status === "soon" && <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] normal-case tracking-normal text-[#7A4A0C]">Opening soon</span>}
                </span>
                <span className="font-serif text-2xl font-medium leading-tight">{s.name}</span>
                <span className="text-[15px] leading-relaxed text-ink-soft">{s.short}</span>
                <span className="mt-auto text-sm font-semibold text-brand">{s.price}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section className="bg-ink text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-3">
            {[
              ["References you can check", "Every source is found and confirmed during writing. Anything that could not be fully confirmed is flagged for you, never hidden."],
              ["Your institution's rules", "Length, structure and citation style follow your university's guidelines wherever they can be found."],
              ["Made to be yours", "A plain-language clarity note explains the reasoning and shows exactly where to add your own experience and data."],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="font-serif text-[26px] font-medium">{title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#C7CFDC]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">Pricing</p>
          <h2 className="mt-3 max-w-3xl font-serif text-4xl font-medium tracking-tight sm:text-[44px]">Start free. Pay when you need the full document.</h2>
          <PlanGrid />
          <p className="mt-5 text-sm text-muted">{SINGLE_PRICES} {SITE.payment}</p>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-mint px-8 py-14 sm:px-10">
            <div className="min-w-0 flex-[1_1_420px]">
              <h2 className="font-serif text-4xl font-medium tracking-tight">See your proposal before you pay.</h2>
              <p className="mt-3 text-[17px] text-[#2D3B52]">Every new account gets a free preview of a full research proposal.</p>
            </div>
            <Link href="/register" className="rounded-full bg-ink px-7 py-4 text-base font-semibold text-white hover:bg-[#1c3156]">
              Create a free account
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
