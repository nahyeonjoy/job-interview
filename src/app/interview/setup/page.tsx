"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveState, loadState } from "@/store/interview";
import {
  MOCK_COMPANIES,
  POSITIONS,
  INTERVIEW_TYPES,
  INTERVIEWER_ROLES,
  INTERVIEWER_GENDERS,
  INTERVIEWER_MOODS,
} from "@/data/mock";
import type { ResumeData, JDData } from "@/store/interview";

export default function InterviewSetupPage() {
  const router = useRouter();
  const [experienceLevel, setExperienceLevel] = useState<"신입" | "경력">("경력");
  const [company, setCompany] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companySearchOpen, setCompanySearchOpen] = useState(false);
  const companySearchRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState("");
  const [positionSearch, setPositionSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["tech"]);
  const [interviewerCount, setInterviewerCount] = useState(1);
  const [interviewerRole, setInterviewerRole] = useState<string[]>(["manager"]);
  const [interviewerGender, setInterviewerGender] = useState("mixed");
  const [interviewerMood, setInterviewerMood] = useState("standard");

  const toggleInterviewerRole = (id: string) => {
    if (interviewerCount === 1) {
      setInterviewerRole([id]);
      return;
    }
    setInterviewerRole((prev) => {
      if (prev.includes(id)) return prev.filter((r) => r !== id);
      if (prev.length >= interviewerCount) return prev;
      return [...prev, id];
    });
  };
  const [mode, setMode] = useState<"time" | "count">("count");
  const [questionCount, setQuestionCount] = useState(10);
  const [timeMinutes, setTimeMinutes] = useState(30);

  // Resume states
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeAnalyzing, setResumeAnalyzing] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // Cover letter states
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);
  const [coverLetterText, setCoverLetterText] = useState("");
  const [coverLetterAnalyzing, setCoverLetterAnalyzing] = useState(false);
  const [coverLetterError, setCoverLetterError] = useState<string | null>(null);
  const [coverLetterUploaded, setCoverLetterUploaded] = useState(false);

  // JD states
  const [jdUrl, setJdUrl] = useState("");
  const [jdLoading, setJdLoading] = useState(false);
  const [jdData, setJdData] = useState<JDData | null>(null);
  const [jdError, setJdError] = useState<string | null>(null);

  useEffect(() => {
    const r = loadState("resume");
    if (r) setResume(r);
  }, []);

  useEffect(() => {
    setInterviewerRole((prev) => prev.slice(0, interviewerCount));
  }, [interviewerCount]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (companySearchRef.current && !companySearchRef.current.contains(e.target as Node)) {
        setCompanySearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const handleCoverLetterUpload = useCallback(async (file: File) => {
    setCoverLetterFile(file);
    setCoverLetterError(null);
    setCoverLetterUploaded(false);
    setCoverLetterAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/coverletter/extract", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error) {
        setCoverLetterError(data.error);
        return;
      }

      setCoverLetterText(data.rawText || "");
      setCoverLetterUploaded(true);
    } catch {
      setCoverLetterError("자기소개서 업로드 중 오류가 발생했습니다. 다시 시도하세요.");
    } finally {
      setCoverLetterAnalyzing(false);
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
      coverLetterText: coverLetterText || undefined,
      interviewerCount,
      interviewerRole,
      interviewerGender,
      interviewerMood,
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

        {/* Cover Letter Upload */}
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            자기소개서 업로드 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <p className="text-xs text-gray-400 mb-3">
            자기소개서를 함께 업로드하면 내용 기반 맞춤 질문을 추가 생성합니다
          </p>

          {!coverLetterUploaded ? (
            <div>
              <label
                className={`flex items-center justify-center gap-3 px-4 py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  coverLetterAnalyzing
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
                    if (f) handleCoverLetterUpload(f);
                  }}
                  disabled={coverLetterAnalyzing}
                />
                {coverLetterAnalyzing ? (
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
                      {coverLetterFile?.name} 업로드 중...
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">📝</span>
                    <span className="text-sm text-gray-600">
                      PDF 자기소개서를 클릭하여 업로드
                    </span>
                  </>
                )}
              </label>
              {coverLetterError && (
                <p className="mt-2 text-sm text-red-600">{coverLetterError}</p>
              )}
            </div>
          ) : (
            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span>📝</span>
                  <span className="font-medium text-gray-900">{coverLetterFile?.name}</span>
                  <span className="text-xs text-green-600 font-medium">업로드 완료</span>
                </div>
                <button
                  onClick={() => {
                    setCoverLetterFile(null);
                    setCoverLetterText("");
                    setCoverLetterUploaded(false);
                    setCoverLetterError(null);
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  삭제
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Company */}
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            지원 회사
          </label>

          {/* 선택된 회사 표시 */}
          {company ? (
            <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <span className="text-sm font-medium text-indigo-900 flex-1">{company}</span>
              <button
                onClick={() => {
                  setCompany("");
                  setCompanySearch("");
                  setCompanySearchOpen(false);
                }}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-200 hover:bg-indigo-300 transition-colors"
              >
                <svg className="w-3 h-3 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div ref={companySearchRef} className="relative">
              {/* 검색 입력 */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="회사명을 검색하세요"
                  value={companySearch}
                  onChange={(e) => {
                    setCompanySearch(e.target.value);
                    setCompanySearchOpen(true);
                  }}
                  onFocus={() => setCompanySearchOpen(true)}
                  className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
                {companySearch && (
                  <button
                    onClick={() => {
                      setCompanySearch("");
                      setCompanySearchOpen(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
                  >
                    <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* 드롭다운 */}
              {companySearchOpen && companySearch.trim() && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                  {filteredCompanies.map((c) => (
                    <button
                      key={c.name}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCompany(c.name);
                        setCompanySearch(c.name);
                        setCompanySearchOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center justify-between text-sm transition-colors"
                    >
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{c.type}</span>
                    </button>
                  ))}
                  {!filteredCompanies.some((c) => c.name === companySearch.trim()) && (
                    <>
                      {filteredCompanies.length > 0 && (
                        <div className="mx-3 border-t border-gray-100" />
                      )}
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const name = companySearch.trim();
                          setCompany(name);
                          setCompanySearch(name);
                          setCompanySearchOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center gap-2 text-sm transition-colors"
                      >
                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs shrink-0">+</span>
                        <span className="text-gray-500">
                          <span className="font-medium text-gray-900">&quot;{companySearch.trim()}&quot;</span> 직접 입력
                        </span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 선택된 회사 인사이트 */}
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
            채용 링크 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <p className="text-xs text-gray-400 mb-3">
            채용공고 URL을 입력하면 JD 기반 맞춤 질문을 생성합니다
          </p>

          {jdData ? (
            /* 등록 완료 상태 */
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
              <span className="text-green-500 text-base">✅</span>
              <span className="text-sm font-medium text-green-900 flex-1 truncate">
                {jdData.company && jdData.position
                  ? `${jdData.company} · ${jdData.position}`
                  : jdUrl}
              </span>
              <button
                onClick={() => {
                  setJdData(null);
                  setJdUrl("");
                  setJdError(null);
                }}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-green-200 hover:bg-green-300 transition-colors shrink-0"
              >
                <svg className="w-3 h-3 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            /* 입력 상태 */
            <div className="relative">
              <input
                type="url"
                placeholder="https://careers.example.com/jobs/..."
                value={jdUrl}
                onChange={(e) => {
                  setJdUrl(e.target.value);
                  setJdError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && jdUrl.trim() && !jdLoading) handleJdAnalyze();
                }}
                className="w-full pl-4 pr-20 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
              <button
                onClick={handleJdAnalyze}
                disabled={!jdUrl.trim() || jdLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {jdLoading ? (
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : "등록"}
              </button>
            </div>
          )}

          {jdError && (
            <p className="mt-2 text-sm text-red-600">{jdError}</p>
          )}
        </section>

        {/* Position */}
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            지원 직무
          </label>

          {/* 선택된 직무 태그 */}
          {position && (
            <div className="flex items-center gap-2 px-4 py-3 mb-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <span className="text-sm font-medium text-indigo-900 flex-1">{position}</span>
              <button
                onClick={() => {
                  setPosition("");
                  setPositionSearch("");
                }}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-200 hover:bg-indigo-300 transition-colors"
              >
                <svg className="w-3 h-3 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* 검색 입력 */}
          <div className="relative mb-3">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="직무를 검색하거나 직접 입력하세요"
              value={positionSearch}
              onChange={(e) => setPositionSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && positionSearch.trim()) {
                  setPosition(positionSearch.trim());
                  setPositionSearch("");
                }
              }}
              className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
          </div>

          {/* 빠른 선택 칩 */}
          {(() => {
            const filtered = POSITIONS.filter((p) =>
              p.includes(positionSearch.trim())
            );
            const showDirect =
              positionSearch.trim() &&
              !POSITIONS.some((p) => p === positionSearch.trim());
            return (
              <>
                {filtered.length > 0 && (
                  <>
                    <p className="text-xs text-gray-400 mb-2">빠른 선택</p>
                    <div className="flex flex-wrap gap-2">
                      {filtered.map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setPosition(p);
                            setPositionSearch("");
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            position === p
                              ? "bg-primary text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {showDirect && (
                  <button
                    onClick={() => {
                      setPosition(positionSearch.trim());
                      setPositionSearch("");
                    }}
                    className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    <span className="w-4 h-4 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs">+</span>
                    <span className="text-gray-500">
                      <span className="font-medium text-gray-900">&quot;{positionSearch.trim()}&quot;</span> 직접 입력
                    </span>
                  </button>
                )}
              </>
            );
          })()}
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

        {/* Interviewer settings */}
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-4">
            면접관 설정
          </label>
          <div className="space-y-5">

            {/* 인원 */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">인원</p>
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setInterviewerCount(n)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      interviewerCount === n
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {n}명
                  </button>
                ))}
              </div>
            </div>

            {/* 역할 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500">역할</p>
                {interviewerCount > 1 && (
                  <span className="text-xs text-gray-400">
                    {interviewerRole.length}/{interviewerCount}명 선택
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {INTERVIEWER_ROLES.map((r) => {
                  const selected = interviewerRole.includes(r.id);
                  const maxReached = interviewerCount > 1 && !selected && interviewerRole.length >= interviewerCount;
                  return (
                    <button
                      key={r.id}
                      onClick={() => toggleInterviewerRole(r.id)}
                      disabled={maxReached}
                      className={`p-3 rounded-xl text-left transition-all border-2 ${
                        selected
                          ? "border-primary bg-indigo-50"
                          : maxReached
                          ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-base">{r.icon}</span>
                        <span className="text-sm font-medium text-gray-900">{r.label}</span>
                        {selected && interviewerCount > 1 && (
                          <span className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                            {interviewerRole.indexOf(r.id) + 1}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 ml-6">{r.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 성별 */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">성별</p>
              <div className="flex gap-2">
                {INTERVIEWER_GENDERS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setInterviewerGender(g.id)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      interviewerGender === g.id
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 분위기 */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">분위기</p>
              <div className="grid grid-cols-3 gap-2">
                {INTERVIEWER_MOODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setInterviewerMood(m.id)}
                    className={`p-3 rounded-xl text-center transition-all border-2 ${
                      interviewerMood === m.id
                        ? "border-primary bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-xl mb-1">{m.icon}</div>
                    <p className="text-sm font-medium text-gray-900">{m.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

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
