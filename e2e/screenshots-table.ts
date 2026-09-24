/**
 * Table-view screenshots for 2, 3 and 4 players on a phone, plus desktop.
 * Usage: node --experimental-strip-types e2e/screenshots-table.ts <baseUrl> <outDir>   (server needs dev tools)
 */
import { chromium, devices, type Page } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3] ?? "screenshots";
const browser = await chromium.launch();

async function game(page: Page, bots: number, color: string) {
  await page.goto("/");
  const code = await page.evaluate(
    async ([n, col]) => {
      const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      const room = await post("/api/rooms", { nickname: "Omar Badr", avatar: "🦊", color: col });
      for (let i = 0; i < (n as number); i++) await post(`/api/rooms/${room.code}/command`, { command: { type: "ADD_BOT", level: "easy" }, commandId: crypto.randomUUID() });
      return room.code as string;
    },
    [bots, color] as const,
  );
  await page.goto(`/room/${code}`);
  await page.getByTestId("start-game").click();
  await page.getByTestId("game-view").and(page.locator("[data-phase=PLAYER_TURN]")).waitFor({ timeout: 20000 });
  await page.evaluate(async (c) => {
    const post = (body: unknown) => fetch(`/api/rooms/${c}/command`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: body, commandId: crypto.randomUUID() }) });
    const me = (await (await fetch(`/api/rooms/${c}/state`)).json()).me;
    await post({ type: "DEV_SET_TURN", playerId: me });
    await post({ type: "DEV_FORCE_DICE", dice: [[6, 3]] });
  }, code);
  await page.getByTestId("roll-button").click();
  await page.getByTestId("choose-prompt").waitFor();
  await page.waitForTimeout(1400); // let the dice land and the total appear
  await page.getByTestId("tile-4").click();
  await page.waitForTimeout(400);
}

for (const [bots, color] of [[1, "red"], [2, "blue"], [3, "red"]] as const) {
  const page = await (await browser.newContext({ ...devices["iPhone 13"], baseURL: base })).newPage();
  await game(page, bots, color);
  await page.screenshot({ path: `${out}/table-${bots + 1}p-phone.png` });
  await page.context().close();
}
const desk = await (await browser.newContext({ viewport: { width: 1434, height: 1080 }, baseURL: base })).newPage();
await game(desk, 1, "red");
await desk.screenshot({ path: `${out}/table-2p-desktop.png` });
await browser.close();
console.log("done");
