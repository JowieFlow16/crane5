// Server-only: turn an uploaded document (txt / md / csv / json / docx / pptx /
// pdf) into clean plain text that Crane5 can learn from.

import { unzipSync, strFromU8 } from "fflate";

export interface FileLesson {
  text: string;
  kind: string;
}

const MAX_TEXT = 120_000;

function tidy(s: string): string {
  return s
    .replace(/\r/g, "")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function xmlToText(xml: string): string {
  return tidy(
    xml
      .replace(/<\/w:p>|<\/a:p>|<w:br\s*\/>/g, "\n")
      .replace(/<\/w:tr>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

/** Word (.docx) and PowerPoint (.pptx) are zip archives of XML parts. */
function officeToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const parts: string[] = [];
  const names = Object.keys(files)
    .filter((n) => /^word\/document\.xml$|^word\/(header|footer)\d*\.xml$|^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort();
  for (const name of names) parts.push(xmlToText(strFromU8(files[name])));
  return tidy(parts.join("\n\n"));
}

/** Ask Crane5's own vision-capable models to transcribe a PDF faithfully. */
async function pdfToText(filename: string, dataUrl: string): Promise<string> {
  const { callAI } = await import("./ai-gateway.server");
  const raw = await callAI({
    task: "ADMIN_CONTENT",
    capability: "vision",
    messages: [
      {
        role: "system",
        content:
          "You transcribe curriculum documents for a study knowledge base. Output the document's full text content in clean Markdown: keep headings, numbered items, tables (as Markdown tables) and formulae (LaTeX). Do not summarise, do not add commentary.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Transcribe this document completely: ${filename}` },
          { type: "file", file: { filename, file_data: dataUrl } },
        ],
      },
    ],
  });
  return tidy(raw);
}

/**
 * Extract learnable text from a document supplied as a base64 data URL.
 * Throws a human-readable error when nothing readable can be recovered.
 */
export async function extractFileText(input: {
  filename: string;
  mimeType: string;
  dataUrl: string;
}): Promise<FileLesson> {
  const name = input.filename.toLowerCase();
  const mime = input.mimeType.toLowerCase();

  let text = "";
  let kind = "document";

  if (/^text\/|json|csv|xml|markdown|yaml/.test(mime) || /\.(txt|md|csv|json|xml|ya?ml)$/.test(name)) {
    text = tidy(strFromU8(base64ToBytes(input.dataUrl)));
    kind = "text file";
  } else if (/officedocument|msword|powerpoint/.test(mime) || /\.(docx|pptx)$/.test(name)) {
    text = officeToText(base64ToBytes(input.dataUrl));
    kind = /\.pptx$/.test(name) ? "slides" : "word document";
  } else if (mime.includes("pdf") || /\.pdf$/.test(name)) {
    text = await pdfToText(input.filename, input.dataUrl);
    kind = "pdf";
  } else if (/\.doc$/.test(name)) {
    throw new Error("Old .doc files aren't supported — save it as .docx or PDF and try again.");
  } else {
    // Last resort: treat it as plain text.
    text = tidy(strFromU8(base64ToBytes(input.dataUrl)).replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " "));
  }

  if (text.length < 200) {
    throw new Error("Couldn't read enough text out of that file. Try a PDF or .docx version.");
  }
  return { text: text.slice(0, MAX_TEXT), kind };
}
