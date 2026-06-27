import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="mx-auto max-w-6xl px-4 py-24 md:py-32">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 rounded-full mb-6">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-indigo-700">
                AI 모의면접 서비스
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
              면접, 혼자 준비하지 마세요
              <br />
              <span className="text-primary">AI가 실전처럼</span> 연습시켜
              드립니다
            </h1>

            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mb-10">
              지원 회사의 실제 면접 패턴을 반영한 맞춤 질문,
              <br />
              음성 기반 답변 분석, 면접관 페르소나까지.
              <br />
              면접이와 함께라면 합격이 가까워집니다.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/interview/setup"
                className="px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors text-lg shadow-lg shadow-indigo-200"
              >
                무료로 면접 시작하기
              </Link>
              <Link
                href="/resume"
                className="px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl border border-gray-300 hover:border-gray-400 transition-colors text-lg"
              >
                이력서 먼저 분석하기
              </Link>
            </div>
          </div>
        </div>

        {/* decorative blobs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            면접이만의 차별점
          </h2>
          <p className="text-center text-gray-500 mb-14">
            단순 질문-답변을 넘어, 실전과 동일한 면접 경험을 제공합니다
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl mb-4">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-14">
            이용 방법
          </h2>

          <div className="grid md:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.title} className="text-center">
                <div className="w-14 h-14 mx-auto bg-primary text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-indigo-200 mb-8">
            회원가입 없이 바로 체험할 수 있습니다
          </p>
          <Link
            href="/interview/setup"
            className="inline-block px-8 py-4 bg-white text-primary font-semibold rounded-xl hover:bg-indigo-50 transition-colors text-lg"
          >
            면접 연습 시작하기
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 text-gray-400 text-sm text-center">
        <p>&copy; 2026 면접이. AI 모의면접 서비스.</p>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: "🏢",
    title: "회사 맞춤형 질문",
    desc: "지원 회사의 실제 면접 후기와 기출 질문을 반영하여 맞춤 질문을 생성합니다.",
  },
  {
    icon: "🎙️",
    title: "음성 기반 분석",
    desc: "답변 내용뿐 아니라 톤, 속도, 떨림 등 비언어적 요소까지 분석합니다.",
  },
  {
    icon: "🎭",
    title: "면접관 페르소나",
    desc: "회사 문화와 직무에 따라 면접관의 말투와 톤이 달라집니다.",
  },
  {
    icon: "📊",
    title: "종합 리포트",
    desc: "STAR 기법 적용도, 논리 구조, 음성 분석 등 실행 가능한 피드백을 제공합니다.",
  },
];

const STEPS = [
  { title: "이력서 업로드", desc: "PDF/DOCX 이력서를 업로드하면 AI가 자동 분석합니다" },
  { title: "회사 선택", desc: "지원 회사와 직무를 선택하고 면접 유형을 설정합니다" },
  { title: "모의면접 진행", desc: "AI 면접관과 음성으로 실전 같은 면접을 진행합니다" },
  { title: "결과 확인", desc: "종합 점수와 상세 피드백을 확인하고 개선합니다" },
];
