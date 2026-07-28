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
  // pdf.js internally calls the brand-new native Uint8Array.prototype.toHex()
  // with no fallback, which crashes on browsers that don't support it yet.
  // Polyfill it on the main thread and inject the same polyfill into the
  // worker's own realm (a Worker does not inherit main-thread prototype patches).
  polyfillUint8ArrayToHex();

  const pdfjsLib = await import("pdfjs-dist");
  // Turbopack resolves this to a root-relative path (e.g. "/job-interview/...").
  // That's a valid Worker() argument (resolved against the page), but dynamic
  // import() inside the blob-URL shim below resolves against the blob itself,
  // not the page, so it must be made fully absolute first.
  const workerPath = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  const workerUrl = new URL(workerPath, window.location.href).toString();
  // Invoke via an IIFE rather than by name: minification may rename the
  // function, so referencing it by its original identifier here would throw.
  // Use a static import (not dynamic import()) for the real worker script:
  // some browsers (older/mobile Safari) support module workers but not
  // dynamic import() from inside one, and a static import with a literal
  // specifier works everywhere a module worker itself works.
  const shimSource = `(${polyfillUint8ArrayToHex.toString()})();\nimport ${JSON.stringify(workerUrl)};`;
  const shimBlob = new Blob([shimSource], { type: "text/javascript" });
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(shimBlob);

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

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
