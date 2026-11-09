import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { getAllPosts, getPost, formatDate } from "@/lib/blog/posts";
import { SITE, serviceBySlug, serviceHref } from "@/lib/site/content";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { title: p.title, description: p.description, type: "article", url: `${SITE.url}/blog/${p.slug}`, publishedTime: p.date },
    twitter: { card: "summary_large_image", title: p.title, description: p.description },
  };
}

export default async function BlogPost({ params }) {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) notFound();
  const tool = p.tool ? serviceBySlug(p.tool) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: p.title,
    description: p.description,
    datePublished: p.date,
    dateModified: p.date,
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url, logo: { "@type": "ImageObject", url: `${SITE.url}/brand/profile.png` } },
    mainEntityOfPage: `${SITE.url}/blog/${p.slug}`,
  };

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-14 sm:pt-20">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/" className="hover:text-brand">Home</Link> / <Link href="/blog" className="hover:text-brand">Blog</Link>
        </nav>
        <h1 className="mt-6 font-serif text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl">{p.title}</h1>
        <p className="mt-4 text-sm text-muted">
          {formatDate(p.date)} · {p.minutes} min read · Academic Catalyst
        </p>

        <article className="blog-body mt-10" dangerouslySetInnerHTML={{ __html: p.html }} />

        {tool && (
          <aside className="mt-14 rounded-[20px] border border-line bg-white p-7 shadow-[0_24px_48px_-32px_rgba(16,32,58,0.35)]">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">Try it on your own topic</p>
            <p className="mt-2 font-serif text-2xl font-medium">{tool.name}</p>
            <p className="mt-2 leading-relaxed text-ink-soft">{tool.short}</p>
            <Link href={serviceHref(tool)} className="mt-5 inline-block rounded-full bg-brand px-6 py-3.5 font-semibold text-white hover:bg-brand-dark">
              Open the {tool.name}
            </Link>
          </aside>
        )}

        <p className="mt-12 border-t border-line pt-6 text-sm text-muted">
          <Link href="/blog" className="font-semibold text-brand hover:text-brand-dark">← All guides</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
