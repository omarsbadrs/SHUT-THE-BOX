import { expect, test, type Browser, type Page } from "@playwright/test";

async function phone(browser: Browser) {
  const context = await browser.newContext({ ...test.info().project.use });
  return context.newPage();
}

const api = (page: Page, path: string, body?: unknown) =>
  page.evaluate(
    async ([p, b]) => (await fetch(p as string, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined)).json(),
    [path, body] as const,
  );

test("connect 4 duel: discs sync on both phones, four in a row wins, results are shareable", async ({ browser }) => {
  const omar = await phone(browser);
  const sara = await phone(browser);

  await omar.goto("/");
  await omar.getByTestId("home-c4-create").click();
  await omar.getByTestId("nickname").fill("Omar");
  await omar.getByTestId("color-red").click();
  await expect(omar.getByTestId("color-blue")).toHaveCount(0); // red & yellow only
  await omar.getByTestId("create-finish-now").click();
  await expect(omar.getByTestId("lobby")).toBeVisible();
  await expect(omar.getByTestId("lobby-title")).toHaveText(/CONNECT 4/);
  await expect(omar.getByTestId("seat-green")).toHaveCount(0);
  const code = (await omar.getByTestId("lobby-code").innerText()).trim();

  await sara.goto(`/join/${code}`);
  await expect(sara.getByTestId("join-game")).toHaveText(/CONNECT 4/);
  await sara.getByTestId("nickname").fill("Sara");
  await sara.getByTestId("join-button").click();
  await sara.getByTestId("ready-button").click();
  await omar.getByTestId("start-game").click();
  for (const p of [omar, sara]) await expect(p.getByTestId("c4-board")).toBeVisible({ timeout: 15_000 });
  await expect(omar.getByTestId("c4-status")).toContainText("YOUR TURN", { timeout: 10_000 });

  const omarId = (await api(omar, `/api/rooms/${code}/state`)).me as string;
  // Red (Omar) opens: bottom row 0,1,2,3 while Sara stacks column 6.
  const plan: Array<[Page, number]> = [
    [omar, 0],
    [sara, 6],
    [omar, 1],
    [sara, 6],
    [omar, 2],
    [sara, 6],
  ];
  for (const [p, col] of plan) {
    await expect(p.getByTestId(`c4-col-${col}`)).toBeEnabled();
    await p.getByTestId(`c4-col-${col}`).click();
  }
  // Both phones show the same discs in the same holes.
  for (const p of [omar, sara]) {
    await expect(p.getByTestId("c4-disc-0-0")).toHaveAttribute("data-owner", omarId);
    await expect(p.getByTestId("c4-disc-6-2")).toBeVisible();
  }
  await expect(sara.getByTestId("c4-col-3")).toBeDisabled(); // not Sara's turn
  await omar.getByTestId("c4-col-3").click();

  await expect(omar.getByTestId("c4-headline")).toHaveText(/YOU WIN/);
  await expect(sara.getByTestId("c4-headline")).toHaveText(/SO CLOSE/);
  for (const p of [omar, sara]) await expect(p.getByTestId("c4-win-line")).toBeVisible();

  // Host ends the match; the result is archived and shareable.
  await omar.getByTestId("menu-button").click();
  await omar.getByTestId("end-match").click();
  const matchId = (await api(omar, `/api/rooms/${code}/state`)).state.match.id as string;
  await expect.poll(async () => (await api(omar, `/api/matches/${matchId}`)).summary?.game).toBe("connect4");
  await omar.goto(`/results/${matchId}`);
  await expect(omar.getByTestId("c4-match-results")).toBeVisible();
  await omar.getByTestId("tab-rounds").click();
  await expect(omar.getByTestId("c4-rounds")).toBeVisible();

  await omar.context().close();
  await sara.context().close();
});

test("connect 4 vs the bot on the phone, in Arabic: the tapped column is the one that fills", async ({ browser }) => {
  const p = await phone(browser);
  await p.context().addCookies([{ name: "s10_lang", value: "ar", url: test.info().project.use.baseURL as string }]);
  await p.goto("/connect4/practice");
  await p.getByTestId("c4-bot-level").getByRole("button").first().click(); // easy
  await p.getByTestId("c4-solo-start").click();
  await expect(p.getByTestId("c4-board")).toBeVisible();
  await expect(p.getByTestId("c4-col-0")).toBeEnabled({ timeout: 10_000 });
  await p.getByTestId("c4-col-0").click();
  await expect(p.getByTestId("c4-disc-0-0")).toBeVisible();
  // The bot answers with a disc of its own.
  await expect(p.locator("[data-testid^='c4-disc-']")).toHaveCount(2, { timeout: 10_000 });
  await p.context().close();
});

test("the colour theme applies instantly and is remembered on the next visit", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "emerald");
  await page.getByTestId("theme-button").click();
  await page.getByTestId("theme-ocean").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
  const night = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-night").trim());
  expect(night).toBe("#050d18");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean"); // server-rendered from the cookie
  // Game menus offer it too.
  await page.goto("/practice");
  await page.getByTestId("practice-menu").click();
  await expect(page.getByTestId("theme-picker")).toBeVisible();
});
