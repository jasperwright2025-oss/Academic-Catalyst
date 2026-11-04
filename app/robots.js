import { SITE } from "@/lib/site/content";

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
