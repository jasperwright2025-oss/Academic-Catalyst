// Blog posts are Markdown files in content/blog/<slug>.md with a small front-matter block:
// ---
// title: How to test whether your research topic is any good
// description: One or two sentences for search results (max ~155 characters).
// date: 2026-11-09
// tool: topic-validator        (optional: slug of the free tool the post points to)
// tags: topic, proposal        (optional, comma-separated)
// draft: false                 (optional: true hides the post)
// ---
// Body in Markdown.
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const DIR = path.join(process.cwd(), "content", "blog");

function parse(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = {};
  let body = raw;
  if (m) {
    body = m[2];
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(":");
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return { meta, body };
}

function load(file) {
  const slug = file.replace(/\.md$/, "");
  const { meta, body } = parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  const words = body.split(/\s+/).filter(Boolean).length;
  return {
    slug,
    title: meta.title || slug,
    description: meta.description || "",
    date: meta.date || "",
    tool: meta.tool || "",
    tags: (meta.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
    draft: meta.draft === "true",
    minutes: Math.max(1, Math.round(words / 220)),
    body,
  };
}

export function getAllPosts() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map(load)
    .filter((p) => !p.draft)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const file = `${slug}.md`;
  if (!fs.existsSync(path.join(DIR, file))) return null;
  const post = load(file);
  if (post.draft) return null;
  return { ...post, html: marked.parse(post.body, { gfm: true }) };
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
