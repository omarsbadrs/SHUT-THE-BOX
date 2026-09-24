/**
 * Visual smoke run: captures phone-sized screenshots of the main screens.
 * Usage: node --experimental-strip-types e2e/screenshots.ts <baseUrl> <outDir>
 */
import { chromium, devices } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3200";
const out = process.argv[3] ?? "screenshots";

async function main() {
  const browser = await chromium.launch();
  const phone = { ...devices["iPhone 13"], baseURL: base };
  const a = await (await browser.newContext(phone)).newPage();
  const bCtx = await browser.newContext(phone);
  const b = await bCtx.newPage();
  const shot = (p: typeof a, name: string) => p.screenshot({ path: `${out}/${name}.png` });
  const cmd = (p: typeof a, code: string, command: unknown) =>
    p.evaluate(
      async ([c, body]) =>
        (await fetch(`/api/rooms/${c}/command`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: body, commandId: crypto.randomUUID() }) })).json(),
      [code, command] as const,
    );

  await a.goto("/");
  await a.waitForTimeout(1800);
  await shot(a, "01-home");
  await a.goto("/create");
  await a.getByTestId("nickname").fill("Omar");
  await shot(a, "02-create");
  await a.getByTestId("create-finish-now").click();
  await a.getByTestId("lobby").waitFor();
  const code = (await a.getByTestId("lobby-code").innerText()).trim();
  await b.goto(`/join/${code}`);
  await b.getByTestId("nickname").fill("Ahmed");
  await b.getByTestId("color-green").click();
  await shot(b, "03-join");
  await b.getByTestId("join-button").click();
  await b.getByTestId("lobby").waitFor();
  await cmd(a, code, { type: "ADD_BOT", level: "normal" });
  await cmd(a, code, { type: "ADD_BOT", level: "hard" });
  await b.getByTestId("ready-button").click();
  await a.waitForTimeout(800);
  await shot(a, "04-lobby");
  await a.getByTestId("start-game").click();
  await a.waitForTimeout(1200);
  await shot(a, "05-countdown");
  await a.waitForTimeout(5800);
  const me = (await a.evaluate(async (c) => (await fetch(`/api/rooms/${c}/state`)).json(), code)).me;
  await cmd(a, code, { type: "DEV_SET_TURN", playerId: me });
  await cmd(a, code, { type: "DEV_FORCE_DICE", dice: [[3, 5], [2, 6]] });
  await a.waitForTimeout(700);
  await shot(a, "06-your-turn");
  await a.getByTestId("roll-button").click();
  await a.waitForTimeout(1500);
  await a.getByTestId("tile-3").click();
  await a.getByTestId("tile-5").click();
  await a.waitForTimeout(400);
  await shot(a, "07-selecting");
  await a.getByTestId("close-tiles").click();
  await a.waitForTimeout(900);
  await shot(a, "08-after-close");
  await shot(b, "09-opponent-view");
  await b.getByTestId("roll-button").click();
  await b.waitForTimeout(400);
  await shot(a, "10-opponent-rolling");
  await b.waitForTimeout(1500);
  await b.getByTestId("tile-8").click();
  await b.getByTestId("close-tiles").click();
  await a.waitForTimeout(3500);
  await cmd(a, code, { type: "DEV_SET_TILES", playerId: me, openTiles: [9, 10] });
  await cmd(a, code, { type: "DEV_SET_TURN", playerId: me });
  await cmd(a, code, { type: "DEV_FORCE_DICE", dice: [[1, 1]] });
  await a.waitForTimeout(600);
  await a.getByTestId("roll-button").click();
  await a.waitForTimeout(1300);
  await shot(a, "11-checking");
  await a.waitForTimeout(1300);
  await shot(a, "12-blocked");
  await a.waitForTimeout(2500);
  const bId = (await b.evaluate(async (c) => (await fetch(`/api/rooms/${c}/state`)).json(), code)).me;
  await cmd(a, code, { type: "DEV_SHUT_BOARD", playerId: bId });
  await b.waitForTimeout(700);
  await shot(b, "13-shut-the-box");
  await b.waitForTimeout(3500);
  await shot(b, "14-round-results");
  await cmd(a, code, { type: "END_MATCH" });
  await a.waitForTimeout(1500);
  await a.evaluate(() => window.scrollTo(0, 0));
  await shot(a, "15-match-results");
  await a.setViewportSize({ width: 390, height: 1500 });
  await shot(a, "15b-match-results-full");
  await a.goto("/practice");
  await a.waitForTimeout(600);
  await a.getByTestId("solo-roll").click();
  await a.waitForTimeout(1200);
  await shot(a, "16-practice");
  // Arabic RTL
  await b.evaluate(() => (document.cookie = "s10_lang=ar; path=/"));
  await b.goto("/");
  await b.waitForTimeout(1500);
  await shot(b, "17-home-ar");
  await b.goto(`/room/${code}`);
  await b.waitForTimeout(2000);
  await shot(b, "18-results-ar");
  await browser.close();
  console.log("done", code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
