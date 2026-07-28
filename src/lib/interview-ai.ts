import { generateJSON } from "@/lib/gemini";

interface AnalyzeAnswerParams {
  question: string;
  answer: string;
  category: string;
  company?: string;
  position?: string;
  resumeText?: string;
  experienceLevel?: string;
  interviewerRole?: string | string[];
  interviewerMood?: string;
}

interface AnalyzeResponse {
  score: number;
  feedback: string;
  followUpQuestion?: string;
}

export async function analyzeAnswer(params: AnalyzeAnswerParams): Promise<AnalyzeResponse> {
  const {
    question, answer, category, company, position,
    resumeText, experienceLevel, interviewerRole, interviewerMood,
  } = params;

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
   - ${moodGuides[interviewerMood ?? "standard"] || moodGuides.standard}`
    : `3. 꼬리질문: 답변 내용을 기반으로 꼬리질문 생성.
   - 답변이 빈약하면: 구체화 요청 질문
   - 답변이 좋으면: 심화 질문
   - 답변이 짧거나 핵심이 없으면: 반드시 꼬리질문 생성
   - ${moodGuides[interviewerMood ?? "standard"] || moodGuides.standard}`;

  const roles = Array.isArray(interviewerRole) ? interviewerRole : [interviewerRole ?? ""];
  const roleDesc = roles.map((r) => roleLabels[r ?? ""] || r).join(", ");

  const prompt = `당신은 ${company}의 ${position} 포지션 ${roleDesc || "면접관"}입니다.
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
  data.score = Math.max(1, Math.min(10, Math.round(data.score)));
  return data;
}

interface GenerateQuestionsParams {
  company: string;
  position: string;
  interviewTypes: string[];
  questionCount: number;
  resumeText?: string;
  jdText?: string;
  coverLetterText?: string;
  experienceLevel?: string;
  interviewerCount?: number;
  interviewerRole?: string | string[];
  interviewerGender?: string;
  interviewerMood?: string;
}

interface GeneratedQuestion {
  question: string;
  category: string;
}

interface QuestionsResponse {
  questions: GeneratedQuestion[];
}

