import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * Four phones: Omar (host, blue), Ahmed (green), Sara (red), Karim (yellow).
 * Follows the acceptance scenario and the spec's E2E plan.
 */

interface Phone {
  name: string;
  color: "blue" | "green" | "red" | "yellow";
  context: BrowserContext;
  page: Page;
}

async function newPhone(browser: Browser, name: string, color: Phone["color"]): Promise<Phone> {
  const context = await browser.newContext({ ...test.info().project.use });
  const page = await context.newPage();
  return { name, color, context, page };
}

async function api(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ([p, b]) => {
      const res = await fetch(p as string, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined);
      return res.json();
    },
    [path, body] as const,
  );
}

async function command(page: Page, code: string, command: Record<string, unknown>) {
  const res = await api(page, `/api/rooms/${code}/command`, { command, commandId: crypto.randomUUID() });
  expect(res.ok, JSON.stringify(res)).toBe(true);
  return res;
}

async function serverState(page: Page, code: string) {
  return api(page, `/api/rooms/${code}/state`);
}

test("four phones play a synchronized Face-Off round", async ({ browser }) => {
  const omar = await newPhone(browser, "Omar", "blue");
  const ahmed = await newPhone(browser, "Ahmed", "green");
  const sara = await newPhone(browser, "Sara", "red");
  const karim = await newPhone(browser, "Karim", "yellow");
  const phones = [omar, ahmed, sara, karim];

  // ── A creates the room ──
  await omar.page.goto("/");
  await omar.page.getByTestId("home-create").click();
  await omar.page.getByTestId("nickname").fill("Omar");
  await omar.page.getByTestId("color-blue").click();
  await omar.page.getByTestId("create-finish-now").click();
  await expect(omar.page.getByTestId("lobby")).toBeVisible();
  const code = (await omar.page.getByTestId("lobby-code").innerText()).trim();
  expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);

  // ── B, C, D join via the invite URL ──
  for (const p of [ahmed, sara, karim]) {
    await p.page.goto(`/join/${code}`);
    await p.page.getByTestId("nickname").fill(p.name);
    await p.page.getByTestId(`color-${p.color}`).click();
    await p.page.getByTestId("join-button").click();
    await expect(p.page.getByTestId("lobby")).toBeVisible();
  }
  for (const p of phones) await expect(p.page.getByTestId("player-count")).toContainText("4 / 4");

  // ── All ready; host starts ──
  await expect(omar.page.getByTestId("start-game")).toBeDisabled();
  for (const p of [ahmed, sara, karim]) await p.page.getByTestId("ready-button").click();
  for (const p of phones) for (const c of phones) await expect(p.page.getByTestId(`ready-${c.color}`)).toHaveText(/READY/);
  await expect(omar.page.getByTestId("start-game")).toBeEnabled();
  await omar.page.getByTestId("start-game").click();

  // Everyone sees the 3·2·1 intro.
  for (const p of phones) await expect(p.page.getByTestId("game-view")).toBeVisible();
  for (const p of phones) await expect(p.page.getByTestId("intro")).toBeVisible();
  for (const p of phones) await expect(p.page.getByTestId("game-view")).toHaveAttribute("data-phase", "PLAYER_TURN", { timeout: 20_000 });

  // Identify seats from the server.
  const ids: Record<string, string> = {};
  for (const p of phones) ids[p.name] = (await serverState(p.page, code)).me;

  // Acceptance: Omar gets the first turn and rolls 3 + 5 = 8 (server-generated, forced by dev tools).
  await command(omar.page, code, { type: "DEV_SET_TURN", playerId: ids.Omar });
  await command(omar.page, code, { type: "DEV_FORCE_DICE", dice: [[3, 5], [2, 6]] });
  await expect(omar.page.getByTestId("roll-button")).toBeEnabled();
  await expect(ahmed.page.getByTestId("roll-button")).toHaveCount(0);
  await omar.page.getByTestId("roll-button").click();

  // All phones see the same result.
  for (const p of phones) await expect(p.page.getByTestId("dice-total")).toHaveText("8");
  await expect(omar.page.getByTestId("choose-prompt")).toContainText("8");

  await omar.page.getByTestId("tile-3").click();
  await expect(omar.page.getByTestId("selection-readout")).toContainText("3 / 8");
  await omar.page.getByTestId("tile-6").click();
  await expect(omar.page.getByTestId("selection-readout")).toContainText("Too high");
  await expect(omar.page.getByTestId("close-tiles")).toBeDisabled();
  await omar.page.getByTestId("tile-6").click();
  await omar.page.getByTestId("tile-5").click();
  await expect(omar.page.getByTestId("selection-readout")).toContainText("3 + 5 = 8");
  await omar.page.getByTestId("close-tiles").click();

  // Tiles 3 and 5 close on every phone.
  await expect(omar.page.getByTestId("tile-3")).toHaveAttribute("data-state", "closed");
  await expect(omar.page.getByTestId("tile-5")).toHaveAttribute("data-state", "closed");
  for (const p of [ahmed, sara, karim]) {
    await expect(p.page.getByTestId("mini-blue-3")).toHaveAttribute("data-state", "closed");
    await expect(p.page.getByTestId("mini-blue-5")).toHaveAttribute("data-state", "closed");
    await expect(p.page.getByTestId("mini-blue-4")).toHaveAttribute("data-state", "open");
  }

  // Turn passes to Ahmed (BLUE → GREEN), who rolls 2 + 6 and closes 8.
  await expect(ahmed.page.getByTestId("your-turn")).toBeVisible();
  await ahmed.page.getByTestId("roll-button").click();
  for (const p of phones) await expect(p.page.getByTestId("dice-total")).toHaveText("8");
  await ahmed.page.getByTestId("tile-8").click();
  await ahmed.page.getByTestId("close-tiles").click();
  for (const p of [omar, sara, karim]) await expect(p.page.getByTestId("mini-green-8")).toHaveAttribute("data-state", "closed");

  // Turn continues to Sara (GREEN → RED).
  await expect(sara.page.getByTestId("your-turn")).toBeVisible();

  // ── Force Sara's phone to disconnect and reconnect ──
  const before = (await serverState(sara.page, code)).state.match.round.players[ids.Sara].openTiles as number[];
  await sara.page.close();
  sara.page = await sara.context.newPage();
  await sara.page.goto(`/room/${code}`);
  await expect(sara.page.getByTestId("game-view")).toBeVisible();
  await expect(sara.page.getByTestId("your-turn")).toBeVisible();
  for (let v = 1; v <= 10; v++) {
    await expect(sara.page.getByTestId(`tile-${v}`)).toHaveAttribute("data-state", before.includes(v) ? "open" : "closed");
  }
  // Her own view of the others is intact too.
  await expect(sara.page.getByTestId("mini-blue-3")).toHaveAttribute("data-state", "closed");
  await expect(sara.page.getByTestId("mini-green-8")).toHaveAttribute("data-state", "closed");

  // ── Finish the round (everyone blocked) and compare scores on all phones ──
  await command(omar.page, code, { type: "DEV_NEXT_ROUND" });
  for (const p of phones) await expect(p.page.getByTestId("round-results")).toBeVisible();
  const truth = (await serverState(omar.page, code)).state.match.history[0].entries as Array<{ playerId: string; openTileSum: number }>;
  const byColor: Record<string, number> = {};
  for (const p of phones) byColor[p.color] = truth.find((e) => e.playerId === ids[p.name])!.openTileSum;
  expect(byColor).toEqual({ blue: 47, green: 47, red: 55, yellow: 55 });
  for (const p of phones) {
    for (const c of phones) {
      await expect(p.page.getByTestId(`round-result-${c.color}`)).toHaveAttribute("data-score", String(byColor[c.color]));
    }
  }

  // ── Host ends the match; rematch keeps the room, players and code ──
  await command(omar.page, code, { type: "END_MATCH" });
  for (const p of phones) await expect(p.page.getByTestId("match-results")).toBeVisible();
  await omar.page.getByTestId("rematch").click();
  for (const p of phones) await expect(p.page.getByTestId("game-view")).toBeVisible();
  const after = await serverState(omar.page, code);
  expect(after.state.code).toBe(code);
  expect(after.state.players).toHaveLength(4);
  expect(after.state.match.number).toBe(2);

  for (const p of phones) await p.context.close();
});

