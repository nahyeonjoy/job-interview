"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveState } from "@/store/interview";
import type { ResumeData } from "@/store/interview";
import { extractPdfText } from "@/lib/pdf-extract";
import { analyzeResumeText } from "@/lib/interview-ai";

export default function ResumePage() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setAnalyzed(false);
    setResumeData(null);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);

    try {
      const rawText = await extractPdfText(file);

      if (!rawText || rawText.trim().length < 10) {
        setError("PDF에서 텍스트를 추출할 수 없습니다. 다른 파일을 시도하세요.");
        return;
      }

      const data = await analyzeResumeText(rawText);

      const result: ResumeData = {
        fileName: file.name,
        name: data.name || "지원자",
        experience: data.experience || [],
        projects: data.projects || [],
        skills: data.skills || [],
        weakPoints: data.weakPoints || [],
        rawText: rawText.slice(0, 10000),
      };

      setResumeData(result);
      saveState("resume", result);
      setAnalyzed(true);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const message =
        err instanceof Error && err.message.includes("timeout")
          ? "AI 분석 시간이 초과되었습니다. 다시 시도하세요."
          : `이력서 분석에 실패했습니다. (${detail})`;
      setError(message);
      console.error("Resume analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">이력서 분석</h1>
      <p className="text-gray-500 mb-8">
        이력서를 업로드하면 AI가 면접 질문 포인트를 미리 분석해드립니다
      </p>

      {/* Upload area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-primary bg-indigo-50"
            : file
            ? "border-green-400 bg-green-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".pdf,.docx,.doc"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl">
              📄
            </div>
            <p className="font-semibold text-gray-900">{file.name}</p>
            <p className="text-sm text-gray-500">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setAnalyzed(false);
                setResumeData(null);
                setError(null);
              }}
              className="text-sm text-red-500 hover:text-red-700"
            >
              파일 변경
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-3xl">
              📤
            </div>
            <p className="font-semibold text-gray-900">
              이력서를 드래그하거나 클릭하여 업로드
            </p>
            <p className="text-sm text-gray-400">PDF, DOCX (최대 10MB)</p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Analyze button */}
      {file && !analyzed && (
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="mt-6 w-full py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {analyzing ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
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
              AI 분석 중...
            </>
          ) : (
            "AI 이력서 분석 시작"
          )}
        </button>
      )}

      {/* Analysis result */}
      {analyzed && resumeData && (
        <div className="mt-8 space-y-6">
          <div className="p-6 bg-indigo-50 rounded-2xl">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-xl">🔍</span> 분석 결과 요약
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-700">이름:</span>{" "}
                <span className="text-gray-900">{resumeData.name}</span>
              </div>
              {resumeData.experience.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">경력:</span>
                  <ul className="mt-1 ml-4 list-disc text-gray-600">
                    {resumeData.experience.map((exp, i) => (
                      <li key={i}>{exp}</li>
                    ))}
                  </ul>
                </div>
              )}
              {resumeData.skills.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">기술 스택:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {resumeData.skills.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-1 bg-white rounded-md text-xs font-medium text-indigo-700 border border-indigo-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Projects */}
          {resumeData.projects.length > 0 && (
            <div className="p-6 bg-blue-50 rounded-2xl">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-xl">💼</span> 주요 프로젝트
              </h3>
              <div className="space-y-3">
                {resumeData.projects.map((proj, i) => (
                  <div
                    key={i}
                    className="p-3 bg-white rounded-xl border border-blue-200"
                  >
                    <p className="font-medium text-gray-900 text-sm">
                      {proj.name}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {proj.description}
                    </p>
                    {proj.tech.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {proj.tech.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 bg-blue-100 rounded text-xs text-blue-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak points */}
          {resumeData.weakPoints.length > 0 && (
            <div className="p-6 bg-amber-50 rounded-2xl">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-xl">⚠️</span> 면접 질문 공격 포인트
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                면접에서 질문이 나올 가능성이 높은 포인트입니다
              </p>
              <ul className="space-y-2">
                {resumeData.weakPoints.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="mt-0.5 w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold text-amber-800 shrink-0">
                      {i + 1}
                    </span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => router.push("/interview/setup")}
            className="w-full py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors"
          >
            면접 설정으로 이동
          </button>
        </div>
      )}
    </div>
  );
}
