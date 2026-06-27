import { NextRequest } from "next/server";
import { generateJSON } from "@/lib/gemini";

interface GeneratedQuestion {
  question: string;
  category: string;
}

interface QuestionsResponse {
  questions: GeneratedQuestion[];
}

export async function POST(request: NextRequest) {
  try {
    const { company, position, interviewTypes, questionCount, resumeText, jdText } =
      await request.json();

    const typeLabels: Record<string, string> = {
      tech: "기술 면접",
      job: "직무 면접",
      culture: "컬쳐핏 면접",
      personality: "인성 면접",
      executive: "임원/최종 면접",
      pressure: "압박 면접",
    };

    const typeNames = (interviewTypes as string[])
      .map((t) => typeLabels[t] || t)
      .join(", ");

    let contextBlock = "";

    if (resumeText && jdText) {
      contextBlock = `
[채용공고 요구사항]
${jdText}

[지원자 이력서]
${resumeText}

채용공고의 요구사항과 지원자의 이력서를 대조하여:
1. JD 자격요건 대비 지원자 역량 검증 질문 (40%)
2. 이력서 프로젝트/경험 심화 질문 (30%)
3. JD 우대사항 관련 질문 (20%)
4. 경력 공백/이직 등 확인 질문 (10%)
비율에 맞춰 질문을 생성하세요.
`;
    } else if (jdText) {
      contextBlock = `
[채용공고 요구사항]
${jdText}

채용공고 요구사항을 기반으로 지원자의 역량을 검증할 수 있는 질문을 생성하세요.
`;
    } else if (resumeText) {
      contextBlock = `
[지원자 이력서]
${resumeText}

이력서의 경력, 프로젝트, 기술 스택을 기반으로 심화 질문을 생성하세요.
경력 공백, 이직 사유, 성과 수치 검증 등도 포함하세요.
`;
    }

    const prompt = `당신은 ${company}의 ${position} 포지션 면접관입니다.
다음 유형의 면접 질문을 총 ${questionCount}개 생성하세요: ${typeNames}
${contextBlock}
요구사항:
- 각 질문은 해당 회사와 직무에 맞춰 구체적이고 실무적이어야 합니다
- 질문 유형별로 골고루 분배하세요
- 한국어로 작성하세요
- 각 질문은 면접관이 직접 묻는 자연스러운 말투로 작성하세요

가능한 category 값: ${interviewTypes.join(", ")}

JSON 형식으로 응답하세요:
{
  "questions": [
    { "question": "질문 내용", "category": "카테고리" }
  ]
}`;

    const data = await generateJSON<QuestionsResponse>(prompt);
    return Response.json(data);
  } catch (error) {
    console.error("Question generation failed:", error);
    return Response.json(
      { error: "질문 생성 실패", fallback: true },
      { status: 500 }
    );
  }
}