test("refresh restores the game exactly", async ({ browser }) => {
  const a = await newPhone(browser, "Host", "blue");
  const b = await newPhone(browser, "Guest", "green");
  await a.page.goto("/create");
  await a.page.getByTestId("nickname").fill("Host");
  await a.page.getByTestId("create-finish-now").click();
  const code = (await a.page.getByTestId("lobby-code").innerText()).trim();
  await b.page.goto(`/join/${code}`);
  await b.page.getByTestId("nickname").fill("Guest");
  await b.page.getByTestId("join-button").click();
  await b.page.getByTestId("ready-button").click();
  await a.page.getByTestId("start-game").click();
  await expect(a.page.getByTestId("game-view")).toHaveAttribute("data-phase", "PLAYER_TURN", { timeout: 20_000 });
  const hostId = (await serverState(a.page, code)).me;
  await command(a.page, code, { type: "DEV_SET_TURN", playerId: hostId });
  await command(a.page, code, { type: "DEV_FORCE_DICE", dice: [[4, 6]] });
  await a.page.getByTestId("roll-button").click();
  await a.page.getByTestId("tile-10").click();
  await a.page.getByTestId("close-tiles").click();
  await expect(a.page.getByTestId("tile-10")).toHaveAttribute("data-state", "closed");

  await a.page.reload();
  await expect(a.page.getByTestId("game-view")).toBeVisible();
  await expect(a.page.getByTestId("tile-10")).toHaveAttribute("data-state", "closed");
  await expect(a.page.getByTestId("my-score")).toHaveText("45");
  await b.page.reload();
  await expect(b.page.getByTestId("mini-blue-10")).toHaveAttribute("data-state", "closed");
  await expect(b.page.getByTestId("your-turn")).toBeVisible();
  await a.context.close();
  await b.context.close();
});
