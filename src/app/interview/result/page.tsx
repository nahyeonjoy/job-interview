"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { loadState } from "@/store/interview";
import type { InterviewResult } from "@/store/interview";

interface ChatMessage {
  role: "ai" | "user";
  content: string;
  type?: "text" | "score" | "voice" | "improvements" | "qa";
  data?: Record<string, unknown>;
}

export default function InterviewResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgIndex, setMsgIndex] = useState(0);
  const [input, setInput] = useState("");
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const r = loadState("result");
    if (!r) {
      router.replace("/interview/setup");
      return;
    }
    setResult(r);
  }, [router]);

  // Auto-send messages sequentially
  useEffect(() => {
    if (!result) return;

    const allMessages: ChatMessage[] = [
      {
        role: "ai",
        content: "면접 수고하셨습니다! 결과를 알려드리겠습니다.",
        type: "text",
      },
      {
        role: "ai",
        content: "score",
        type: "score",
        data: {
          totalScore: result.totalScore,
          grade: result.grade,
          scores: result.scores,
        },
      },
      {
        role: "ai",
        content: result.overallFeedback,
        type: "text",
        data: { passRate: result.passRate },
      },
      {
        role: "ai",
        content: "voice",
        type: "voice",
        data: { voiceAnalysis: result.voiceAnalysis },
      },
      {
        role: "ai",
        content: "improvements",
        type: "improvements",
        data: {
          strengths: result.strengths,
          improvements: result.improvements,
        },
      },
      {
        role: "ai",
        content: "qa",
        type: "qa",
        data: { qas: result.qas },
      },
      {
        role: "ai",
        content: "궁금한 점이 있으면 자유롭게 질문해주세요!",
        type: "text",
      },
    ];

    if (msgIndex < allMessages.length) {
      const timer = setTimeout(
        () => {
          setMessages((prev) => [...prev, allMessages[msgIndex]]);
          setMsgIndex((i) => i + 1);
        },
        msgIndex === 0 ? 500 : 1200
      );
      return () => clearTimeout(timer);
    }
  }, [result, msgIndex]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    const q = input;
    setInput("");

    // Try AI response, fall back to local
    try {
      const res = await fetch("/api/interview/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `면접 결과에 대한 사용자 질문: "${q}"`,
          answer: `총점: ${result?.totalScore}, 등급: ${result?.grade}. 사용자가 결과에 대해 추가 질문하고 있습니다.`,
          category: "feedback",
          company: "면접이",
          position: "면접 코치",
        }),
      });
      const data = await res.json();
      if (!data.error && data.feedback) {
        setMessages((prev) => [
          ...prev,
          { role: "ai", content: data.feedback, type: "text" },
        ]);
        return;
      }
    } catch {
      // fall through to local
    }

    setMessages((prev) => [
      ...prev,
      { role: "ai", content: generateResponse(q), type: "text" },
    ]);
  };

  if (!result) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">면접 결과</h1>
          <p className="text-xs text-gray-500">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
            PDF 저장
          </button>
          <button
            onClick={() => router.push("/interview/setup")}
            className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark"
          >
            다시 연습하기
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-gray-50">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "ai" && (
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm shrink-0 mr-2 mt-1">
                  👤
                </div>
              )}
              <div
                className={`max-w-md rounded-2xl px-5 py-4 ${
                  msg.role === "user"
                    ? "bg-primary text-white"
                    : "bg-white border border-gray-200 shadow-sm"
                }`}
              >
                {msg.type === "score" ? (
                  <ScoreCard data={msg.data!} />
                ) : msg.type === "voice" ? (
                  <VoiceCard
                    data={
                      msg.data!.voiceAnalysis as InterviewResult["voiceAnalysis"]
                    }
                  />
                ) : msg.type === "improvements" ? (
                  <ImprovementsCard
                    strengths={msg.data!.strengths as string[]}
                    improvements={msg.data!.improvements as string[]}
                  />
                ) : msg.type === "qa" ? (
                  <QACard
                    qas={msg.data!.qas as InterviewResult["qas"]}
                    expandedQ={expandedQ}
                    onToggle={setExpandedQ}
                  />
                ) : (
                  <div>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    {msg.data?.passRate ? (
                      <p className="mt-2 text-sm font-semibold text-indigo-600">
                        합격 가능성: {String(msg.data.passRate)}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="궁금한 점을 물어보세요..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <button
            onClick={handleSend}
            className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ data }: { data: Record<string, unknown> }) {
  const scores = data.scores as InterviewResult["scores"];
  const labels: Record<string, string> = {
    content: "답변 내용",
    logic: "논리 구조",
    technical: "기술 역량",
    communication: "커뮤니케이션",
    voice: "음성/태도",
    fit: "회사 적합도",
  };

  return (
    <div>
      <div className="text-center mb-4">
        <p className="text-3xl font-bold text-gray-900">
          {data.totalScore as number}
          <span className="text-lg text-gray-400">/100</span>
        </p>
        <p className="text-lg font-semibold text-indigo-600">
          {data.grade as string}
        </p>
      </div>
      <div className="space-y-2">
        {Object.entries(scores).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <span className="w-24 text-gray-500 shrink-0">{labels[key]}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                style={{ width: `${val}%` }}
              />
            </div>
            <span className="w-8 text-right text-gray-700 font-medium">
              {val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VoiceCard({ data }: { data: InterviewResult["voiceAnalysis"] }) {
  const items = [
    { label: "자신감", value: data.confidence },
    { label: "명확성", value: data.clarity },
    { label: "안정성", value: data.stability },
    { label: "에너지", value: data.energy },
  ];

  return (
    <div>
      <p className="text-sm font-semibold text-gray-900 mb-3">🎙️ 음성 분석</p>
      <div className="space-y-2 mb-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span className="w-16 text-gray-500">{item.label}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${item.value}%` }}
              />
            </div>
            <span className="w-8 text-right text-gray-700 font-medium">
              {item.value}
            </span>
          </div>
        ))}
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <p>말 속도: {data.wpm} WPM (권장 140-160)</p>
        <p>필러 워드: {data.fillerCount}회</p>
      </div>
    </div>
  );
}

function ImprovementsCard({
  strengths,
  improvements,
}: {
  strengths: string[];
  improvements: string[];
}) {
  return (
    <div>
      <div className="mb-4">
        <p className="text-sm font-semibold text-green-700 mb-2">
          💪 강점 TOP 3
        </p>
        <ul className="space-y-1">
          {strengths.map((s, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-1">
              <span className="text-green-500 shrink-0">+</span> {s}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-700 mb-2">
          🎯 개선 포인트 TOP 3
        </p>
        <ul className="space-y-1">
          {improvements.map((s, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-1">
              <span className="text-amber-500 shrink-0">→</span> {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function QACard({
  qas,
  expandedQ,
  onToggle,
}: {
  qas: InterviewResult["qas"];
  expandedQ: number | null;
  onToggle: (id: number | null) => void;
}) {
  const categoryLabel: Record<string, string> = {
    tech: "기술",
    job: "직무",
    culture: "컬쳐핏",
    personality: "인성",
    executive: "임원",
    pressure: "압박",
  };

  return (
    <div>
      <p className="text-sm font-semibold text-gray-900 mb-3">
        📝 질문별 피드백
      </p>
      <div className="space-y-2">
        {qas.map((qa) => (
          <button
            key={qa.id}
            onClick={() => onToggle(expandedQ === qa.id ? null : qa.id)}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                  {categoryLabel[qa.category] || qa.category}
                </span>
                <span className="text-sm text-gray-700 truncate max-w-48">
                  Q{qa.id}. {qa.question.slice(0, 30)}...
                </span>
              </div>
              <span
                className={`text-sm font-bold ${
                  qa.score >= 80
                    ? "text-green-600"
                    : qa.score >= 70
                    ? "text-amber-600"
                    : "text-red-500"
                }`}
              >
                {qa.score}점
              </span>
            </div>
            {expandedQ === qa.id && (
              <div className="px-2 pb-2 text-xs text-gray-600 leading-relaxed">
                <p className="font-medium text-gray-800 mb-1">{qa.question}</p>
                <p>{qa.feedback}</p>
                {qa.followUp && (
                  <p className="mt-1 text-indigo-600">
                    꼬리 질문: {qa.followUp}
                  </p>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function generateResponse(question: string): string {
  if (question.includes("모범") || question.includes("답안")) {
    return "모범 답변 구조: 1) 결론을 먼저 말합니다 (PREP) 2) 구체적 상황을 설명합니다 (STAR의 S) 3) 본인의 행동을 강조합니다 (A) 4) 수치적 결과로 마무리합니다 (R). 예: '네, 저는 캐시 무효화를 위해 이벤트 기반 전략을 사용했습니다. 당시 상품 정보 업데이트 지연 문제가 있었고, Redis Pub/Sub을 도입하여 평균 응답시간을 200ms에서 50ms로 줄였습니다.'";
  }
  if (question.includes("비교") || question.includes("이전")) {
    return "첫 번째 면접 연습이라 이전 기록과 비교가 어렵습니다. 다음 면접 후에는 성장 추이를 확인하실 수 있습니다!";
  }
  if (question.includes("STAR")) {
    return "STAR 기법은 Situation(상황) → Task(과제) → Action(행동) → Result(결과) 순서로 답변을 구조화하는 방법입니다. 특히 경험 기반 질문에서 효과적입니다. 핵심은 'Action'에서 본인이 직접 한 행동을 구체적으로 말하는 것입니다.";
  }
  return "좋은 질문이에요! 면접 준비에서 가장 중요한 것은 반복 연습입니다. 같은 질문이라도 여러 번 답변하면서 구조를 다듬어보세요. 다음 면접에서는 오늘 피드백을 반영해서 연습해보시기 바랍니다.";
}
