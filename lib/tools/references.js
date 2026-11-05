// References and exports built in code from database records (used on the server and in the browser).

function apaAuthor(name) {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts.pop();
  const initials = parts.map((p) => `${p[0].toUpperCase()}.`).join(" ");
  return `${last}, ${initials}`;
}

function apaAuthors(authors) {
  const list = authors.map(apaAuthor);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length <= 20) return `${list.slice(0, -1).join(", ")}, & ${list[list.length - 1]}`;
  return `${list.slice(0, 19).join(", ")}, ... ${list[list.length - 1]}`;
}

// APA 7th edition reference for a journal article (the common case).
export function apaReference(p) {
  const authors = apaAuthors(p.authors);
  const year = p.year ? `(${p.year})` : "(n.d.)";
  const title = p.title.replace(/\.$/, "");
  let source = "";
  if (p.journal) {
    source = ` *${p.journal}*`;
    if (p.volume) source += `, *${p.volume}*`;
    if (p.issue) source += `(${p.issue})`;
    if (p.pages) source += `, ${p.pages}`;
    source += ".";
  }
  const link = p.doi ? ` https://doi.org/${p.doi}` : p.landing_url ? ` ${p.landing_url}` : "";
  return `${authors ? `${authors} ` : ""}${year}. ${title}.${source}${link}`.replace(/\s+/g, " ").trim();
}

// In-text citation, e.g. (Nakato & Okello, 2021) or (Nakato et al., 2021).
export function inTextCitation(p) {
  const last = (n) => String(n).trim().split(/\s+/).pop();
  const a = p.authors;
  const who = a.length === 0 ? p.title.split(" ").slice(0, 3).join(" ") : a.length === 1 ? last(a[0]) : a.length === 2 ? `${last(a[0])} & ${last(a[1])}` : `${last(a[0])} et al.`;
  return `${who}, ${p.year || "n.d."}`;
}

export function risExport(papers) {
  return papers
    .map((p) =>
      [
        "TY  - JOUR",
        ...p.authors.map((a) => `AU  - ${a}`),
        `TI  - ${p.title}`,
        p.journal && `JO  - ${p.journal}`,
        p.year && `PY  - ${p.year}`,
        p.volume && `VL  - ${p.volume}`,
        p.issue && `IS  - ${p.issue}`,
        p.pages && `SP  - ${p.pages}`,
        p.doi && `DO  - ${p.doi}`,
        p.landing_url && `UR  - ${p.landing_url}`,
        p.abstract && `AB  - ${p.abstract}`,
        "ER  - ",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

export function bibtexExport(papers) {
  const esc = (s) => String(s).replace(/[{}]/g, "");
  return papers
    .map((p) => {
      const key = `${(p.authors[0] || "anon").split(/\s+/).pop().replace(/[^A-Za-z]/g, "")}${p.year || ""}${p.id}`;
      const fields = [
        `  title = {${esc(p.title)}}`,
        p.authors.length && `  author = {${p.authors.map(esc).join(" and ")}}`,
        p.journal && `  journal = {${esc(p.journal)}}`,
        p.year && `  year = {${p.year}}`,
        p.volume && `  volume = {${p.volume}}`,
        p.issue && `  number = {${p.issue}}`,
        p.pages && `  pages = {${p.pages.replace("–", "--")}}`,
        p.doi && `  doi = {${p.doi}}`,
      ].filter(Boolean);
      return `@article{${key},\n${fields.join(",\n")}\n}`;
    })
    .join("\n\n");
}
