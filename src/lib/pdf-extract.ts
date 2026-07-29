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
    // Apply polyfill on the main thread
  polyfillUint8ArrayToHex();

  const pdfjsLib = await import("pdfjs-dist");
    const workerPath = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
    const workerUrl = new URL(workerPath, window.location.href).toString();

  // Try blob shim first (injects polyfill into worker realm).
  // Some mobile browsers (older iOS Safari) restrict blob URL module workers,
  // so fall back to the direct worker URL if blob creation fails.
  let blobWorkerSrc: string | null = null;
    try {
          const shimSource = `(${polyfillUint8ArrayToHex.toString()})();\nimport ${JSON.stringify(workerUrl)};`;
          const shimBlob = new Blob([shimSource], { type: "text/javascript" });
          blobWorkerSrc = URL.createObjectURL(shimBlob);
          pdfjsLib.GlobalWorkerOptions.workerSrc = blobWorkerSrc;
    } catch {
          // Blob URL creation failed — use direct worker URL
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    }

  const buffer = await file.arrayBuffer();

  let pdf;
    try {
          pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    } catch (firstErr) {
          // If the blob worker failed at runtime, retry with the direct worker URL.
      // Modern mobile browsers (iOS 17.4+, Chrome 121+) have native toHex support,
      // so the direct URL will work without the polyfill shim.
      if (blobWorkerSrc !== null) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
              try {
                        pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
              } catch {
                        throw firstErr;
              }
      } else {
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
