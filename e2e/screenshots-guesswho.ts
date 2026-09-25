/**
 * Guess Who visual run (server needs dev tools):
 *   node --experimental-strip-types e2e/screenshots-guesswho.ts <baseUrl> <outDir> [width] [height]
 */
import { chromium, devices, type Page } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3] ?? "screenshots";
const width = Number(process.argv[4] ?? 375);
const height = Number(process.argv[5] ?? 548);
const browser = await chromium.launch();
const phone = { ...devices["iPhone 13"], viewport: { width, height }, baseURL: base };

const post = (page: Page, url: string, body: unknown) =>
  page.evaluate(async ([u, b]) => (await fetch(u as string, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json(), [url, body] as const);
const cmd = (page: Page, code: string, command: unknown) => post(page, `/api/rooms/${code}/command`, { command, commandId: crypto.randomUUID() });
const state = (page: Page, code: string) => page.evaluate(async (c) => (await fetch(`/api/rooms/${c}/state`)).json(), code);
const shot = (page: Page, name: string) => page.screenshot({ path: `${out}/${name}.png` });

const a = await (await browser.newContext(phone)).newPage();
const b = await (await browser.newContext(phone)).newPage();
await a.goto("/");
await a.waitForTimeout(2500);
await shot(a, "gw-01-hub");
await a.goto("/guesswho/create");
await a.getByTestId("nickname").fill("Omar");
await a.getByTestId("create-next").click();
await a.waitForTimeout(500);
await shot(a, "gw-02-create-deck");

// ── Duel ──
await a.goto("/");
const room = await post(a, "/api/rooms", { game: "guesswho", nickname: "Omar", avatar: "🦊", color: "blue", settings: { category: "stars", rounds: 3, turnTimer: 60 } });
const code = room.code as string;
await b.goto("/");
await cmd(b, code, { type: "JOIN", nickname: "Sara", avatar: "🐼", color: "red" });
await cmd(b, code, { type: "SET_READY", ready: true });
await cmd(a, code, { type: "DEV_GW_FORCE_SECRETS", cards: ["stars/adel_emam", "stars/soad_hosny"] });
await a.goto(`/room/${code}`);
await a.getByTestId("lobby").waitFor();
await a.waitForTimeout(500);
await shot(a, "gw-03-lobby");
await b.goto(`/room/${code}`);
await a.getByTestId("start-game").click();
await a.getByTestId("gw-board").waitFor({ timeout: 15_000 });
await a.waitForTimeout(4200);
await shot(a, "gw-04-board");

const s = await state(a, code);
const aId = s.me as string;
const aFirst = s.state.match.round.currentId === aId;
const [first, second] = aFirst ? [a, b] : [b, a];
await first.getByTestId("gw-ask").click();
await first.waitForTimeout(500);
await shot(first, "gw-05-ask-sheet");
await first.getByTestId("gw-q-female").click();
await first.waitForTimeout(1400);
await shot(first, "gw-06-answer-stamp");
await shot(second, "gw-07-opponent-sees");
if (await first.getByTestId("gw-auto-flip").isVisible()) {
  await first.getByTestId("gw-auto-flip").click();
  await first.waitForTimeout(900);
  await shot(first, "gw-08-auto-flipped");
}

// Typed question from the second player
await second.getByTestId("gw-ask").click();
await second.getByTestId("gw-free-input").fill("Is your star famous for comedy?");
await second.getByTestId("gw-free-send").click();
await first.getByTestId("gw-answer-prompt").waitFor();
await first.waitForTimeout(500);
await shot(first, "gw-09-answer-prompt");
await first.getByTestId("gw-answer-yes").click();
await second.waitForTimeout(1200);
await shot(second, "gw-10-free-answered");

// First player guesses right
await first.getByTestId("gw-guess").click();
const target = first === a ? "soad_hosny" : "adel_emam";
await first.getByTestId(`gw-card-${target}`).click();
await first.waitForTimeout(500);
await shot(first, "gw-11-confirm-guess");
await first.getByTestId("gw-confirm-guess").click();
await first.getByTestId("gw-round-results").waitFor();
await first.waitForTimeout(1800);
await shot(first, "gw-12-reveal");
await cmd(a, code, { type: "END_MATCH" });
await a.getByTestId("gw-match-results").waitFor({ timeout: 15_000 }).catch(() => undefined);
await a.waitForTimeout(8000);
await shot(a, "gw-13-match-results");
const rounds = a.getByTestId("tab-rounds");
if (await rounds.isVisible()) {
  await rounds.click();
  await a.waitForTimeout(400);
  await shot(a, "gw-14-results-rounds");
}

// Solo vs bot
const c = await (await browser.newContext(phone)).newPage();
await c.goto("/guesswho/practice");
await c.waitForTimeout(600);
await shot(c, "gw-15-practice-setup");
await c.getByTestId("gw-solo-start").click();
await c.getByTestId("gw-board").waitFor();
await c.waitForTimeout(8000);
await shot(c, "gw-16-practice-game");
await c.goto("/credits");
await c.waitForTimeout(800);
await shot(c, "gw-17-credits");

// Arabic
await c.context().addCookies([{ name: "s10_lang", value: "ar", url: base }]);
await c.goto("/");
await c.waitForTimeout(2000);
await shot(c, "gw-18-hub-ar");
await c.goto("/guesswho/practice");
await c.getByTestId("gw-solo-start").click();
await c.getByTestId("gw-board").waitFor();
await c.waitForTimeout(6000);
await shot(c, "gw-19-practice-ar");
await browser.close();
console.log("done");
