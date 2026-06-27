import { NextRequest } from "next/server";
import { generateJSON } from "@/lib/gemini";

interface ResumeAnalysis {
  name: string;
  experience: string[];
  projects: { name: string; description: string; tech: string[] }[];
  skills: string[];
  weakPoints: string[];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "파일이 없습니다" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // pdf-parse v1: import from lib directly to avoid test file issue
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

    const prompt = `다음은 지원자의 이력서 텍스트입니다. 분석하여 JSON으로 반환하세요.

[이력서 텍스트]
${rawText.slice(0, 8000)}

다음 형식으로 응답하세요:
{
  "name": "지원자 이름",
  "experience": ["회사명 - 직무 (기간)", ...],
  "projects": [
    { "name": "프로젝트명", "description": "프로젝트 설명 (1-2문장)", "tech": ["사용 기술1", "기술2"] }
  ],
  "skills": ["기술1", "기술2", ...],
  "weakPoints": ["면접에서 질문이 나올 수 있는 약점/공격 포인트 1", ...]
}

요구사항:
- 이름이 명시되지 않으면 "지원자"로 설정
- experience는 최신순으로 정렬
- projects는 주요 프로젝트 최대 5개
- skills는 기술 스택만 추출 (Java, Python, React 등)
- weakPoints는 면접관 관점에서 질문할 만한 포인트 (경력 공백, 짧은 이직 주기, 모호한 성과 등) 최대 5개`;

    const analysis = await generateJSON<ResumeAnalysis>(prompt, 30000);

    return Response.json({
      ...analysis,
      rawText: rawText.slice(0, 10000),
    });
  } catch (error) {
    console.error("Resume analysis failed:", error);

    const message =
      error instanceof Error && error.message.includes("timeout")
        ? "AI 분석 시간이 초과되었습니다. 다시 시도하세요."
        : "이력서 분석에 실패했습니다.";

    return Response.json({ error: message, fallback: true }, { status: 500 });
  }
}
