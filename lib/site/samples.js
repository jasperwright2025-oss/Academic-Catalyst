// Sample excerpts for each academic level, kept as Markdown in content/samples/<level>.md.
// Front matter: title, document, programme, words, references, generated.
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { LEVELS } from "@/lib/payments/levels";

const DIR = path.join(process.cwd(), "content", "samples");

export function getSample(level) {
  if (!LEVELS.includes(level)) return null;
  const file = path.join(DIR, `${level}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = {};
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(":");
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return { level, ...meta, html: marked.parse(m ? m[2] : raw) };
}

export function availableSamples() {
  return LEVELS.filter((l) => fs.existsSync(path.join(DIR, `${l}.md`)));
}
