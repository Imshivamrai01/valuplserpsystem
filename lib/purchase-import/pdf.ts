// Must come before the `pdf-parse` import below — this registers pdf-parse's
// own worker/canvas setup that its underlying pdfjs-dist engine needs. Without
// it, pdfjs-dist reaches for the browser's DOMMatrix/DOMPoint/DOMRect globals
// for its text-transform math and there's nothing in Node to answer ("DOMMatrix
// is not defined"). This is pdf-parse's own documented fix for Node/serverless
// use, not a hand-rolled polyfill — see its Next.js/Vercel troubleshooting
// guide. `next.config.mjs`'s `serverExternalPackages` must also list
// "@napi-rs/canvas" alongside "pdf-parse", or webpack bundling this package
// for the server route can still leave CanvasFactory unable to resolve it.
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

/**
 * Break one extracted text line into cells resolveRows() can read as
 * name / quantity / rate / amount.
 *
 *   "LED TV 43 inch    5    20,000.00    100,000.00"  -> multi-space gaps
 *   "LED TV 43 inch 5 20000 100000"                    -> trailing numbers
 */
function splitPdfTextLine(line: string): string[] {
  const byGaps = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
  if (byGaps.length >= 2) return byGaps;

  // Lookbehind/lookahead keep this from matching the "14" inside a model
  // number like "M14" — only a token with no letter directly touching it
  // counts as a quantity/rate/amount. matchAll (not match) is used so each
  // hit keeps its position in the string — a plain string search for "where
  // does the last number start" would find the FIRST occurrence of that same
  // digit sequence if it also appears earlier in the line (a quantity "2"
  // reappearing inside a later price, for instance), slicing the name in the
  // wrong place.
  const numberToken = /(?<![A-Za-z])-?[\d,]+\.?\d*(?![A-Za-z])/g;
  const matches = [...line.matchAll(numberToken)];
  if (matches.length === 0) return [line];

  // A product description often carries its own standalone number — "55
  // Inch", "1.5 Ton" — indistinguishable from a real qty/rate/amount by value
  // alone. Only the trailing run is trusted to be the numeric columns; taking
  // the name up to where THAT run starts (not the position of the very last
  // number substring) is what keeps an earlier "55" inside the name instead
  // of truncating everything after it.
  const trailingCount = Math.min(matches.length, 3);
  const firstTrailing = matches[matches.length - trailingCount];
  const name = line.slice(0, firstTrailing.index).trim();
  const trailing = matches.slice(-trailingCount).map((m) => m[0]);

  return name ? [name, ...trailing] : [line];
}

/**
 * Read a PDF into the same kind of raw grid extractRowsFromExcel() produces,
 * so both feed the identical resolveRows() logic.
 *
 * Only text-based PDFs are supported — a scanned or photographed invoice has
 * no text layer for pdf-parse to read, and this deliberately does not fall
 * back to OCR (that belongs to a different, paid extraction path, not this
 * free one). `usedTableExtraction: false` tells the caller which case this
 * was, so the UI can say plainly that a scanned document isn't supported
 * rather than silently returning nothing.
 */
export async function extractRowsFromPdf(
  buffer: Buffer
): Promise<{ grid: string[][]; usedTableExtraction: boolean; rawText: string }> {
  const parser = new PDFParse({ data: buffer, CanvasFactory });

  try {
    // A real table structure, when pdf-parse can find one, is far more
    // reliable than guessing columns from flat text — column boundaries are
    // taken from the PDF's own layout instead of inferred from whitespace.
    const tableResult = await parser.getTable();
    const tables = tableResult.mergedTables || [];
    const biggest = tables.reduce<string[][] | null>((best, t) => {
      if (!best || t.length > best.length) return t;
      return best;
    }, null);

    if (biggest && biggest.length >= 2 && biggest[0].length >= 2) {
      return { grid: biggest, usedTableExtraction: true, rawText: "" };
    }

    // No usable table — fall back to line-by-line text. resolveRows() still
    // needs the numbers split into their own cells to find quantity and rate,
    // so each line is split here before handing it over: first by wherever
    // the PDF's own multi-space column gaps survived extraction, and where a
    // line came through as one unbroken run of text, by peeling the trailing
    // numeric tokens (qty / rate / amount) off the end of it instead.
    const textResult = await parser.getText();
    const lines = (textResult.text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const grid = lines.map((line) => splitPdfTextLine(line));

    return { grid, usedTableExtraction: false, rawText: textResult.text || "" };
  } finally {
    await parser.destroy();
  }
}
