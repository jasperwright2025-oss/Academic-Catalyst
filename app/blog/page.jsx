import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { getAllPosts, formatDate } from "@/lib/blog/posts";

export const metadata = {
  title: "Blog: practical guides to research proposals",
  description:
    "Plain, practical guides for postgraduate students: choosing and testing a topic, writing objectives, building a literature review and choosing a methodology.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  const posts = getAllPosts();
  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-14 sm:pt-20">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">Blog</p>
        <h1 className="mt-3 font-serif text-5xl font-medium leading-[1.06] tracking-tight">Practical guides to research proposals</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
          One stage at a time: testing a topic, writing objectives, mapping the literature and planning your methods. Each guide comes with a free tool you can try on your own topic.
        </p>

        {posts.length === 0 ? (
          <p className="mt-14 rounded-2xl border border-line bg-white p-6 text-ink-soft">The first guides are on their way. In the meantime, try the free tools from the menu.</p>
        ) : (
          <ul className="mt-14 divide-y divide-line border-y border-line">
            {posts.map((p) => (
              <li key={p.slug} className="py-8">
                <p className="text-sm text-muted">
                  {formatDate(p.date)} · {p.minutes} min read
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium tracking-tight">
                  <Link href={`/blog/${p.slug}`} className="hover:text-brand">{p.title}</Link>
                </h2>
                {p.description && <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">{p.description}</p>}
                <Link href={`/blog/${p.slug}`} className="mt-4 inline-block font-semibold text-brand hover:text-brand-dark">Read the guide →</Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
