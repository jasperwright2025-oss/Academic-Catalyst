// Turns a generated Markdown document into a formatted Word (.docx) file:
// a cover page, a real table of contents, heading styles, tables, lists and page numbers.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
  ExternalHyperlink,
} from "docx";
import { marked } from "marked";

const FONT = "Times New Roman";
const BODY_SIZE = 24; // half-points: 12 pt
const LINE_15 = 360; // 1.5 line spacing
const NUMBERING_REF = "ac-numbered";

const decode = (text) =>
  String(text ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

// Inline Markdown (bold, italic, links, code) to Word text runs.
function inlineRuns(tokens, style = {}) {
  const runs = [];
  for (const token of tokens || []) {
    switch (token.type) {
      case "strong":
        runs.push(...inlineRuns(token.tokens, { ...style, bold: true }));
        break;
      case "em":
        runs.push(...inlineRuns(token.tokens, { ...style, italics: true }));
        break;
      case "del":
        runs.push(...inlineRuns(token.tokens, { ...style, strike: true }));
        break;
      case "codespan":
        runs.push(new TextRun({ text: decode(token.text), font: "Consolas", size: 22, ...style }));
        break;
      case "br":
        runs.push(new TextRun({ text: "", break: 1 }));
        break;
      case "link": {
        const children = inlineRuns(token.tokens, { ...style, style: "Hyperlink" });
        runs.push(new ExternalHyperlink({ link: token.href, children: children.length ? children : [new TextRun(token.href)] }));
        break;
      }
      case "escape":
      case "text":
        if (token.tokens?.length) runs.push(...inlineRuns(token.tokens, style));
        else runs.push(new TextRun({ text: decode(token.text), ...style }));
        break;
      case "html":
        // Raw HTML is not rendered; keep any visible text.
        runs.push(new TextRun({ text: decode(String(token.text).replace(/<[^>]+>/g, "")), ...style }));
        break;
      default:
        if (token.text) runs.push(new TextRun({ text: decode(token.text), ...style }));
    }
  }
  return runs;
}

function bodyParagraph(children, extra = {}) {
  return new Paragraph({ children, spacing: { after: 160, line: LINE_15 }, ...extra });
}

const HEADING_FOR_DEPTH = {
  1: HeadingLevel.TITLE,
  2: HeadingLevel.HEADING_1,
  3: HeadingLevel.HEADING_2,
  4: HeadingLevel.HEADING_3,
  5: HeadingLevel.HEADING_4,
  6: HeadingLevel.HEADING_4,
};

function tableBlock(token) {
  const columns = token.header.length || 1;
  const border = { style: BorderStyle.SINGLE, size: 4, color: "8C8C8C" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (cellToken, isHeader) =>
    new TableCell({
      borders,
      shading: isHeader ? { type: ShadingType.CLEAR, fill: "E7ECF5", color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      width: { size: Math.floor(100 / columns), type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          children: inlineRuns(cellToken.tokens, isHeader ? { bold: true, size: 20 } : { size: 20 }),
        }),
      ],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: token.header.map((c) => cell(c, true)) }),
      ...token.rows.map((row) => new TableRow({ children: row.map((c) => cell(c, false)) })),
    ],
  });
}

function listBlocks(token, level = 0, out = []) {
  for (const item of token.items) {
    const [first, ...rest] = item.tokens || [];
    const runs = first ? inlineRuns(first.tokens || [first]) : [];
    out.push(
      new Paragraph({
        children: runs,
        spacing: { after: 80, line: LINE_15 },
        ...(token.ordered ? { numbering: { reference: NUMBERING_REF, level } } : { bullet: { level } }),
      })
    );
    for (const child of rest) {
      if (child.type === "list") listBlocks(child, Math.min(level + 1, 3), out);
      else if (child.tokens) out.push(bodyParagraph(inlineRuns(child.tokens), { indent: { left: 720 * (level + 1) } }));
    }
  }
  return out;
}

