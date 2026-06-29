import { NextRequest } from "next/server";
import { generateJSON } from "@/lib/gemini";

interface AnalyzeResponse {
  score: number;
  feedback: string;
  followUpQuestion?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { question, answer, category, company, position, resumeText, experienceLevel, interviewerRole, interviewerMood } =
      await request.json();

    const isExperienced = experienceLevel === "경력";

    const categoryLabels: Record<string, string> = {
      tech: "기술",
      job: "직무",
      culture: "컬쳐핏",
      personality: "인성",
      executive: "임원/최종",
      pressure: "압박",
    };

    const roleLabels: Record<string, string> = {
      peer:      "개발자 동료(시니어)",
      manager:   "팀장",
      executive: "임원/CTO",
      hr:        "HR 담당자",
    };
    const moodGuides: Record<string, string> = {
      friendly: "꼬리질문은 부드럽게, 지원자가 더 잘 표현할 수 있도록 유도하는 방향으로 생성하세요.",
      standard: "꼬리질문은 답변의 구체성이 부족한 부분을 자연스럽게 파고드세요.",
      pressure: "꼬리질문은 날카롭게 작성하세요. 논리 허점, 수치 부재, 팀 기여도 과장 등을 직접 지적하며 압박하세요.",
    };

    const resumeContext = resumeText && isExperienced
      ? `\n[지원자 이력서 요약]\n${resumeText}\n`
      : "";

    const followUpGuide = resumeText && isExperienced
      ? `3. 꼬리질문: 반드시 이력서 내용과 연결하여 꼬리질문을 생성하세요.
   - 답변에서 언급한 경험을 이력서의 다른 프로젝트/경력과 연결하여 질문
   - 이력서에 적힌 기술 스택, 성과, 회사 경험을 구체적으로 언급하며 질문
   - "이력서에 ~라고 적으셨는데", "~ 프로젝트에서는 어떠셨나요" 등 이력서 참조 표현 사용
   - 답변이 빈약하면: 이력서 경험 기반으로 구체화 요청
   - 답변이 좋으면: 이력서의 관련 경험으로 심화 질문
   - ${moodGuides[interviewerMood] || moodGuides.standard}`
      : `3. 꼬리질문: 답변 내용을 기반으로 꼬리질문 생성.
   - 답변이 빈약하면: 구체화 요청 질문
   - 답변이 좋으면: 심화 질문
   - 답변이 짧거나 핵심이 없으면: 반드시 꼬리질문 생성
   - ${moodGuides[interviewerMood] || moodGuides.standard}`;

    const prompt = `당신은 ${company}의 ${position} 포지션 ${roleLabels[interviewerRole] || "면접관"}입니다.
면접 유형: ${categoryLabels[category] || category} 면접
${resumeContext}
질문: "${question}"
지원자 답변: "${answer}"

아래 기준으로 답변을 분석하세요:

1. 점수 (1-10): 답변의 구체성, 논리성, 직무 관련성, STAR 구조 적용 여부 고려
2. 피드백: 2-3문장으로 강점과 개선점 포함. 한국어로 작성.
${followUpGuide}

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
