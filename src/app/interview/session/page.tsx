"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadState, saveState } from "@/store/interview";
import { MOCK_QUESTIONS, MOCK_FOLLOW_UPS, generateMockResult } from "@/data/mock";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import type { InterviewSetup, QuestionAnswer } from "@/store/interview";

type Phase =
  | "ready"
  | "loading"
  | "asking"
  | "answering"
  | "analyzing"
  | "followup-asking"
  | "followup-answering"
  | "thinking"
  | "generating-result"
  | "done";

interface QA {
  question: string;
  category: string;
  answer: string;
  transcript: string;
  isFollowUp: boolean;
  aiScore?: number;
  aiFeedback?: string;
  followUpQ?: string;
  followUpA?: string;
}

export default function InterviewSessionPage() {
  const router = useRouter();
  const [setup, setSetup] = useState<InterviewSetup | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [currentQ, setCurrentQ] = useState(0);
  const [questions, setQuestions] = useState<{ q: string; cat: string }[]>([]);
  const [displayText, setDisplayText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [answerTime, setAnswerTime] = useState(0);
  const [qas, setQas] = useState<QA[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stt = useSpeechRecognition();
  const tts = useSpeechSynthesis();

  // Track current follow-up context
  const currentFollowUpRef = useRef<string>("");

  useEffect(() => {
    const s = loadState("setup");
    if (!s) {
      router.replace("/interview/setup");
      return;
    }
    setSetup(s);
  }, [router]);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const typeQuestion = useCallback(
    (text: string, onDone: () => void) => {
      if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
      let i = 0;
      setDisplayText("");
      typeIntervalRef.current = setInterval(() => {
        i++;
        setDisplayText(text.slice(0, i));
        if (i >= text.length) {
          if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
          // TTS: speak question after typing done
          if (tts.isSupported) {
            tts.speak(text);
          }
          setTimeout(onDone, 500);
        }
      }, 40);
    },
    [tts]
  );

  // Fetch AI questions
  const fetchQuestions = async (s: InterviewSetup) => {
    setPhase("loading");
    setStatusMsg("AI가 면접 질문을 준비하고 있습니다...");

    // Load resume and JD context
    const resume = loadState("resume");
    const resumeText = resume?.rawText || "";
    const jdText = s.jd?.rawText || "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("/api/interview/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          company: s.company,
          position: s.position,
          interviewTypes: s.interviewTypes,
          questionCount: s.questionCount,
          resumeText: resumeText.slice(0, 5000),
          jdText: jdText.slice(0, 3000),
          experienceLevel: s.experienceLevel || "경력",
        }),
      });
      clearTimeout(timeout);

      const data = await res.json();

      if (data.fallback || data.error) throw new Error("API failed");

      const aiQuestions = data.questions.map(
        (q: { question: string; category: string }) => ({
          q: q.question,
          cat: q.category,
        })
      );
      setQuestions(aiQuestions);
      return aiQuestions;
    } catch {
      // Fallback to mock questions
      console.warn("AI question generation failed, using mock data");
      const pool = s.interviewTypes.flatMap((t) =>
        (MOCK_QUESTIONS[t] || []).map((q) => ({ q, cat: t }))
      );
      const shuffled = pool.sort(() => Math.random() - 0.5);
      const fallbackQuestions = shuffled.slice(0, s.questionCount);
      setQuestions(fallbackQuestions);
      return fallbackQuestions;
    }
  };

  const startInterview = async () => {
    if (!setup) return;
    startTimer();
    const qs = await fetchQuestions(setup);
    setCurrentQ(0);
    typeQuestion(qs[0].q, () => setPhase("answering"));
    setPhase("asking");
  };

  const startRecording = () => {
    setIsRecording(true);
    setAnswerTime(0);
    stt.reset();
    stt.start();
    answerTimerRef.current = setInterval(
      () => setAnswerTime((t) => t + 1),
      1000
    );
  };

  const stopRecording = async () => {
    setIsRecording(false);
    stt.stop();
    if (answerTimerRef.current) clearInterval(answerTimerRef.current);

    const transcript = stt.transcript || "(음성 인식 실패)";

    // Check if this is a follow-up answer
    if (phase === "followup-answering") {
      // Update last QA with follow-up answer
      setQas((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last) {
          last.followUpA = transcript;
        }
        return updated;
      });
      moveToNext();
      return;
    }

    // Regular answer - analyze with AI
    setPhase("analyzing");
    setStatusMsg("AI가 답변을 분석하고 있습니다...");

    const currentQuestion = questions[currentQ];

    let aiScore = 7;
    let aiFeedback = "";
    let followUpQuestion: string | undefined;

    try {
      const analyzeController = new AbortController();
      const analyzeTimeout = setTimeout(() => analyzeController.abort(), 10000);
      const res = await fetch("/api/interview/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: analyzeController.signal,
        body: JSON.stringify({
          question: currentQuestion.q,
          answer: transcript,
          category: currentQuestion.cat,
          company: setup?.company,
          position: setup?.position,
        }),
      });
      clearTimeout(analyzeTimeout);

      const data = await res.json();

      if (!data.error) {
        aiScore = data.score;
        aiFeedback = data.feedback;
        followUpQuestion = data.followUpQuestion || undefined;
      }
    } catch {
      console.warn("AI analysis failed, using defaults");
    }

    const newQA: QA = {
      question: currentQuestion.q,
      category: currentQuestion.cat,
      answer: transcript,
      transcript,
      isFollowUp: false,
      aiScore,
      aiFeedback,
      followUpQ: followUpQuestion,
    };

    setQas((prev) => [...prev, newQA]);

    // If there's a follow-up question, show it
    if (followUpQuestion && currentQ < questions.length - 1) {
      currentFollowUpRef.current = followUpQuestion;
      setPhase("thinking");
      setTimeout(() => {
        typeQuestion(followUpQuestion!, () =>
          setPhase("followup-answering")
        );
        setPhase("followup-asking");
      }, 1500);
      return;
    }

    moveToNext();
  };

  const skipQuestion = () => {
    setIsRecording(false);
    stt.stop();
    if (answerTimerRef.current) clearInterval(answerTimerRef.current);

    // Add skipped question to QA
    if (phase === "answering") {
      setQas((prev) => [
        ...prev,
        {
          question: questions[currentQ].q,
          category: questions[currentQ].cat,
          answer: "(스킵)",
          transcript: "",
          isFollowUp: false,
          aiScore: 0,
          aiFeedback: "답변하지 않았습니다.",
        },
      ]);
    }

    moveToNext();
  };

  const moveToNext = () => {
    const next = currentQ + 1;
    if (next >= questions.length) {
      finishInterview();
    } else {
      setCurrentQ(next);
      typeQuestion(questions[next].q, () => setPhase("answering"));
      setPhase("asking");
    }
  };

  const finishInterview = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (answerTimerRef.current) clearInterval(answerTimerRef.current);
    tts.stop();

    setPhase("generating-result");
    setStatusMsg("AI가 종합 결과를 분석하고 있습니다...");

    // Build QA data for result API
    const qaData = qas.map((qa) => ({
      question: qa.question,
      answer: qa.transcript || qa.answer,
      category: qa.category,
      score: qa.aiScore ?? 5,
      feedback: qa.aiFeedback ?? "",
    }));

    try {
      const resultController = new AbortController();
      const resultTimeout = setTimeout(() => resultController.abort(), 10000);
      const res = await fetch("/api/interview/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: resultController.signal,
        body: JSON.stringify({
          company: setup?.company,
          position: setup?.position,
          qas: qaData,
        }),
      });
      clearTimeout(resultTimeout);

      const data = await res.json();

      if (!data.error) {
        // Build full result with QA details
        const resultQAs: QuestionAnswer[] = qas.map((qa, i) => ({
          id: i + 1,
          question: qa.question,
          answer: qa.transcript || qa.answer,
          category: qa.category,
          score: (qa.aiScore ?? 5) * 10,
          feedback: qa.aiFeedback ?? "",
          followUp: qa.followUpQ,
          transcript: qa.transcript,
          followUpQ: qa.followUpQ,
          followUpA: qa.followUpA,
          aiScore: qa.aiScore,
          aiFeedback: qa.aiFeedback,
        }));

        const result = {
          ...data,
          voiceAnalysis: {
            confidence: Math.floor(Math.random() * 25) + 55,
            clarity: Math.floor(Math.random() * 20) + 60,
            stability: Math.floor(Math.random() * 25) + 50,
            energy: Math.floor(Math.random() * 20) + 60,
            wpm: Math.floor(Math.random() * 40) + 140,
            fillerCount: Math.floor(Math.random() * 10) + 3,
          },
          qas: resultQAs,
        };

        saveState("result", result);
        setPhase("done");
        setTimeout(() => router.push("/interview/result"), 2000);
        return;
      }
    } catch {
      console.warn("AI result generation failed, using mock");
    }

    // Fallback to mock result
    const mockResult = generateMockResult(
      setup?.company ?? "네이버",
      questions.length
    );
    saveState("result", mockResult);
    setPhase("done");
    setTimeout(() => router.push("/interview/result"), 2000);
  };

  if (!setup) return null;

  const showTranscript =
    (phase === "answering" || phase === "followup-answering") && isRecording;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-300">면접이</span>
          <span className="text-xs text-gray-500">|</span>
          <span className="text-sm text-indigo-400 font-medium">
            [{setup.company}] {setup.position}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="text-gray-400">
            진행: {Math.min(currentQ + 1, questions.length)}/{questions.length}{" "}
            질문
          </span>
          <span className="text-gray-400">경과: {formatTime(elapsed)}</span>
          {phase !== "ready" &&
            phase !== "done" &&
            phase !== "loading" &&
            phase !== "generating-result" && (
              <button
                onClick={finishInterview}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-medium transition-colors"
              >
                면접 종료
              </button>
            )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Ready phase */}
        {phase === "ready" && (
          <div className="text-center max-w-lg">
            <div className="w-24 h-24 mx-auto bg-gray-700 rounded-full flex items-center justify-center text-5xl mb-6">
              👤
            </div>
            <h2 className="text-2xl font-bold mb-2">면접 준비</h2>
            <p className="text-gray-400 mb-2">
              {setup.company} - {setup.position}
            </p>
            <p className="text-gray-500 text-sm mb-2">
              총 {setup.questionCount}개 질문 | AI가 맞춤 질문을 생성합니다
            </p>
            {!stt.isSupported && (
              <p className="text-amber-400 text-xs mb-4">
                이 브라우저는 음성 인식을 지원하지 않습니다. 텍스트 입력으로
                대체됩니다.
              </p>
            )}
            <p className="text-gray-500 text-sm mb-8">
              마이크가 준비되었는지 확인하세요
            </p>
            <button
              onClick={startInterview}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold text-lg transition-colors"
            >
              면접 시작
            </button>
          </div>
        )}

        {/* Loading phase - AI generating questions */}
        {phase === "loading" && (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto bg-indigo-900/50 rounded-full flex items-center justify-center text-5xl mb-6">
              🤖
            </div>
            <h2 className="text-xl font-bold mb-2">{statusMsg}</h2>
            <div className="mt-4">
              <svg
                className="animate-spin h-8 w-8 mx-auto text-indigo-400"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Done phase */}
        {phase === "done" && (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto bg-green-900/50 rounded-full flex items-center justify-center text-5xl mb-6">
              ✅
            </div>
            <h2 className="text-2xl font-bold mb-2">
              면접이 종료되었습니다
            </h2>
            <p className="text-gray-400">결과 페이지로 이동합니다...</p>
            <div className="mt-6">
              <svg
                className="animate-spin h-8 w-8 mx-auto text-indigo-400"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Generating result phase */}
        {phase === "generating-result" && (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto bg-indigo-900/50 rounded-full flex items-center justify-center text-5xl mb-6">
              📊
            </div>
            <h2 className="text-xl font-bold mb-2">{statusMsg}</h2>
            <p className="text-gray-500 text-sm mt-2">
              {qas.length}개 답변을 종합 분석하고 있습니다
            </p>
            <div className="mt-6">
              <svg
                className="animate-spin h-8 w-8 mx-auto text-indigo-400"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Active interview phases */}
        {(phase === "asking" ||
          phase === "answering" ||
          phase === "analyzing" ||
          phase === "followup-asking" ||
          phase === "followup-answering" ||
          phase === "thinking") && (
          <div className="w-full max-w-2xl">
            {/* AI Interviewer area */}
            <div className="bg-gray-800 rounded-2xl p-8 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-indigo-900/50 rounded-full flex items-center justify-center text-3xl shrink-0 relative">
                  👤
                  {tts.isSpeaking && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-indigo-400">
                      AI 면접관
                    </span>
                    {(phase === "asking" || phase === "followup-asking") && (
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    )}
                    {phase === "thinking" && (
                      <span className="text-xs text-gray-500">
                        생각 중...
                      </span>
                    )}
                    {phase === "analyzing" && (
                      <span className="text-xs text-amber-400">
                        답변 분석 중...
                      </span>
                    )}
                    {tts.isSpeaking && (
                      <span className="text-xs text-green-400">🔊</span>
                    )}
                  </div>
                  <p className="text-lg leading-relaxed">
                    {displayText}
                    {(phase === "asking" || phase === "followup-asking") && (
                      <span className="inline-block w-0.5 h-5 bg-white animate-pulse ml-0.5" />
                    )}
                  </p>
                  {(phase === "followup-asking" ||
                    phase === "followup-answering") && (
                    <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-amber-900/50 text-amber-300 rounded-full">
                      꼬리질문
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Analyzing indicator */}
            {phase === "analyzing" && (
              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 text-center">
                <svg
                  className="animate-spin h-6 w-6 mx-auto text-amber-400 mb-3"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <p className="text-sm text-gray-400">{statusMsg}</p>
              </div>
            )}

            {/* Answer area */}
            {(phase === "answering" || phase === "followup-answering") && (
              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                {/* Voice waveform */}
                <div className="flex items-center justify-center gap-1 h-12 mb-4">
                  {isRecording
                    ? Array.from({ length: 20 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-indigo-400 rounded-full wave-bar"
                          style={{
                            animationDelay: `${i * 0.05}s`,
                            height: `${Math.random() * 24 + 8}px`,
                          }}
                        />
                      ))
                    : Array.from({ length: 20 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1 h-2 bg-gray-600 rounded-full"
                        />
                      ))}
                </div>

                {/* Real-time transcript */}
                {showTranscript && stt.transcript && (
                  <div className="mb-4 px-3 py-2 bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {stt.transcript}
                    </p>
                  </div>
                )}

                {isRecording && (
                  <p className="text-center text-sm text-gray-400 mb-4">
                    답변 시간: {formatTime(answerTime)}
                  </p>
                )}

                <div className="flex items-center justify-center gap-3">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-medium transition-colors"
                    >
                      <span className="w-3 h-3 bg-white rounded-full" />
                      {stt.isSupported ? "녹음 시작" : "답변 시작"}
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                      답변 완료
                    </button>
                  )}
                  <button
                    onClick={skipQuestion}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium text-gray-300 transition-colors"
                  >
                    스킵
                  </button>
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="mt-6">
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${((currentQ + 1) / Math.max(questions.length, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
