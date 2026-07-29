interface Uint8ArrayWithToHex {
  toHex?: () => string;
}

function polyfillUint8ArrayToHex() {
  const proto = Uint8Array.prototype as Uint8ArrayWithToHex;
  if (typeof proto.toHex !== "function") {
    proto.toHex = function (this: Uint8Array) {
      let hex = "";
      for (let i = 0; i < this.length; i++) {
        hex += this[i].toString(16).padStart(2, "0");
      }
      return hex;
    };
  }
}

export async function extractPdfText(file: File): Promise<string> {
  polyfillUint8ArrayToHex();

  const pdfjsLib = await import("pdfjs-dist");

  // Use CDN URL for the worker.
  // new URL("pdfjs-dist/...", import.meta.url) resolves incorrectly in
  // Next.js static exports, causing worker load failures on mobile.
  // The CDN URL is reliable across all browsers and network conditions.
  const version = (pdfjsLib as unknown as { version?: string }).version ?? "5.7.284";
  const workerUrl = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  } catch (firstErr) {
    // CDN worker failed (network issue or old browser). Fall back to
    // fake-worker mode which runs on the main thread (slower but compatible).
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
      pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    } catch {
      throw firstErr;
    }
  }

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n");
}
