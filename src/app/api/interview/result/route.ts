import { NextRequest } from "next/server";
import { generateJSON } from "@/lib/gemini";

interface QAItem {
  question: string;
  answer: string;
  category: string;
  score: number;
  feedback: string;
}

interface ResultResponse {
  totalScore: number;
  grade: string;
  passRate: string;
  scores: {
    content: number;
    logic: number;
    technical: number;
    communication: number;
    voice: number;
    fit: number;
  };
  strengths: string[];
  improvements: string[];
  overallFeedback: string;
}

export async function POST(request: NextRequest) {
  try {
    const { company, position, qas } = (await request.json()) as {
      company: string;
      position: string;
      qas: QAItem[];
    };

    const qaSummary = qas
      .map(
        (qa, i) =>
          `Q${i + 1} [${qa.category}]: ${qa.question}\nA: ${qa.answer}\n점수: ${qa.score}/10\n피드백: ${qa.feedback}`
      )
      .join("\n\n");

    const prompt = `당신은 ${company}의 ${position} 면접 심사위원입니다.
아래는 면접 전체 질문과 답변, 개별 점수입니다:

${qaSummary}

종합 평가를 작성하세요:

1. totalScore (0-100): 개별 점수들을 종합하여 100점 만점 환산
2. grade: A+, A, B+, B, C+, C 중 하나
3. passRate: "90%", "70-80%", "50-60%", "30-40%" 중 하나
4. scores: 6개 카테고리별 점수 (0-100)
   - content: 답변 내용 충실도
   - logic: 논리 구조
   - technical: 기술 역량
   - communication: 커뮤니케이션
   - voice: 음성/태도 (이건 평균 70으로 설정, 음성 분석 없으므로)
   - fit: ${company} 적합도
5. strengths: 강점 3개 (구체적으로)
6. improvements: 개선점 3개 (구체적으로)
7. overallFeedback: 3-4문장의 종합 피드백. ${company} 면접 기준으로 작성.

JSON 형식으로 응답하세요:
{
  "totalScore": 75,
  "grade": "B+",
  "passRate": "70-80%",
  "scores": { "content": 75, "logic": 72, "technical": 78, "communication": 70, "voice": 70, "fit": 73 },
  "strengths": ["강점1", "강점2", "강점3"],
  "improvements": ["개선점1", "개선점2", "개선점3"],
  "overallFeedback": "종합 피드백"
}`;

    const data = await generateJSON<ResultResponse>(prompt);
    return Response.json(data);
  } catch (error) {
    console.error("Result generation failed:", error);
    return Response.json(
      { error: "결과 생성 실패", fallback: true },
      { status: 500 }
    );
  }
}
