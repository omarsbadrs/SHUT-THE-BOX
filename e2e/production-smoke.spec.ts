import { expect, test, type Page } from "@playwright/test";
import { getValidCombinations } from "../src/game-engine/combinations";

/**
 * Live smoke test against a deployed URL (no dev tools, real random dice):
 *   PROD_URL=https://your-app.vercel.app npx playwright test e2e/production-smoke.spec.ts
 */
const PROD = process.env.PROD_URL;
test.skip(!PROD, "set PROD_URL to run against a deployment");

async function openTiles(page: Page): Promise<number[]> {
  const open: number[] = [];
  for (let v = 1; v <= 10; v++) if ((await page.getByTestId(`tile-${v}`).getAttribute("data-state")) !== "closed") open.push(v);
  return open;
}

test("two phones play live turns on the deployment", async ({ browser }) => {
  const opts = { ...test.info().project.use, baseURL: PROD };
  const a = await (await browser.newContext(opts)).newPage();
  const b = await (await browser.newContext(opts)).newPage();

  await a.goto("/create");
  await a.getByTestId("nickname").fill("LiveHost");
  await a.getByTestId("create-game").click();
  const code = (await a.getByTestId("lobby-code").innerText()).trim();

  await b.goto(`/join/${code}`);
  await b.getByTestId("nickname").fill("LiveGuest");
  await b.getByTestId("join-button").click();
  await expect(a.getByTestId("player-count")).toContainText("2 /", { timeout: 15_000 });
  await b.getByTestId("ready-button").click();
  await expect(a.getByTestId("start-game")).toBeEnabled();
  await a.getByTestId("start-game").click();
  for (const p of [a, b]) await expect(p.getByTestId("game-view")).toHaveAttribute("data-phase", /PLAYER_TURN/, { timeout: 25_000 });

  // Play four turns, whoever is up.
  for (let turn = 0; turn < 4; turn++) {
    const phase = await a.getByTestId("game-view").getAttribute("data-phase");
    if (phase !== "PLAYER_TURN" && phase !== "AWAITING_TILE_SELECTION") break;
    const current = (await a.getByTestId("roll-button").count()) > 0 ? a : b;
    const other = current === a ? b : a;
    await expect(current.getByTestId("roll-button")).toBeEnabled({ timeout: 15_000 });
    await current.getByTestId("roll-button").click();
    const total = Number(await current.getByTestId("dice-total").innerText());
    // Same roll visible on the other phone.
    await expect(other.getByTestId("dice-total")).toHaveText(String(total), { timeout: 10_000 });
    const combos = getValidCombinations(await openTiles(current), total);
    if (combos.length === 0) {
      await expect(current.getByTestId("blocked-overlay")).toBeVisible({ timeout: 10_000 });
      continue;
    }
    for (const v of combos[0]) await current.getByTestId(`tile-${v}`).click();
    await current.getByTestId("close-tiles").click();
    for (const v of combos[0]) await expect(current.getByTestId(`tile-${v}`)).toHaveAttribute("data-state", "closed");
    await current.waitForTimeout(1500);
  }

  // Both phones agree with the server on every board.
  const state = await a.evaluate(async (c) => (await fetch(`/api/rooms/${c}/state`)).json(), code);
  const round = state.state.match.round;
  for (const p of state.state.players) {
    const open: number[] = round.players[p.id].openTiles;
    for (const page of [a, b]) {
      const isMe = (await page.evaluate(async (c) => (await fetch(`/api/rooms/${c}/state`)).json(), code)).me === p.id;
      for (let v = 1; v <= 10; v++) {
        const loc = isMe ? page.getByTestId(`tile-${v}`) : page.getByTestId(`mini-${p.color}-${v}`);
        await expect(loc).toHaveAttribute("data-state", open.includes(v) ? "open" : "closed");
      }
    }
  }

  await a.context().close();
  await b.context().close();
});
