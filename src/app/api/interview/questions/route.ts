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
    const { company, position, interviewTypes, questionCount, resumeText, jdText, experienceLevel } =
      await request.json();

    const isExperienced = experienceLevel === "경력";

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
      if (isExperienced) {
        contextBlock = `
[지원자 이력서]
${resumeText}

[채용공고 요구사항]
${jdText}

이 지원자는 경력직입니다. 이력서를 중심으로 질문을 생성하세요:
1. 이력서 프로젝트/경험 심화 질문 — 구체적 성과, 기술적 의사결정, 문제 해결 과정 (50%)
2. JD 자격요건 대비 이력서 역량 검증 — 이력서 경험이 JD 요구사항에 부합하는지 (20%)
3. 경력 공백/이직 사유/성과 수치 검증 질문 (15%)
4. JD 우대사항 관련 질문 (15%)
비율에 맞춰 질문을 생성하세요.
이력서에 기재된 프로젝트명, 회사명, 기술 스택을 직접 언급하며 질문하세요.
`;
      } else {
        contextBlock = `
[채용공고 요구사항]
${jdText}

[지원자 이력서]
${resumeText}

이 지원자는 신입/주니어입니다. JD 요구사항 중심으로 질문하세요:
1. JD 자격요건 기반 기술/지식 검증 질문 (50%)
2. 이력서 프로젝트/학습 경험 질문 (25%)
3. JD 우대사항 관련 질문 (15%)
4. 성장 가능성/학습 의지 확인 질문 (10%)
비율에 맞춰 질문을 생성하세요.
`;
      }
    } else if (resumeText) {
      contextBlock = `
[지원자 이력서]
${resumeText}

${isExperienced
  ? `경력직 지원자입니다. 이력서에 기재된 경력, 프로젝트, 기술 스택을 중심으로 심화 질문을 생성하세요.
각 프로젝트에서의 구체적 역할, 기술적 의사결정, 성과 수치, 문제 해결 경험을 깊이 파고드세요.
경력 공백, 이직 사유 등도 포함하세요.
이력서에 기재된 프로젝트명, 회사명을 직접 언급하며 질문하세요.`
  : `이력서의 프로젝트, 학습 경험, 기술 스택을 기반으로 질문을 생성하세요.`}
`;
    } else if (jdText) {
      contextBlock = `
[채용공고 요구사항]
${jdText}

채용공고 요구사항을 기반으로 지원자의 역량을 검증할 수 있는 질문을 생성하세요.
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
