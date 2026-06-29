export interface ResumeData {
  fileName: string;
  name: string;
  experience: string[];
  projects: { name: string; description: string; tech: string[] }[];
  skills: string[];
  weakPoints: string[];
  rawText: string;
}

export interface JDData {
  url: string;
  company: string;
  position: string;
  requirements: string[];
  preferred: string[];
  description: string;
  rawText: string;
}

export interface InterviewSetup {
  company: string;
  position: string;
  interviewTypes: string[];
  questionCount: number;
  difficulty: string;
  interviewerTone: string;
  experienceLevel: "신입" | "경력";
  jd?: JDData;
  coverLetterText?: string;
  interviewerCount: number;
  interviewerRole: string[];
  interviewerGender: string;
  interviewerMood: string;
}

export interface QuestionAnswer {
  id: number;
  question: string;
  answer: string;
  category: string;
  score: number;
  feedback: string;
  followUp?: string;
  transcript?: string;
  followUpQ?: string;
  followUpA?: string;
  aiScore?: number;
  aiFeedback?: string;
}

export interface InterviewResult {
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
  voiceAnalysis: {
    confidence: number;
    clarity: number;
    stability: number;
    energy: number;
    wpm: number;
    fillerCount: number;
  };
  strengths: string[];
  improvements: string[];
  overallFeedback: string;
  qas: QuestionAnswer[];
}

const STORAGE_KEY = "myeonjeob-i-state";

interface AppState {
  resume: ResumeData | null;
  setup: InterviewSetup | null;
  result: InterviewResult | null;
}

export function saveState(key: keyof AppState, data: unknown) {
  if (typeof window === "undefined") return;
  const current = loadFullState();
  current[key] = data as never;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function loadState<K extends keyof AppState>(key: K): AppState[K] {
  if (typeof window === "undefined") return null as AppState[K];
  const current = loadFullState();
  return current[key];
}

function loadFullState(): AppState {
  if (typeof window === "undefined") return { resume: null, setup: null, result: null };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { resume: null, setup: null, result: null };
  } catch {
    return { resume: null, setup: null, result: null };
  }
}