const isContentsHeading = (text) => /^(table of )?contents$/i.test(String(text).replace(/[*_`#:]/g, "").trim());

/**
 * Builds the Word file. Returns a Buffer.
 * The text before the first chapter heading (## ...) becomes the cover page.
 * The model's own "Table of Contents" section is replaced by a real Word table of contents.
 */
export async function markdownToDocx(markdown, { title = "Document" } = {}) {
  const tokens = marked.lexer(String(markdown || "").replace(/\r\n/g, "\n"), { gfm: true, breaks: true });
  const children = [];

  // Which Markdown level marks chapters? Documents written with several "#" headings use "#" for
  // chapters; otherwise "#" is only the document title and "##" marks chapters.
  const headings = tokens.filter((t) => t.type === "heading");
  const chapterDepth = headings.filter((t) => t.depth === 1).length >= 2 ? 1 : 2;
  const firstHeading = headings[0];

  let seenChapter = false; // false while still on the cover page
  let skipDepth = 0; // > 0 while skipping the model's written table of contents
  let tocInserted = false;

  const pushToc = () => {
    if (tocInserted) return;
    tocInserted = true;
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Table of Contents", bold: true, size: 30 })],
        pageBreakBefore: true,
        spacing: { after: 200 },
      }),
      new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" })
    );
  };

  for (const token of tokens) {
    if (token.type === "heading") {
      const text = decode(token.text);
      if (skipDepth && token.depth <= skipDepth) skipDepth = 0;
      if (skipDepth) continue;

      if (token.depth <= 3 && isContentsHeading(text)) {
        pushToc();
        skipDepth = token.depth;
        continue;
      }

      // The document title on the cover page.
      if (token === firstHeading && token.depth === 1) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: inlineRuns(token.tokens),
            alignment: AlignmentType.CENTER,
            spacing: { before: 2400, after: 240 },
          })
        );
        continue;
      }

      // Word heading level: chapters are Heading 1, their sections Heading 2, and so on.
      let level = Math.max(1, token.depth - chapterDepth + 1);
      // Front matter before the first chapter (for example an Abstract one level down) is a page of its own.
      const frontMatter = !seenChapter && token.depth <= chapterDepth + 1;
      if (frontMatter) level = 1;
      const startsPage = level === 1;

      if (startsPage && !seenChapter) {
        seenChapter = true;
        // The contents page goes before the first page that follows the cover.
        pushToc();
      }

      children.push(
        new Paragraph({
          heading: HEADING_FOR_DEPTH[level + 1] || HeadingLevel.HEADING_4,
          children: inlineRuns(token.tokens),
          alignment: !seenChapter ? AlignmentType.CENTER : undefined,
          pageBreakBefore: startsPage,
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    if (skipDepth) continue;

    const coverAlign = !seenChapter ? { alignment: AlignmentType.CENTER } : {};
    switch (token.type) {
      case "paragraph":
        children.push(bodyParagraph(inlineRuns(token.tokens), coverAlign));
        break;
      case "list":
        children.push(...listBlocks(token));
        break;
      case "table":
        children.push(tableBlock(token), new Paragraph({ children: [], spacing: { after: 120 } }));
        break;
      case "blockquote":
        for (const inner of token.tokens || []) {
          if (inner.tokens) {
            children.push(
              bodyParagraph(inlineRuns(inner.tokens, { italics: true }), {
                indent: { left: 720, right: 720 },
              })
            );
          }
        }
        break;
      case "code":
        for (const line of String(token.text).split("\n")) {
          children.push(new Paragraph({ children: [new TextRun({ text: line, font: "Consolas", size: 20 })] }));
        }
        break;
      case "hr":
        // Horizontal rules are layout hints from the model; page breaks come from the headings.
        break;
      case "space":
        break;
      default:
        if (token.tokens) children.push(bodyParagraph(inlineRuns(token.tokens), coverAlign));
        else if (token.text) children.push(bodyParagraph([new TextRun(decode(token.text))], coverAlign));
    }
  }

  const doc = new Document({
    title,
    creator: "Academic Catalyst",
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: BODY_SIZE } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { size: 36, bold: true, font: FONT }, paragraph: { spacing: { after: 240 }, alignment: AlignmentType.CENTER } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, font: FONT }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: FONT }, paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, italics: true, font: FONT }, paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 2 } },
        { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, italics: true, font: FONT }, paragraph: { spacing: { before: 120, after: 80 }, outlineLevel: 3 } },
      ],
    },
    numbering: {
      config: [
        {
          reference: NUMBERING_REF,
          levels: [0, 1, 2, 3].map((level) => ({
            level,
            format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN, LevelFormat.DECIMAL][level],
            text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
