/**
 * Hangman visual run (server needs dev tools):
 *   node --experimental-strip-types e2e/screenshots-hangman.ts <baseUrl> <outDir>
 */
import { chromium, devices, type Page } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3] ?? "screenshots";
const browser = await chromium.launch();
const phone = { ...devices["iPhone 13"], baseURL: base };

const post = (page: Page, url: string, body: unknown) =>
  page.evaluate(async ([u, b]) => (await fetch(u as string, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json(), [url, body] as const);
const cmd = (page: Page, code: string, command: unknown) => post(page, `/api/rooms/${code}/command`, { command, commandId: crypto.randomUUID() });
const shot = (page: Page, name: string) => page.screenshot({ path: `${out}/${name}.png` });

// Hub
const a = await (await browser.newContext(phone)).newPage();
const b = await (await browser.newContext(phone)).newPage();
await a.goto("/");
await a.waitForTimeout(2600);
await shot(a, "hm-01-hub");
await a.goto("/hangman/create");
await a.waitForTimeout(500);
await shot(a, "hm-02-create");

// ── Word master, 2 players ──
await a.goto("/");
const room = await post(a, "/api/rooms", { game: "hangman", nickname: "Omar", avatar: "🦊", color: "blue", settings: { gameMode: "hangman_master", guessTimer: 30, rounds: 1 } });
const code = room.code as string;
await b.goto("/");
await cmd(b, code, { type: "JOIN", nickname: "Ahmed", avatar: "🐼", color: "green" });
await cmd(b, code, { type: "SET_READY", ready: true });
await a.goto(`/room/${code}`);
await a.getByTestId("lobby").waitFor();
await a.waitForTimeout(500);
await shot(a, "hm-03-lobby");
await b.goto(`/room/${code}`);
await a.getByTestId("start-game").click();
await a.waitForTimeout(1200);
await shot(a, "hm-04-intro");
await a.getByTestId("hm-chooser").waitFor({ timeout: 10000 });
await a.waitForTimeout(1500);
await shot(b, "hm-05-waiting-choice");
await a.getByTestId("hm-word-input").fill("elephant");
await shot(a, "hm-06-chooser");
await a.getByTestId("hm-set-word").click();
await b.getByTestId("keyboard").waitFor();
for (const l of ["E", "Z", "Q", "L"]) {
  await b.getByTestId(`key-${l}`).click();
  await b.waitForTimeout(1300);
}
await shot(b, "hm-07-guessing");
await shot(a, "hm-08-master-view");
for (const l of ["X", "J", "K", "V"]) {
  await b.getByTestId(`key-${l}`).click();
  await b.waitForTimeout(1200);
}
await b.waitForTimeout(700);
await shot(b, "hm-09-hanged");
await b.waitForTimeout(2500);
await shot(b, "hm-10-round-results");
await cmd(a, code, { type: "END_MATCH" });
await a.waitForTimeout(8000);
await shot(a, "hm-11-match-results");

// ── Race, Arabic ──
const race = await post(a, "/api/rooms", { game: "hangman", nickname: "Omar", avatar: "🦊", color: "blue", settings: { gameMode: "hangman_race", language: "ar", rounds: 3 } });
const rc = race.code as string;
await cmd(b, rc, { type: "JOIN", nickname: "Ahmed", avatar: "🐼", color: "green" });
await cmd(b, rc, { type: "SET_READY", ready: true });
await cmd(a, rc, { type: "DEV_HM_FORCE_WORD", words: ["زرافة"] });
await cmd(a, rc, { type: "START" });
await a.evaluate(() => (document.cookie = "s10_lang=ar; path=/"));
await a.goto(`/room/${rc}`);
await b.goto(`/room/${rc}`);
await a.getByTestId("keyboard").waitFor({ timeout: 10000 });
for (const l of ["ا", "ر", "م"]) {
  await a.getByTestId(`key-${l}`).click();
  await a.waitForTimeout(700);
}
await b.getByTestId("key-و").click();
await b.waitForTimeout(900);
await shot(a, "hm-12-race-ar");
await a.getByTestId("hm-solve").click();
await a.getByTestId("hm-solve-input").fill("زرافه");
await shot(a, "hm-13-solve-sheet");
await a.getByTestId("hm-solve-submit").click();
await a.waitForTimeout(1200);
await shot(a, "hm-14-race-saved");

// ── Practice ──
const p = await (await browser.newContext(phone)).newPage();
await p.goto("/hangman/practice");
await p.getByTestId("hm-solo-start").click();
await p.waitForTimeout(1300);
for (const l of ["E", "A", "Z"]) {
  await p.getByTestId(`key-${l}`).click();
  await p.waitForTimeout(500);
}
await p.waitForTimeout(800);
await shot(p, "hm-15-practice");
await browser.close();
console.log("done");
