import Link from "next/link";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { SITE, serviceBySlug, serviceHref } from "@/lib/site/content";

export default function ServicePage({ service: s }) {
  const next = s.next ? serviceBySlug(s.next) : null;
  const live = s.status === "live";
  const crumb = s.group === "tools" ? "Tools" : "Services";

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <SiteHeader />
      <main>
        <section className="mx-auto flex max-w-6xl flex-wrap items-start gap-12 px-6 pb-16 pt-14 sm:pt-20">
          <div className="min-w-0 flex-[1_1_520px]">
            <nav aria-label="Breadcrumb" className="text-sm text-muted">
              <Link href="/" className="hover:text-brand">Home</Link> / <span>{crumb}</span> / <span aria-current="page">{s.name}</span>
            </nav>
            <p className="mt-7 text-[13px] font-semibold uppercase tracking-wider text-brand">
              {s.step ? `Step ${s.step} of 5 · ` : ""}{s.kind}
            </p>
            <h1 className="mt-3 font-serif text-5xl font-medium leading-[1.06] tracking-tight sm:text-[56px]">{s.headline}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">{s.intro}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={live ? "/register" : "/register?interest=" + s.slug} className="rounded-full bg-brand px-6 py-4 font-semibold text-white transition hover:bg-brand-dark">
                {live ? (s.group === "tools" ? `Try the ${s.name} free` : "Start free") : "Create a free account"}
              </Link>
              <span className="text-sm font-semibold text-ink-soft">{s.price}</span>
            </div>
            {!live && (
              <p className="mt-4 inline-block rounded-xl bg-sand px-4 py-2.5 text-sm text-[#7A4A0C]">
                Opening soon. Create a free account now and it will be waiting in your dashboard.
              </p>
            )}
          </div>

          <div className="min-w-0 flex-[1_1_380px] rounded-[20px] border border-line bg-white p-7 shadow-[0_24px_48px_-32px_rgba(16,32,58,0.35)]">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-muted">What you get</p>
            <ul className="mt-4 space-y-3.5">
              {s.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[15px] leading-relaxed">
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 flex-none">
                    <circle cx="10" cy="10" r="9" fill="#E3F2EE" />
                    <path d="M6 10.5l2.5 2.5L14 7.5" fill="none" stroke="#0E7C66" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="font-serif text-4xl font-medium tracking-tight">How it works</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {s.how.map(([title, body], i) => (
                <li key={title} className="border-t-2 border-ink pt-5">
                  <p className="text-sm font-bold text-brand">{String(i + 1).padStart(2, "0")}</p>
                  <p className="mt-2 text-lg font-semibold">{title}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{body}</p>
                </li>
              ))}
            </ol>
            {s.note && <p className="mt-8 max-w-3xl text-sm text-muted">{s.note}</p>}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          {next ? (
            <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-ink px-8 py-12 text-white sm:px-10">
              <div className="min-w-0 flex-[1_1_420px]">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-amber">Next step</p>
                <h2 className="mt-2.5 font-serif text-3xl font-medium sm:text-[34px]">{next.name}</h2>
                <p className="mt-2 text-[#C7CFDC]">{next.short}</p>
              </div>
              <Link href={serviceHref(next)} className="rounded-full bg-white px-6 py-4 font-semibold text-ink hover:bg-mint">
                See the {next.name}
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-mint px-8 py-12 sm:px-10">
              <div className="min-w-0 flex-[1_1_420px]">
                <h2 className="font-serif text-3xl font-medium sm:text-[34px]">Ready when you are.</h2>
                <p className="mt-2 text-[#2D3B52]">{SITE.payment}</p>
              </div>
              <Link href="/pricing" className="rounded-full bg-ink px-6 py-4 font-semibold text-white">See pricing</Link>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
