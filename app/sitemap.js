import { SITE, SERVICES, serviceHref } from "@/lib/site/content";

export default function sitemap() {
  const pages = ["", "/pricing", "/privacy", "/terms", ...SERVICES.map(serviceHref)];
  return pages.map((path) => ({ url: `${SITE.url}${path}`, lastModified: new Date() }));
}
