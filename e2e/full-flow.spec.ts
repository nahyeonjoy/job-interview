import { test, expect, type Page } from "@playwright/test";

/** Mock API responses for AI endpoints */
async function mockAIRoutes(page: Page) {
  await page.route("**/api/interview/questions", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        questions: [
          { question: "마이크로서비스 아키텍처에서 서비스 간 통신 방법에 대해 설명해주세요.", category: "tech" },
          { question: "레거시 시스템을 리팩토링한 경험이 있으신가요?", category: "job" },
          { question: "팀에서 기술적 의사결정을 할 때 어떤 기준을 적용하시나요?", category: "culture" },
          { question: "본인의 가장 큰 실패 경험은 무엇인가요?", category: "personality" },
          { question: "3년 후 어떤 엔지니어가 되고 싶으신가요?", category: "executive" },
        ],
      }),
    });
  });

  await page.route("**/api/interview/analyze", async (route) => {
    const postData = route.request().postData() || "";
    // For result page chat, return error so local fallback triggers
    if (postData.includes('"feedback"')) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: "test fallback" }),
      });
      return;
    }
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        score: 7,
        feedback: "답변의 구조가 체계적이고 실무 경험이 잘 드러났습니다.",
        followUpQuestion: null,
      }),
    });
  });

  await page.route("**/api/interview/result", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        totalScore: 78,
        grade: "B+",
        passRate: "70-80%",
        scores: { content: 80, logic: 75, technical: 82, communication: 72, voice: 70, fit: 76 },
        strengths: [
          "시스템 설계 질문에서 트레이드오프를 정확히 분석하는 능력이 돋보였습니다",
          "프로덕션 장애 대응 경험이 구체적이고 설득력 있었습니다",
          "기술적 의사결정 시 대안 비교가 체계적이었습니다",
        ],
        improvements: [
          "결론을 먼저 말하는 PREP 구조를 연습하세요",
          "필러 워드를 줄여보세요",
          "숫자로 말하세요",
        ],
        overallFeedback: "네이버 면접 기준으로 종합 평가드리겠습니다.\n\n기술 역량 측면에서는 프로덕션 경험이 잘 드러나는 답변들이 있었습니다.\n\n커뮤니케이션 면에서는 답변 구조가 비교적 체계적이었습니다.",
      }),
    });
  });
}

/** Helper: 면접 설정 → 세션까지 진행 */
async function setupAndStartSession(
  page: Page,
  opts: { company?: string; questionCount?: number } = {}
) {
  const { company = "네이버", questionCount = 5 } = opts;

  await mockAIRoutes(page);
  await page.goto("/interview/setup");

  // 회사 선택
  const searchText = company.slice(0, 2);
  await page.getByPlaceholder("회사명을 검색하세요").fill(searchText);
  await page.getByText(company, { exact: true }).click();

  // 직무 선택
  await page.getByRole("button", { name: "백엔드 개발자" }).click();

  // 질문 수 슬라이더 설정
  const slider = page.locator('input[type="range"]');
  await slider.fill(String(questionCount));

  // 면접 시작
  await page.getByRole("button", { name: "면접 시작하기" }).click();
  await page.waitForURL("**/interview/session");
}

/** Helper: 세션 → 면접 종료 → 결과 페이지 */
async function finishInterviewAndGoToResult(page: Page) {
  await page.getByRole("button", { name: "면접 시작" }).click();
  await page.waitForTimeout(2500);

  const endBtn = page.getByRole("button", { name: "면접 종료" });
  await expect(endBtn).toBeVisible({ timeout: 5000 });
  await endBtn.click();

  await expect(page.getByText("면접이 종료되었습니다")).toBeVisible({
    timeout: 15000,
  });
  await page.waitForURL("**/interview/result", { timeout: 10000 });
}

