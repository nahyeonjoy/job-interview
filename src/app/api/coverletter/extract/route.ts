import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "파일이 없습니다" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse");
    const pdfData = await pdfParse(buffer);
    const rawText = pdfData.text;

    if (!rawText || rawText.trim().length < 10) {
      return Response.json(
        { error: "PDF에서 텍스트를 추출할 수 없습니다. 다른 파일을 시도하세요." },
        { status: 400 }
      );
    }

    return Response.json({ rawText: rawText.slice(0, 8000) });
  } catch (error) {
    console.error("Cover letter extraction failed:", error);
    return Response.json({ error: "자기소개서 텍스트 추출에 실패했습니다." }, { status: 500 });
  }
}
