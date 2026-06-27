"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const isInterviewSession = pathname === "/interview/session";

  if (isInterviewSession) return null;

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-xl font-bold text-gray-900">면접이</span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/resume"
            className={`text-sm font-medium ${
              pathname === "/resume"
                ? "text-primary"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            이력서 관리
          </Link>
          <Link
            href="/interview/setup"
            className={`text-sm font-medium ${
              pathname?.startsWith("/interview")
                ? "text-primary"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            면접 시작
          </Link>
          <Link
            href="/login"
            className="ml-4 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
          >
            로그인
          </Link>
        </nav>
      </div>
    </header>
  );
}
