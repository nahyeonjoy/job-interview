import { NextRequest } from "next/server";
import { generateJSON } from "@/lib/gemini";

interface AnalyzeResponse {
  score: number;
  feedback: string;
  followUpQuestion?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { question, answer, category, company, position } =
      await request.json();

    const categoryLabels: Record<string, string> = {
      tech: "기술",
      job: "직무",
      culture: "컬쳐핏",
      personality: "인성",
      executive: "임원/최종",
      pressure: "압박",
    };

    const prompt = `당신은 ${company}의 ${position} 포지션 면접관입니다.
면접 유형: ${categoryLabels[category] || category} 면접

질문: "${question}"
지원자 답변: "${answer}"

아래 기준으로 답변을 분석하세요:

1. 점수 (1-10): 답변의 구체성, 논리성, 직무 관련성, STAR 구조 적용 여부 고려
2. 피드백: 2-3문장으로 강점과 개선점 포함. 한국어로 작성.
3. 꼬리질문: 답변 내용을 기반으로 꼬리질문 생성.
   - 답변이 빈약하면: 구체화 요청 질문
   - 답변이 좋으면: 심화 질문
   - 답변이 짧거나 핵심이 없으면: 반드시 꼬리질문 생성

JSON 형식으로 응답하세요:
{
  "score": 7,
  "feedback": "피드백 내용",
  "followUpQuestion": "꼬리질문 (없으면 null)"
}`;

    const data = await generateJSON<AnalyzeResponse>(prompt);

    // Clamp score to 1-10
    data.score = Math.max(1, Math.min(10, Math.round(data.score)));

    return Response.json(data);
  } catch (error) {
    console.error("Answer analysis failed:", error);
    return Response.json(
      { error: "답변 분석 실패", fallback: true },
      { status: 500 }
    );
  }
}
