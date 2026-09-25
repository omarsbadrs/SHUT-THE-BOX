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
const command = async (page: Page, code: string, cmd: Record<string, unknown>) => {
  const res = await api(page, `/api/rooms/${code}/command`, { command: cmd, commandId: crypto.randomUUID() });
  expect(res.ok, JSON.stringify(res)).toBe(true);
  return res;
};

test("guess who duel: private cards, auto-answered questions, typed questions, flips and a winning guess", async ({ browser }) => {
  const omar = await phone(browser);
  const sara = await phone(browser);

  // Omar creates a Guess Who room with the Pharaohs deck through the wizard.
  await omar.goto("/");
  await omar.getByTestId("home-gw-create").click();
  await omar.getByTestId("nickname").fill("Omar");
  await omar.getByTestId("color-blue").click();
  await omar.getByTestId("create-next").click();
  await omar.getByTestId("gw-deck-pharaohs").click();
  await omar.getByTestId("create-finish-now").click();
  await expect(omar.getByTestId("lobby")).toBeVisible();
  await expect(omar.getByTestId("lobby-title")).toHaveText(/GUESS WHO/);
  const code = (await omar.getByTestId("lobby-code").innerText()).trim();

  await sara.goto(`/join/${code}`);
  await expect(sara.getByTestId("join-game")).toHaveText(/GUESS WHO/);
  await sara.getByTestId("nickname").fill("Sara");
  await sara.getByTestId("color-red").click();
  await sara.getByTestId("join-button").click();
  await sara.getByTestId("ready-button").click();

  // Deal known cards: Omar = Tutankhamun, Sara = Nefertiti.
  await command(omar, code, { type: "DEV_GW_FORCE_SECRETS", cards: ["pharaohs/tutankhamun", "pharaohs/nefertiti"] });
  await omar.getByTestId("start-game").click();
  for (const p of [omar, sara]) await expect(p.getByTestId("gw-board")).toBeVisible({ timeout: 15_000 });

  // Each phone knows only its own card.
  await expect(omar.getByTestId("gw-my-card")).toHaveAttribute("data-card", "pharaohs/tutankhamun", { timeout: 10_000 });
  await expect(sara.getByTestId("gw-my-card")).toHaveAttribute("data-card", "pharaohs/nefertiti");
  for (const p of [omar, sara]) {
    const s = JSON.stringify(await api(p, `/api/rooms/${code}/state`));
    const ev = JSON.stringify(await api(p, `/api/rooms/${code}/events?since=0`));
    expect(s).not.toContain("secrets");
    expect(ev).not.toContain("secrets");
  }
  const sState = await api(sara, `/api/rooms/${code}/state`);
  expect(sState.personal.card).toBe("pharaohs/nefertiti");

  const omarId = (await api(omar, `/api/rooms/${code}/state`)).me as string;
  const firstIsOmar = sState.state.match.round.currentId === omarId;
  const [first, second] = firstIsOmar ? [omar, sara] : [sara, omar];
  const secondCard = firstIsOmar ? "nefertiti" : "tutankhamun";

  // Ready-made question: "Is it a queen or woman?" — answered by the server on both phones.
  await first.getByTestId("gw-ask").click();
  await first.getByTestId("gw-q-female").click();
  const expected = firstIsOmar ? "yes" : "no"; // Nefertiti is a queen; Tutankhamun isn't
  for (const p of [first, second]) await expect(p.getByTestId("gw-stamp").first()).toHaveAttribute("data-answer", expected);
  await expect(second.getByTestId("gw-status")).toContainText("YOUR TURN");

  // The helper flips every card that answer rules out; the rival sees the count drop.
  await first.getByTestId("gw-auto-flip").click();
  const firstColor = firstIsOmar ? "blue" : "red";
  await expect(second.getByTestId(`gw-left-${firstColor}`)).not.toHaveText(/24/);
  await expect(first.getByTestId(`gw-card-${secondCard}`)).toHaveAttribute("data-down", "no"); // the real card stays up

  // Typed question: the other phone answers YES/NO.
  await second.getByTestId("gw-ask").click();
  await second.getByTestId("gw-free-input").fill("Is your card made of gold?");
  await second.getByTestId("gw-free-send").click();
  await expect(first.getByTestId("gw-pending-text")).toHaveText("“Is your card made of gold?”");
  await first.getByTestId(firstIsOmar ? "gw-answer-yes" : "gw-answer-no").click();
  await expect(second.getByTestId("gw-last-question")).toContainText("gold");

  // The first player guesses right and wins the round; both phones reveal both cards.
  await first.getByTestId("gw-guess").click();
  await first.getByTestId(`gw-card-${secondCard}`).click();
  await first.getByTestId("gw-confirm-guess").click();
  for (const p of [omar, sara]) {
    await expect(p.getByTestId("gw-round-results")).toBeVisible({ timeout: 10_000 });
    await expect(p.getByTestId("gw-reveal-blue")).toHaveAttribute("data-card", "pharaohs/tutankhamun");
    await expect(p.getByTestId("gw-reveal-red")).toHaveAttribute("data-card", "pharaohs/nefertiti");
  }

  // Host ends the match: results + shareable page.
  await command(omar, code, { type: "END_MATCH" });
  const matchId = (await api(omar, `/api/rooms/${code}/state`)).state.match.id as string;
  await expect.poll(async () => (await api(omar, `/api/matches/${matchId}`)).summary?.game).toBe("guesswho");
  await omar.goto(`/results/${matchId}`);
  await expect(omar.getByTestId("gw-match-results")).toBeVisible();
  await omar.getByTestId("tab-rounds").click();
  await expect(omar.getByTestId("gw-rounds")).toBeVisible();

  await omar.context().close();
  await sara.context().close();
});

test("guess who vs the bot runs on the phone (no server room)", async ({ browser }) => {
  const p = await phone(browser);
  await p.goto("/guesswho/practice");
  await p.getByTestId("gw-deck-food").click();
  await p.getByTestId("gw-solo-start").click();
  await expect(p.getByTestId("gw-board")).toBeVisible();
  await expect(p.getByTestId("gw-my-card")).toHaveAttribute("data-card", /^food\//, { timeout: 10_000 });
  // Play until the bot has asked something back.
  for (let i = 0; i < 3; i++) {
    const ask = p.getByTestId("gw-ask");
    await expect(ask).toBeEnabled({ timeout: 15_000 });
    await ask.click();
    await p.locator("[data-testid^='gw-q-']:not([disabled])").first().click();
    if (await p.getByTestId("gw-round-results").isVisible()) break;
  }
  await p.getByTestId("gw-log-button").click();
  await expect(p.getByTestId("gw-log").locator("li")).not.toHaveCount(0);
  await expect(p.getByTestId("gw-log")).toContainText("?");
  await p.context().close();
});
