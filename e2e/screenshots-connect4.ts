/**
 * Connect 4 + themes visual run (server needs dev tools):
 *   node --experimental-strip-types e2e/screenshots-connect4.ts <baseUrl> <outDir> [width] [height]
 */
import { chromium, devices, type Page } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3] ?? "screenshots";
const width = Number(process.argv[4] ?? 375);
const height = Number(process.argv[5] ?? 548);
const browser = await chromium.launch();
const seen = ["shut10", "hangman", "guesswho", "connect4"].map((g) => ({ name: `s10_guide_seen_${g}`, value: "1" }));
const phone = { ...devices["iPhone 13"], viewport: { width, height }, baseURL: base, storageState: { cookies: [], origins: [{ origin: base, localStorage: seen }] } };

const post = (page: Page, url: string, body: unknown) =>
  page.evaluate(async ([u, b]) => (await fetch(u as string, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json(), [url, body] as const);
const cmd = (page: Page, code: string, command: unknown) => post(page, `/api/rooms/${code}/command`, { command, commandId: crypto.randomUUID() });
const shot = (page: Page, name: string) => page.screenshot({ path: `${out}/${name}.png` });

const a = await (await browser.newContext(phone)).newPage();
const b = await (await browser.newContext(phone)).newPage();
await a.goto("/");
await a.waitForTimeout(2500);
await shot(a, "c4-01-hub");
await a.getByTestId("theme-button").click();
await a.waitForTimeout(400);
await shot(a, "c4-02-theme-sheet");
await a.getByTestId("theme-violet").click();
await a.waitForTimeout(400);
await shot(a, "c4-03-theme-violet");
await a.keyboard.press("Escape");
await a.goto("/connect4/create");
await a.getByTestId("nickname").fill("Omar");
await a.getByTestId("create-next").click();
await a.waitForTimeout(500);
await shot(a, "c4-04-create-game");

// ── Duel ──
await a.goto("/");
const room = await post(a, "/api/rooms", { game: "connect4", nickname: "Omar", avatar: "🦊", color: "red", settings: { rounds: 3, turnTimer: 20 } });
const code = room.code as string;
await b.goto("/");
await cmd(b, code, { type: "JOIN", nickname: "Sara", avatar: "🐼", color: "yellow" });
await cmd(b, code, { type: "SET_READY", ready: true });
await a.goto(`/room/${code}`);
await a.getByTestId("lobby").waitFor();
await a.waitForTimeout(500);
await shot(a, "c4-05-lobby");
await b.goto(`/room/${code}`);
await a.getByTestId("start-game").click();
await a.getByTestId("c4-board").waitFor({ timeout: 15_000 });
await a.waitForTimeout(3600);
// red (a) and yellow (b) alternate
const moves = [0, 6, 1, 5, 2, 6];
for (let i = 0; i < moves.length; i++) {
  const p = i % 2 === 0 ? a : b;
  await p.getByTestId(`c4-col-${moves[i]}`).click();
  await a.waitForTimeout(650);
}
await a.waitForTimeout(300);
await shot(a, "c4-06-midgame");
await a.getByTestId("c4-col-3").click(); // red completes 0-1-2-3 on the bottom row
await a.waitForTimeout(2200);
await shot(a, "c4-07-win-line");
await shot(b, "c4-08-rival-view");
await a.waitForTimeout(7000);
await shot(a, "c4-09-next-round");
await cmd(a, code, { type: "END_MATCH" });
await a.getByTestId("c4-match-results").waitFor({ timeout: 15_000 }).catch(() => undefined);
await a.waitForTimeout(7000);
await shot(a, "c4-10-match-results");
if (await a.getByTestId("tab-rounds").isVisible()) {
  await a.getByTestId("tab-rounds").click();
  await a.waitForTimeout(400);
  await shot(a, "c4-11-results-rounds");
}

// ── PopOut vs bot, on the phone ──
const c = await (await browser.newContext(phone)).newPage();
await c.goto("/connect4/practice");
await c.waitForTimeout(500);
await shot(c, "c4-12-practice-setup");
await c.getByText(/PopOut/).first().click();
await c.getByTestId("c4-solo-start").click();
await c.getByTestId("c4-board").waitFor();
await c.waitForTimeout(3600);
for (const col of [3, 2, 4]) {
  await c.getByTestId(`c4-col-${col}`).click();
  await c.waitForTimeout(1800);
}
await shot(c, "c4-13-popout");
await c.getByTestId("c4-action").getByRole("button").nth(1).click();
await c.waitForTimeout(400);
await shot(c, "c4-14-popout-pop-mode");

// ── themes on the game screen ──
for (const th of ["ocean", "crimson", "mint", "midnight"]) {
  await c.getByTestId("menu-button").click();
  await c.getByTestId(`theme-${th}`).click();
  await c.keyboard.press("Escape");
  await c.waitForTimeout(500);
  await shot(c, `c4-15-theme-${th}`);
}

// Arabic hub + big board
await c.context().addCookies([{ name: "s10_lang", value: "ar", url: base }]);
await c.goto("/");
await c.waitForTimeout(2000);
await shot(c, "c4-16-hub-ar");
await c.goto("/connect4/practice");
await c.getByText("9 × 7").click();
await c.getByTestId("c4-solo-start").click();
await c.getByTestId("c4-board").waitFor();
await c.waitForTimeout(3600);
await shot(c, "c4-17-big-board-ar");
await browser.close();
console.log("done");
