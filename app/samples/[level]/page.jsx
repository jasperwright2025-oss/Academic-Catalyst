import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { getSample, availableSamples } from "@/lib/site/samples";
import { LEVEL_LABELS } from "@/lib/payments/levels";
import { SITE } from "@/lib/site/content";

export function generateStaticParams() {
  return availableSamples().map((level) => ({ level }));
}

export async function generateMetadata({ params }) {
  const { level } = await params;
  const s = getSample(level);
  if (!s) return {};
  const title = `Sample ${s.document?.toLowerCase() || "document"}: ${LEVEL_LABELS[level]}`;
  return {
    title,
    description: `Pages from a sample ${LEVEL_LABELS[level].toLowerCase()} ${s.document?.toLowerCase()} made with Academic Catalyst, so you can see the structure and depth before you buy.`,
    alternates: { canonical: `/samples/${level}` },
    openGraph: { title, url: `${SITE.url}/samples/${level}` },
  };
}

export default async function SamplePage({ params }) {
  const { level } = await params;
  const s = getSample(level);
  if (!s) notFound();
  const others = availableSamples().filter((l) => l !== level);

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-14 sm:pt-20">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/" className="hover:text-brand">Home</Link> / <Link href="/pricing" className="hover:text-brand">Pricing</Link> / Samples
        </nav>
        <p className="mt-6 text-[13px] font-semibold uppercase tracking-wider text-brand">{LEVEL_LABELS[level]}</p>
        <h1 className="mt-2 font-serif text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl">{s.title}</h1>
        <p className="mt-4 text-sm text-muted">
          {[`Sample ${s.document?.toLowerCase()}`, s.programme, s.words && `${s.words} words in the main body`, s.references && `${s.references} references`].filter(Boolean).join(" · ")}
        </p>

        <aside className="mt-8 rounded-[18px] border border-amber bg-[#FFF8EC] p-5 text-sm leading-relaxed text-ink-soft">
          <strong className="text-ink">This is a sample.</strong> The topic and student are invented, and any data shown is
          illustrative. We show selected pages so you can judge the structure and depth for your level. Every document
          Academic Catalyst prepares is a draft for you to complete: you check each source, add what only you
          can add, rewrite in your own words and follow your institution&apos;s rules on AI assistance.
        </aside>

        <article className="blog-body mt-10" dangerouslySetInnerHTML={{ __html: s.html }} />

        <div className="mt-14 rounded-[20px] border border-line bg-white p-7">
          <p className="font-serif text-2xl font-medium">Prices for every level</p>
          <p className="mt-2 leading-relaxed text-ink-soft">See what each level includes and what it costs, in shillings and dollars.</p>
          <Link href="/pricing" className="mt-5 inline-block rounded-full bg-brand px-6 py-3.5 font-semibold text-white hover:bg-brand-dark">
            See pricing
          </Link>
        </div>

        {others.length > 0 && (
          <p className="mt-8 text-sm text-muted">
            Other samples:{" "}
            {others.map((l, i) => (
              <span key={l}>
                {i > 0 && " · "}
                <Link href={`/samples/${l}`} className="font-semibold text-brand hover:text-brand-dark">{LEVEL_LABELS[l]}</Link>
              </span>
            ))}
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
