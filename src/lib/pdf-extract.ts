// Load PDF.js 3.x from CDN for maximum mobile browser compatibility.
// v3.x has no Uint8Array.toHex dependency and uses classic (non-module) workers,
// making it compatible with iOS 12+ and Android 5+ without any polyfills.

const PDFJS_CDN = "https://unpkg.com/pdfjs-dist@3.11.174/build";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfjsLib = any;

async function loadPdfjsLib(): Promise<PdfjsLib> {
  const win = window as { pdfjsLib?: PdfjsLib };
  if (win.pdfjsLib) return win.pdfjsLib;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PDF.js 로딩 실패"));
    document.head.appendChild(script);
  });

  if (!win.pdfjsLib) throw new Error("PDF.js 로딩 실패 (window.pdfjsLib 없음)");
  return win.pdfjsLib;
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await loadPdfjsLib();
  // Classic (non-module) worker — works on all mobile browsers
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = (content.items as { str?: string }[])
      .map((item) => item.str ?? "")
      .join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n");
}
