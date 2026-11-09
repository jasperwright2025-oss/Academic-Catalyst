import { ImageResponse } from "next/og";
import { getAllPosts, getPost } from "@/lib/blog/posts";

export const alt = "Academic Catalyst guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

// Branded link-preview image for each blog post: deep blue background,
// the post title in amber, the brand line in white.
export default async function Image({ params }) {
  const { slug } = await params;
  const p = getPost(slug);
  const title = p ? p.title : "Academic Catalyst";
  const fontSize = title.length > 70 ? 56 : title.length > 45 ? 66 : 76;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#14306B",
          padding: "70px 80px",
        }}
      >
        <div style={{ display: "flex", color: "#F2A93B", fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>
          FREE GUIDE
        </div>
        <div style={{ display: "flex", color: "#F2A93B", fontSize, fontWeight: 700, lineHeight: 1.15 }}>
          {title}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#FFFFFF", fontSize: 28 }}>
          <div style={{ display: "flex" }}>From a rough idea to a proposal you can defend.</div>
          <div style={{ display: "flex", alignItems: "center", fontWeight: 700 }}>
            <div style={{ display: "flex", width: 12, height: 34, background: "#F2A93B", marginRight: 14 }} />
            Academic Catalyst
          </div>
        </div>
      </div>
    ),
    size
  );
}
