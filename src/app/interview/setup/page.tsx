"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveState, loadState } from "@/store/interview";
import {
  MOCK_COMPANIES,
  POSITIONS,
  INTERVIEW_TYPES,
} from "@/data/mock";
import type { ResumeData, JDData } from "@/store/interview";

export default function InterviewSetupPage() {
  const router = useRouter();
  const [experienceLevel, setExperienceLevel] = useState<"신입" | "경력">("경력");
  const [company, setCompany] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [position, setPosition] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["tech"]);
  const [mode, setMode] = useState<"time" | "count">("count");
  const [questionCount, setQuestionCount] = useState(10);
  const [timeMinutes, setTimeMinutes] = useState(30);

  // Resume states
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeAnalyzing, setResumeAnalyzing] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // JD states
  const [jdUrl, setJdUrl] = useState("");
  const [jdLoading, setJdLoading] = useState(false);
  const [jdData, setJdData] = useState<JDData | null>(null);
  const [jdError, setJdError] = useState<string | null>(null);

  useEffect(() => {
    const r = loadState("resume");
    if (r) setResume(r);
  }, []);

  const filteredCompanies = MOCK_COMPANIES.filter((c) =>
    c.name.includes(companySearch)
  );

  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const selectedCompany = MOCK_COMPANIES.find((c) => c.name === company);

  // Resume upload + analyze
  const handleResumeUpload = useCallback(async (file: File) => {
    setResumeFile(file);
    setResumeError(null);
    setResumeAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/resume/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error) {
        setResumeError(data.error);
        setResumeAnalyzing(false);
        return;
      }

      const result: ResumeData = {
        fileName: file.name,
        name: data.name || "지원자",
        experience: data.experience || [],
        projects: data.projects || [],
        skills: data.skills || [],
        weakPoints: data.weakPoints || [],
        rawText: data.rawText || "",
      };

      setResume(result);
      saveState("resume", result);
    } catch {
      setResumeError("이력서 분석 중 오류가 발생했습니다. 다시 시도하세요.");
    } finally {
      setResumeAnalyzing(false);
    }
  }, []);

  // JD analyze
  const handleJdAnalyze = async () => {
    if (!jdUrl.trim()) return;
    setJdLoading(true);
    setJdError(null);

    try {
      const res = await fetch("/api/interview/jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jdUrl.trim() }),
      });

      const data = await res.json();

      if (data.error) {
        setJdError(data.error);
        return;
      }

      const jd: JDData = {
        url: jdUrl.trim(),
        company: data.company || "",
        position: data.position || "",
        requirements: data.requirements || [],
        preferred: data.preferred || [],
        description: data.description || "",
        rawText: data.rawText || "",
      };

      setJdData(jd);

      if (jd.company) {
        setCompany(jd.company);
        setCompanySearch(jd.company);
      }
      if (jd.position) {
        const match = POSITIONS.find(
          (p) =>
            jd.position.includes(p) ||
            p.includes(jd.position.replace(/\s*(개발자|엔지니어|Developer|Engineer)\s*/g, "").trim())
        );
        if (match) setPosition(match);
      }
    } catch {
      setJdError("채용공고 분석 중 오류가 발생했습니다.");
    } finally {
      setJdLoading(false);
    }
  };

  const handleStart = () => {
    const count = mode === "count" ? questionCount : Math.round(timeMinutes / 3);
    saveState("setup", {
      company: company || "네이버",
      position: position || "백엔드 개발자",
      interviewTypes: selectedTypes,
      questionCount: count,
      difficulty: "중간",
      interviewerTone: selectedCompany?.tone ?? "반격식",
      experienceLevel,
      jd: jdData || undefined,
    });
    router.push("/interview/session");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">면접 설정</h1>
      <p className="text-gray-500 mb-8">
        면접 조건을 설정하고 모의면접을 시작하세요
      </p>

      <div className="space-y-8">
        {/* Experience Level */}
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            경력 구분
          </label>
          <div className="flex gap-3">
            {(["신입", "경력"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setExperienceLevel(level)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                  experienceLevel === level
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </section>

        {/* Resume Upload (inline) */}
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            이력서 업로드 {experienceLevel === "신입" && <span className="text-gray-400 font-normal">(선택)</span>}
          </label>
          <p className="text-xs text-gray-400 mb-3">
            PDF 이력서를 업로드하면 맞춤 면접 질문을 생성합니다
          </p>

          {!resume ? (
            <div>
              <label
                className={`flex items-center justify-center gap-3 px-4 py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  resumeAnalyzing
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-gray-300 hover:border-primary hover:bg-indigo-50"
                }`}
              >
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleResumeUpload(f);
                  }}
                  disabled={resumeAnalyzing}
                />
                {resumeAnalyzing ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-primary font-medium">
                      {resumeFile?.name} AI 분석 중...
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">📄</span>
                    <span className="text-sm text-gray-600">
                      PDF 이력서를 클릭하여 업로드
                    </span>
                  </>
                )}
              </label>
              {resumeError && (
                <p className="mt-2 text-sm text-red-600">{resumeError}</p>
              )}
            </div>
          ) : (
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span>📄</span>
                  <span className="font-medium text-gray-900">{resume.name}</span>
                  {resume.experience.length > 0 && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-600 text-xs">
                        {resume.experience.slice(0, 2).join(", ")}
                      </span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => {
                    setResume(null);
                    setResumeFile(null);
                    saveState("resume", null);
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  삭제
                </button>
              </div>
              {resume.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {resume.skills.slice(0, 8).map((s) => (
                    <span
                      key={s}
                      className="px-1.5 py-0.5 bg-white rounded text-xs text-indigo-700 border border-indigo-200"
                    >
                      {s}
                    </span>
                  ))}
                  {resume.skills.length > 8 && (
                    <span className="text-xs text-gray-400 self-center">
                      +{resume.skills.length - 8}
                    </span>
                  )}
                </div>
              )}
              {resume.weakPoints.length > 0 && (
                <div className="mt-2 pt-2 border-t border-indigo-200">
                  <p className="text-xs font-medium text-amber-700 mb-1">면접 공격 포인트:</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {resume.weakPoints.slice(0, 3).map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Company */}
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            지원 회사
          </label>
          <input
            type="text"
            placeholder="회사명을 검색하세요"
            value={companySearch}
            onChange={(e) => {
              setCompanySearch(e.target.value);
              setCompany("");
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
          {companySearch && !company && (
            <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {filteredCompanies.map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    setCompany(c.name);
                    setCompanySearch(c.name);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center justify-between text-sm"
                >
                  <span className="font-medium text-gray-900">{c.name}</span>
                  <span className="text-xs text-gray-400">{c.type}</span>
                </button>
              ))}
              {filteredCompanies.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-400">
                  검색 결과 없음
                </div>
              )}
            </div>
          )}
          {selectedCompany && (
            <div className="mt-3 p-4 bg-indigo-50 rounded-xl text-sm">
              <p className="font-medium text-indigo-900">
                💡 {selectedCompany.name} 면접 인사이트
              </p>
              <p className="text-indigo-700 mt-1">
                면접 분위기: {selectedCompany.tone}
              </p>
            </div>
          )}
        </section>

        {/* JD URL */}
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            채용 링크 (선택)
          </label>
          <p className="text-xs text-gray-400 mb-3">
            채용공고 URL을 입력하면 JD 기반 맞춤 질문을 생성합니다
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://careers.example.com/jobs/..."
              value={jdUrl}
              onChange={(e) => {
                setJdUrl(e.target.value);
                setJdData(null);
                setJdError(null);
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            <button
              onClick={handleJdAnalyze}
              disabled={!jdUrl.trim() || jdLoading}
              className="px-5 py-3 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {jdLoading ? "분석 중..." : "분석"}
            </button>
          </div>
          {jdError && (
            <p className="mt-2 text-sm text-red-600">{jdError}</p>
          )}
          {jdData && (
            <div className="mt-3 p-4 bg-green-50 rounded-xl text-sm border border-green-200">
              <p className="font-medium text-green-900 mb-2">
                ✅ {jdData.company} - {jdData.position} JD 분석 완료
              </p>
              {jdData.requirements.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-600">자격요건:</span>
                  <p className="text-xs text-gray-700 mt-0.5">
                    {jdData.requirements.slice(0, 3).join(" / ")}
                    {jdData.requirements.length > 3 && ` 외 ${jdData.requirements.length - 3}건`}
                  </p>
                </div>
              )}
              {jdData.preferred.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-600">우대사항:</span>
                  <p className="text-xs text-gray-700 mt-0.5">
                    {jdData.preferred.slice(0, 3).join(" / ")}
                    {jdData.preferred.length > 3 && ` 외 ${jdData.preferred.length - 3}건`}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Position */}
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            지원 직무
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {POSITIONS.map((p) => (
              <button
                key={p}
                onClick={() => setPosition(p)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  position === p
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </section>

        {/* Interview type */}
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            면접 유형 (복수 선택 가능)
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            {INTERVIEW_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleType(t.id)}
                className={`p-4 rounded-xl text-left transition-all border-2 ${
                  selectedTypes.includes(t.id)
                    ? "border-primary bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedTypes.includes(t.id)
                        ? "bg-primary border-primary"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedTypes.includes(t.id) && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-sm text-gray-900">
                    {t.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 ml-7">{t.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Duration */}
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            진행 방식
          </label>
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setMode("count")}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                mode === "count"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              질문 수로 설정
            </button>
            <button
              onClick={() => setMode("time")}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                mode === "time"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              시간으로 설정
            </button>
          </div>

          {mode === "count" ? (
            <div>
              <input
                type="range"
                min={3}
                max={20}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>3개</span>
                <span className="text-primary font-semibold text-sm">
                  {questionCount}개
                </span>
                <span>20개</span>
              </div>
              <div className="flex gap-2 mt-3">
                {[5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      questionCount === n
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {n}개
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <input
                type="range"
                min={10}
                max={60}
                step={5}
                value={timeMinutes}
                onChange={(e) => setTimeMinutes(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>10분</span>
                <span className="text-primary font-semibold text-sm">
                  {timeMinutes}분
                </span>
                <span>60분</span>
              </div>
              <div className="flex gap-2 mt-3">
                {[15, 30, 45, 60].map((n) => (
                  <button
                    key={n}
                    onClick={() => setTimeMinutes(n)}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      timeMinutes === n
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {n}분
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Start */}
        <button
          onClick={handleStart}
          disabled={selectedTypes.length === 0}
          className="w-full py-4 bg-primary text-white text-lg font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
        >
          면접 시작하기
        </button>
      </div>
    </div>
  );
}