export async function generateQuestions(params: GenerateQuestionsParams): Promise<QuestionsResponse> {
  const {
    company, position, interviewTypes, questionCount,
    resumeText, jdText, coverLetterText, experienceLevel,
    interviewerCount, interviewerRole, interviewerGender, interviewerMood,
  } = params;

  const isExperienced = experienceLevel === "경력";

  const typeLabels: Record<string, string> = {
    tech: "기술 면접",
    job: "직무 면접",
    culture: "컬쳐핏 면접",
    personality: "인성 면접",
    executive: "임원/최종 면접",
    pressure: "압박 면접",
  };

  const typeNames = interviewTypes.map((t) => typeLabels[t] || t).join(", ");

  const roleLabels: Record<string, string> = {
    peer:      "개발자 동료(시니어) — 기술 심화, 코드 설계, 트레이드오프 집중",
    manager:   "팀장 — 기술 역량과 협업·문화 적합성을 균형 있게 평가",
    executive: "임원/CTO — 비전, 성장 가능성, 회사 기여도 중심",
    hr:        "HR 담당자 — 인성, 문화 적합성, 이직 사유 중심",
  };
  const moodLabels: Record<string, string> = {
    friendly: "우호적 — 편안한 대화형, 지원자가 긴장을 풀도록 유도",
    standard: "표준형 — 일반적인 구조화 면접, 중립적 태도",
    pressure: "압박형 — 날카로운 꼬리질문, 논리 허점 공략, 불편한 질문도 서슴지 않음",
  };
  const genderLabel = interviewerGender === "male" ? "남성" : interviewerGender === "female" ? "여성" : "";

  const roles = Array.isArray(interviewerRole) ? interviewerRole : [interviewerRole ?? ""];
  const roleDesc = roles.map((r) => roleLabels[r ?? ""] || r).join(", ");

  const interviewerBlock = `
[면접관 설정]
- 역할: ${roleDesc}
- 인원: ${interviewerCount}명${(interviewerCount ?? 1) > 1 ? ` (면접관들이 번갈아 질문하는 구조)` : ""}
${genderLabel ? `- 성별: ${genderLabel}\n` : ""}- 분위기: ${moodLabels[interviewerMood ?? "standard"] || interviewerMood}

이 면접관 설정에 맞게 질문의 톤과 깊이를 조절하세요.
`;

  const coverLetterBlock = coverLetterText
    ? `\n[지원자 자기소개서]\n${coverLetterText}\n`
    : "";

  let contextBlock = "";

  if (resumeText && jdText) {
    if (isExperienced) {
      contextBlock = `
[지원자 이력서]
${resumeText}

[채용공고 요구사항]
${jdText}

이 지원자는 경력직입니다. 질문의 대부분을 이력서 기반으로 생성하세요:
1. 이력서 프로젝트/경험 심화 질문 — 각 프로젝트의 구체적 역할, 기술적 의사결정 배경, 성과 수치, 장애 대응, 아키텍처 선택 이유 등을 깊이 파고드세요 (60%)
2. 경력 흐름 검증 — 이직 사유, 경력 공백, 성장 과정, 각 회사에서 배운 점 (15%)
3. 이력서 기술 스택 × JD 요구사항 교차 검증 — 이력서에 적힌 기술이 JD에서 요구하는 수준에 부합하는지 (15%)
4. JD 우대사항 중 이력서에 없는 영역 탐색 (10%)
비율에 맞춰 질문을 생성하세요.

중요:
- 반드시 이력서에 기재된 프로젝트명, 회사명, 기술 스택을 직접 언급하며 질문하세요
- "~하신 프로젝트에서", "~에서 근무하실 때" 등 이력서 내용을 구체적으로 참조하세요
- 추상적/일반적 질문은 최소화하고, 이력서에서만 나올 수 있는 맞춤 질문을 만드세요
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
  ? `경력직 지원자입니다. 거의 모든 질문을 이력서 기반으로 생성하세요.
- 각 프로젝트의 구체적 역할, 기술적 의사결정, 성과 수치, 장애 대응 경험 (70%)
- 이직 사유, 경력 공백, 성장 과정 (15%)
- 기술 스택 심화 질문 (15%)
반드시 이력서에 적힌 프로젝트명, 회사명, 기술을 직접 언급하며 질문하세요.
추상적/일반적 질문은 최소화하세요.`
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
${interviewerBlock}${coverLetterBlock}${contextBlock}
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

  return generateJSON<QuestionsResponse>(prompt);
}

interface QAItem {
  question: string;
  answer: string;
  category: string;
  score: number;
  feedback: string;
}

interface GenerateResultParams {
  company: string;
  position: string;
  qas: QAItem[];
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

export async function generateResult(params: GenerateResultParams): Promise<ResultResponse> {
  const { company, position, qas } = params;

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

  return generateJSON<ResultResponse>(prompt);
}

interface ResumeAnalysis {
  name: string;
  experience: string[];
  projects: { name: string; description: string; tech: string[] }[];
  skills: string[];
  weakPoints: string[];
}

export async function analyzeResumeText(rawText: string): Promise<ResumeAnalysis> {
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

  return generateJSON<ResumeAnalysis>(prompt, 30000);
}

interface JDAnalysis {
  company: string;
  position: string;
  requirements: string[];
  preferred: string[];
  description: string;
}

export async function analyzeJdText(jdText: string): Promise<JDAnalysis> {
  const rawText = jdText.slice(0, 10000);

  const prompt = `다음은 채용공고 텍스트입니다. 분석하여 JSON으로 반환하세요.

[채용공고 텍스트]
${rawText}

다음 형식으로 응답하세요:
{
  "company": "회사명",
  "position": "채용 포지션명",
  "requirements": ["자격요건 1", "자격요건 2", ...],
  "preferred": ["우대사항 1", "우대사항 2", ...],
  "description": "직무 설명 요약 (2-3문장)"
}

요구사항:
- 회사명과 포지션을 정확히 추출
- requirements는 필수/자격 요건만
- preferred는 우대사항/플러스 요소만
- description은 핵심 업무 내용 요약`;

  return generateJSON<JDAnalysis>(prompt);
}
