import { expect, test, type Browser, type Page } from "@playwright/test";

async function phone(browser: Browser) {
  const context = await browser.newContext({ ...test.info().project.use });
  return context.newPage();
}

async function apiGet(page: Page, path: string) {
  return page.evaluate(async (p) => (await fetch(p)).text(), path);
}

async function command(page: Page, code: string, command: Record<string, unknown>) {
  const res = await page.evaluate(
    async ([c, body]) => (await fetch(`/api/rooms/${c}/command`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: body, commandId: crypto.randomUUID() }) })).json(),
    [code, command] as const,
  );
  expect(res.ok, JSON.stringify(res)).toBe(true);
  return res;
}

async function noVerticalScroll(page: Page, label: string) {
  const v = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, vh: window.innerHeight }));
  expect.soft(v.sh, `${label} scrolls vertically`).toBeLessThanOrEqual(v.vh);
}

test("word master: the secret word never reaches guessers; guesses sync to every phone", async ({ browser }) => {
  const omar = await phone(browser);
  const ahmed = await phone(browser);
  const sara = await phone(browser);

  await omar.goto("/");
  await omar.getByTestId("home-hm-create").click();
  await omar.getByTestId("nickname").fill("Omar");
  await omar.getByTestId("color-blue").click();
  await omar.getByTestId("create-next").click();
  await omar.getByTestId("hm-mode").getByRole("button", { name: "Word master" }).click();
  await omar.getByTestId("create-finish-now").click();
  await expect(omar.getByTestId("lobby")).toBeVisible();
  await expect(omar.getByTestId("lobby-title")).toHaveText("HANGMAN");
  const code = (await omar.getByTestId("lobby-code").innerText()).trim();

  for (const [p, name, color] of [
    [ahmed, "Ahmed", "green"],
    [sara, "Sara", "red"],
  ] as const) {
    await p.goto(`/join/${code}`);
    await expect(p.getByTestId("join-game")).toHaveText("HANGMAN");
    await p.getByTestId("nickname").fill(name);
    await p.getByTestId(`color-${color}`).click();
    await p.getByTestId("join-button").click();
    await expect(p.getByTestId("lobby")).toBeVisible();
    await p.getByTestId("ready-button").click();
  }
  await expect(omar.getByTestId("start-game")).toBeEnabled();
  await omar.getByTestId("start-game").click();

  // Omar (blue, first seat) is word master.
  await expect(omar.getByTestId("hm-chooser")).toBeVisible({ timeout: 15_000 });
  await expect(ahmed.getByTestId("hm-status")).toContainText("OMAR IS CHOOSING");
  await omar.getByTestId("hm-word-input").fill("banana");
  await omar.getByTestId("hm-set-word").click();
  await expect(omar.getByTestId("hm-secret")).toHaveText("BANANA");

  // Guessers see only blanks — and nothing the server sends them contains the word.
  for (const p of [ahmed, sara]) {
    await expect(p.getByTestId("word-slots")).toHaveAttribute("data-mask", "______");
    for (const path of [`/api/rooms/${code}/state`, `/api/rooms/${code}/events?since=0`]) expect(await apiGet(p, path)).not.toContain("BANANA");
    await expect(p.locator("body")).not.toContainText("BANANA");
  }
  await noVerticalScroll(ahmed, "hangman guessing");

  // Ahmed (next seat) guesses A: correct, keeps the turn.
  await expect(ahmed.getByTestId("hm-status")).toContainText("YOUR TURN");
  await ahmed.getByTestId("key-A").click();
  for (const p of [omar, ahmed, sara]) await expect(p.getByTestId("word-slots")).toHaveAttribute("data-mask", "_A_A_A");
  await expect(ahmed.getByTestId("hm-status")).toContainText("YOUR TURN");
  // Wrong guess: a body part is drawn and the turn passes to Sara.
  await ahmed.getByTestId("key-Z").click();
  for (const p of [omar, ahmed, sara]) await expect(p.getByTestId("gallows")).toHaveAttribute("data-wrong", "1");
  await expect(sara.getByTestId("hm-status")).toContainText("YOUR TURN");
  await expect(ahmed.getByTestId("key-N")).toBeDisabled();
  await sara.getByTestId("key-N").click();
  for (const p of [omar, ahmed, sara]) await expect(p.getByTestId("word-slots")).toHaveAttribute("data-mask", "_ANANA");
  // Sara solves it.
  await sara.getByTestId("hm-solve").click();
  await sara.getByTestId("hm-solve-input").fill("banana");
  await sara.getByTestId("hm-solve-submit").click();
  for (const p of [omar, ahmed, sara]) {
    await expect(p.getByTestId("hm-round-results")).toBeVisible({ timeout: 10_000 });
    await expect(p.getByTestId("hm-reveal")).toHaveText("BANANA");
  }
  // Identical totals on every phone.
  const totals = async (p: Page) => Promise.all(["blue", "green", "red"].map((c) => p.getByTestId(`hm-result-${c}`).locator("[data-points]").getAttribute("data-points")));
  const expected = await totals(omar);
  // Omar (master) 0 · Ahmed 3×A = 3 · Sara 2×N + solve 3 + 1 hidden letter = 6
  expect(expected).toEqual(["0", "3", "6"]);
  for (const p of [ahmed, sara]) expect(await totals(p)).toEqual(expected);

  for (const p of [omar, ahmed, sara]) await p.context().close();
});

test("race: each board is private; Arabic letters fold alef forms", async ({ browser }) => {
  const a = await phone(browser);
  const b = await phone(browser);
  await a.goto("/");
  const room = await a.evaluate(async () =>
    (
      await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "hangman", nickname: "Host", avatar: "🦊", color: "blue", settings: { gameMode: "hangman_race", language: "ar", rounds: 3 } }),
      })
    ).json(),
  );
  const code = room.code as string;
  await b.goto(`/join/${code}`);
  await b.getByTestId("nickname").fill("Guest");
  await b.getByTestId("join-button").click();
  await b.getByTestId("ready-button").click();
  await command(a, code, { type: "DEV_HM_FORCE_WORD", words: ["الأردن"] });
  await a.goto(`/room/${code}`);
  await a.getByTestId("start-game").click();
  await expect(a.getByTestId("keyboard")).toBeVisible({ timeout: 15_000 });
  await expect(b.getByTestId("keyboard")).toBeVisible();

  // One key reveals both ا and أ on A's board only.
  await a.getByTestId("key-ا").click();
  await expect(a.getByTestId("word-slots")).toHaveAttribute("data-mask", "ا_أ___");
  await expect(b.getByTestId("word-slots")).toHaveAttribute("data-mask", "______");
  // B sees A's progress, not A's letters.
  await expect(b.getByTestId("hm-chip-blue")).toContainText("2/6");
  expect(await apiGet(b, `/api/rooms/${code}/events?since=0`)).not.toContain("الأردن");
  await noVerticalScroll(a, "hangman race (ar)");

  await b.getByTestId("hm-solve").click();
  await b.getByTestId("hm-solve-input").fill("الاردن");
  await b.getByTestId("hm-solve-submit").click();
  await a.getByTestId("hm-solve").click();
  await a.getByTestId("hm-solve-input").fill("الأردن");
  await a.getByTestId("hm-solve-submit").click();
  for (const p of [a, b]) await expect(p.getByTestId("hm-reveal")).toHaveText("الأردن", { timeout: 10_000 });
  await a.context().close();
  await b.context().close();
});
