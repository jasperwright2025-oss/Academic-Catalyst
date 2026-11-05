// Reads an uploaded file in the browser and returns its text, so a client can upload a proposal,
// data set or transcript instead of pasting it. Nothing is sent anywhere until they press generate.
// Word (.docx), PDF, Excel (.xlsx), CSV and plain text are supported.

export const ACCEPTED = ".docx,.pdf,.xlsx,.csv,.txt,.md,.tsv";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export class FileReadError extends Error {}

const extension = (name) => String(name).toLowerCase().split(".").pop();

async function readDocx(file) {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

async function readPdf(file) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Keep line breaks where the PDF has them, so paragraphs and table rows stay apart.
    let line = "";
    const lines = [];
    for (const item of content.items) {
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else if (item.str && !item.str.endsWith(" ")) line += " ";
    }
    if (line.trim()) lines.push(line);
    pages.push(lines.join("\n"));
  }
  const text = pages.join("\n\n").replace(/[ \t]+\n/g, "\n");
  if (text.replace(/\s/g, "").length < 50) {
    throw new FileReadError(
      "This PDF has no readable text; it is probably a scan. Upload the Word version, or copy the text and paste it in."
    );
  }
  return text;
}

const cellText = (v) =>
  v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).replace(/\s+/g, " ").trim();

async function readXlsx(file) {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  return sheets
    .filter((s) => s.data?.length)
    .map((s) => {
      // Comma-separated rows; a value containing a comma or quote is quoted.
      const rows = s.data.map((row) =>
        row.map((v) => {
          const t = cellText(v);
          return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
        }).join(",")
      );
      return `Sheet: ${s.sheet}\n${rows.join("\n")}`;
    })
    .join("\n\n");
}

export async function fileToText(file) {
  if (file.size > MAX_FILE_BYTES) throw new FileReadError("This file is larger than 25 MB. Please upload a smaller file.");
  const ext = extension(file.name);
  if (ext === "doc") throw new FileReadError("Old Word files (.doc) cannot be read. In Word, use Save As to save it as .docx, then upload it.");
  if (ext === "xls") throw new FileReadError("Old Excel files (.xls) cannot be read. In Excel, use Save As to save it as .xlsx or .csv, then upload it.");
  try {
    let text;
    if (ext === "docx") text = await readDocx(file);
    else if (ext === "pdf") text = await readPdf(file);
    else if (ext === "xlsx") text = await readXlsx(file);
    else if (["txt", "md", "csv", "tsv"].includes(ext)) text = await file.text();
    else throw new FileReadError("Please upload a Word (.docx), PDF, Excel (.xlsx), CSV or text file.");
    return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch (err) {
    if (err instanceof FileReadError) throw err;
    console.error("File read error:", err);
    throw new FileReadError("This file could not be read. Check that it opens on your computer, or copy the text and paste it in.");
  }
}
