import { SITE, SERVICES, serviceHref } from "@/lib/site/content";
import { getAllPosts } from "@/lib/blog/posts";

export default function sitemap() {
  const pages = ["", "/pricing", "/blog", "/privacy", "/terms", ...SERVICES.map(serviceHref)];
  const posts = getAllPosts().map((p) => ({ url: `${SITE.url}/blog/${p.slug}`, lastModified: p.date ? new Date(`${p.date}T00:00:00Z`) : new Date() }));
  return [...pages.map((path) => ({ url: `${SITE.url}${path}`, lastModified: new Date() })), ...posts];
}
