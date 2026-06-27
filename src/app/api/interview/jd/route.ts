import { NextRequest } from "next/server";
import { generateJSON } from "@/lib/gemini";

interface JDAnalysis {
  company: string;
  position: string;
  requirements: string[];
  preferred: string[];
  description: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return Response.json({ error: "URL이 필요합니다" }, { status: 400 });
    }

    // Fetch JD page using https module to handle SSL cert issues
    const { execSync } = await import("child_process");
    let html: string;
    try {
      html = execSync(
        `curl -sL --max-time 10 -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -H "Accept: text/html" -H "Accept-Language: ko-KR,ko;q=0.9" "${url}"`,
        { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
      );
    } catch {
      return Response.json(
        { error: "URL을 불러올 수 없습니다" },
        { status: 400 }
      );
    }

    if (!html || html.length < 100) {
      return Response.json(
        { error: "URL에서 내용을 가져올 수 없습니다" },
        { status: 400 }
      );
    }

    const rawText = stripHtml(html).slice(0, 10000);

    if (rawText.length < 50) {
      return Response.json(
        { error: "해당 페이지에서 충분한 내용을 추출할 수 없습니다" },
        { status: 400 }
      );
    }

    const prompt = `다음은 채용공고 페이지의 텍스트입니다. 분석하여 JSON으로 반환하세요.

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

    const analysis = await generateJSON<JDAnalysis>(prompt);

    return Response.json({
      ...analysis,
      url,
      rawText: rawText.slice(0, 5000),
    });
  } catch (error) {
    console.error("JD analysis failed:", error);

    const message =
      error instanceof Error && error.message.includes("abort")
        ? "URL 요청 시간이 초과되었습니다."
        : "채용공고 분석에 실패했습니다.";

    return Response.json({ error: message }, { status: 500 });
  }
}
