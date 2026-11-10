import { SITE, SERVICES, serviceHref } from "@/lib/site/content";
import { getAllPosts } from "@/lib/blog/posts";
import { availableSamples } from "@/lib/site/samples";

export default function sitemap() {
  const pages = ["", "/pricing", "/blog", "/privacy", "/terms", ...SERVICES.map(serviceHref), ...availableSamples().map((l) => `/samples/${l}`)];
  const posts = getAllPosts().map((p) => ({ url: `${SITE.url}/blog/${p.slug}`, lastModified: p.date ? new Date(`${p.date}T00:00:00Z`) : new Date() }));
  return [...pages.map((path) => ({ url: `${SITE.url}${path}`, lastModified: new Date() })), ...posts];
}