test.describe("면접이 E2E - 전체 플로우", () => {
  test("1. 랜딩 페이지 렌더링 및 네비게이션", async ({ page }) => {
    await page.goto("/");

    // 헤더 로고
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByText("면접이").first()).toBeVisible();

    // Hero 텍스트
    await expect(page.getByText("면접, 혼자 준비하지 마세요")).toBeVisible();
    await expect(page.getByText("AI가 실전처럼")).toBeVisible();

    // CTA 버튼 존재
    const ctaButton = page.getByRole("link", { name: "무료로 면접 시작하기" });
    await expect(ctaButton).toBeVisible();

    // 이력서 분석 버튼
    const resumeButton = page.getByRole("link", {
      name: "이력서 먼저 분석하기",
    });
    await expect(resumeButton).toBeVisible();

    // Features 섹션
    await expect(page.getByText("면접이만의 차별점")).toBeVisible();
    await expect(page.getByText("회사 맞춤형 질문")).toBeVisible();
    await expect(page.getByText("음성 기반 분석")).toBeVisible();

    // Steps 섹션
    await expect(page.getByText("이용 방법")).toBeVisible();

    // Footer
    await expect(page.getByText("© 2026 면접이")).toBeVisible();
  });

  test("2. CTA 버튼 → 면접 설정 페이지 이동", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "무료로 면접 시작하기" }).click();
    await page.waitForURL("**/interview/setup");
    await expect(page.getByText("면접 설정")).toBeVisible();
  });

  test("3. 헤더 네비게이션 동작", async ({ page }) => {
    await page.goto("/");

    // 이력서 관리 링크
    await page.getByRole("link", { name: "이력서 관리" }).click();
    await page.waitForURL("**/resume");
    await expect(page.getByText("이력서 분석")).toBeVisible();

    // 면접 시작 링크
    await page.getByRole("link", { name: "면접 시작" }).click();
    await page.waitForURL("**/interview/setup");
    await expect(page.getByText("면접 설정")).toBeVisible();

    // 로고 → 홈
    await page.getByText("면접이").first().click();
    await page.waitForURL("/");
  });

  test("4. 이력서 업로드 페이지", async ({ page }) => {
    await page.goto("/resume");

    await expect(page.getByText("이력서 분석")).toBeVisible();
    await expect(
      page.getByText("이력서를 드래그하거나 클릭하여 업로드")
    ).toBeVisible();

    // Mock API response for resume analysis
    await page.route("**/api/resume/analyze", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "테스트 지원자",
          experience: ["테스트 회사 - 개발자 (2년)"],
          projects: [
            { name: "테스트 프로젝트", description: "테스트용 프로젝트", tech: ["TypeScript"] },
          ],
          skills: ["TypeScript", "React", "Node.js"],
          weakPoints: ["경력 공백 존재", "성과 수치 미흡"],
          rawText: "테스트 이력서 텍스트",
        }),
      });
    });

    // 파일 업로드 시뮬레이션
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake pdf content"),
    });

    // 파일명 표시
    await expect(page.getByText("test-resume.pdf")).toBeVisible();

    // 분석 버튼 나타남
    const analyzeBtn = page.getByText("AI 이력서 분석 시작");
    await expect(analyzeBtn).toBeVisible();

    // 분석 실행
    await analyzeBtn.click();
    await expect(page.getByText("AI 분석 중...")).toBeVisible();

    // 분석 결과 대기
    await expect(page.getByText("분석 결과 요약")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("테스트 지원자")).toBeVisible();
    await expect(page.getByText("면접 질문 공격 포인트")).toBeVisible();
    await expect(page.getByText("경력 공백 존재")).toBeVisible();

    // 면접 설정 이동 버튼
    const goSetup = page.getByText("면접 설정으로 이동");
    await expect(goSetup).toBeVisible();
    await goSetup.click();
    await page.waitForURL("**/interview/setup");
  });

  test("5. 면접 설정 페이지 - 회사 검색", async ({ page }) => {
    await page.goto("/interview/setup");

    await expect(page.getByText("면접 설정")).toBeVisible();

    // 회사 검색
    const companyInput = page.getByPlaceholder("회사명을 검색하세요");
    await companyInput.fill("네이");

    // 드롭다운에 네이버 표시
    await expect(page.getByText("네이버")).toBeVisible();
    await page.getByText("네이버").click();

    // 인사이트 표시
    await expect(page.getByText("네이버 면접 인사이트")).toBeVisible();
  });

  test("6. 면접 설정 페이지 - 직무 선택", async ({ page }) => {
    await page.goto("/interview/setup");

    // 직무 선택
    const backendBtn = page.getByRole("button", { name: "백엔드 개발자" });
    await backendBtn.click();

    // 선택된 상태 확인 (bg-primary class)
    await expect(backendBtn).toHaveClass(/bg-primary/);
  });

  test("7. 면접 설정 페이지 - 면접 유형 복수 선택", async ({ page }) => {
    await page.goto("/interview/setup");

    // 기본으로 기술 면접 선택됨
    const techOption = page
      .locator("button")
      .filter({ hasText: "기술 면접" })
      .first();
    await expect(techOption).toHaveClass(/border-primary/);

    // 컬쳐핏 추가 선택
    const cultureOption = page
      .locator("button")
      .filter({ hasText: "컬쳐핏 면접" })
      .first();
    await cultureOption.click();
    await expect(cultureOption).toHaveClass(/border-primary/);
  });

  test("8. 면접 설정 → 질문 수 슬라이더 & 프리셋", async ({ page }) => {
    await page.goto("/interview/setup");

    // 슬라이더로 값 설정
    const slider = page.locator('input[type="range"]');
    await slider.fill("5");

    // 프리셋 버튼 클릭 (정확한 텍스트 매칭)
    const btn10 = page.getByRole("button", { name: "10개", exact: true });
    await btn10.click();

    const btn15 = page.getByRole("button", { name: "15개", exact: true });
    await btn15.click();

    const btn20 = page.getByRole("button", { name: "20개", exact: true });
    await btn20.click();
  });

  test("9. 면접 설정 → 시간 모드 전환", async ({ page }) => {
    await page.goto("/interview/setup");

    // 시간으로 설정 모드
    await page.getByRole("button", { name: "시간으로 설정" }).click();

    // 시간 프리셋 버튼
    await expect(page.getByRole("button", { name: "15분" })).toBeVisible();
    await expect(page.getByRole("button", { name: "30분" })).toBeVisible();
    await expect(page.getByRole("button", { name: "45분" })).toBeVisible();
    await expect(page.getByRole("button", { name: "60분" })).toBeVisible();
  });

  test("10. 면접 설정 → 면접 시작 → 세션 진입", async ({ page }) => {
    await setupAndStartSession(page, { company: "카카오", questionCount: 5 });

    // 세션 페이지 요소
    await expect(page.getByText("[카카오] 백엔드 개발자")).toBeVisible();
    await expect(page.getByText("면접 준비")).toBeVisible();
    await expect(page.getByRole("button", { name: "면접 시작" })).toBeVisible();
  });

  test("11. 면접 세션 - 질문 진행 플로우", async ({ page }) => {
    await setupAndStartSession(page, { company: "토스", questionCount: 5 });

    // 면접 시작
    await page.getByRole("button", { name: "면접 시작" }).click();

    // 질문 타이핑 대기
    await page.waitForTimeout(2500);

    // 진행 상태 표시
    await expect(page.getByText(/진행.*1\/5/)).toBeVisible();

    // 녹음 시작 버튼
    const recordBtn = page.getByRole("button", { name: "녹음 시작" });
    await expect(recordBtn).toBeVisible({ timeout: 5000 });
    await recordBtn.click();

    // 답변 완료
    const doneBtn = page.getByRole("button", { name: "답변 완료" });
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();

    // 다음 질문으로 이동 (40% 확률로 꼬리질문이 먼저 나올 수 있음)
    await page.waitForTimeout(3000);

    // 꼬리질문이 나왔으면 스킵해서 다음 질문으로 이동
    const skipBtn = page.getByRole("button", { name: "스킵" });
    if (await skipBtn.isVisible().catch(() => false)) {
      const progress = page.getByText(/진행.*1\/5/);
      if (await progress.isVisible().catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    // 진행 상태 확인
    await expect(
      page.getByText(/진행.*[2-5]\/5/).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("12. 면접 세션 - 스킵 기능", async ({ page }) => {
    await setupAndStartSession(page, { company: "네이버", questionCount: 5 });

    await page.getByRole("button", { name: "면접 시작" }).click();
    await page.waitForTimeout(2500);

    // 스킵 버튼
    const skipBtn = page.getByRole("button", { name: "스킵" });
    await expect(skipBtn).toBeVisible({ timeout: 5000 });
    await skipBtn.click();

    // 다음 질문
    await page.waitForTimeout(2500);
    await expect(page.getByText(/진행.*2\/5/)).toBeVisible({ timeout: 5000 });
  });

  test("13. 면접 세션 - 면접 종료 → 결과 페이지", async ({ page }) => {
    await setupAndStartSession(page, { company: "네이버", questionCount: 3 });
    await finishInterviewAndGoToResult(page);
    await expect(page.getByText("면접 결과")).toBeVisible();
  });

  test("14. 결과 페이지 - 챗봇 메시지 순차 표시", async ({ page }) => {
    await setupAndStartSession(page, { company: "네이버", questionCount: 3 });
    await finishInterviewAndGoToResult(page);

    // 첫 메시지
    await expect(
      page.getByText("면접 수고하셨습니다! 결과를 알려드리겠습니다.")
    ).toBeVisible({ timeout: 3000 });

    // 점수 카드
    await expect(page.getByText("/100")).toBeVisible({ timeout: 5000 });

    // 총평
    await expect(page.getByText("합격 가능성")).toBeVisible({ timeout: 8000 });

    // 음성 분석
    await expect(page.getByText("음성 분석")).toBeVisible({ timeout: 10000 });

    // 개선 포인트
    await expect(page.getByText("강점 TOP 3")).toBeVisible({ timeout: 12000 });

    // 질문별 피드백
    await expect(page.getByText("질문별 피드백")).toBeVisible({
      timeout: 14000,
    });
  });

  test("15. 결과 페이지 - 대화형 질문", async ({ page }) => {
    await setupAndStartSession(page, { company: "네이버", questionCount: 3 });
    await finishInterviewAndGoToResult(page);

    // 모든 자동 메시지 대기
    await page.waitForTimeout(10000);

    // 사용자 입력
    const input = page.getByPlaceholder("궁금한 점을 물어보세요...");
    await expect(input).toBeVisible();
    await input.fill("STAR 기법이 뭔가요?");
    await page.getByRole("button", { name: "전송" }).click();

    // 사용자 메시지 표시
    await expect(page.getByText("STAR 기법이 뭔가요?")).toBeVisible();

    // AI 응답
    await expect(page.getByText("STAR 기법은")).toBeVisible({ timeout: 3000 });
  });

  test("16. 결과 페이지 - 다시 연습하기", async ({ page }) => {
    await setupAndStartSession(page, { company: "네이버", questionCount: 3 });
    await finishInterviewAndGoToResult(page);

    await page.getByRole("button", { name: "다시 연습하기" }).click();
    await page.waitForURL("**/interview/setup");
    await expect(page.getByText("면접 설정")).toBeVisible();
  });

  test("17. 스타일 검증 - 커스텀 컬러 적용", async ({ page }) => {
    await page.goto("/");

    // primary 컬러가 CSS variable로 적용되는지 확인
    const ctaLink = page.getByRole("link", { name: "무료로 면접 시작하기" });
    const bgColor = await ctaLink.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    // bg-primary가 적용되어 있어야 함 (투명이면 문제)
    expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(bgColor).not.toBe("transparent");
  });

  test("18. 직접 URL 접근 - /interview/session (setup 없이)", async ({
    page,
  }) => {
    await page.goto("/interview/session");
    await page.waitForURL("**/interview/setup", { timeout: 5000 });
  });

  test("19. 직접 URL 접근 - /interview/result (result 없이)", async ({
    page,
  }) => {
    await page.goto("/interview/result");
    await page.waitForURL("**/interview/setup", { timeout: 5000 });
  });
});
