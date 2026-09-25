import { expect, test, type Page } from "@playwright/test";

/**
 * Layout regression. The app never scrolls: on every phone size, every
 * screen must fit — nothing past the screen edge (either axis), nothing cut
 * off by a clipping container, and no internal scroll areas. On desktop the
 * game column stays narrow (mobile layout, centered).
 */

const PHONES = [
  { name: "iphone-se-safari", width: 375, height: 548 },
  { name: "small-android", width: 360, height: 640 },
  { name: "iphone", width: 390, height: 664 },
  { name: "pixel", width: 412, height: 839 },
];

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) continue;
      // Content inside an intentional clipper is fine.
      let p = el.parentElement;
      let clipped = false;
      while (p) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") {
          clipped = true;
          break;
        }
        p = p.parentElement;
      }
      if (!clipped && getComputedStyle(el).position !== "fixed") offenders.push(`${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 60)} → ${Math.round(r.right)}px`);
    }
    return { scrollWidth: document.documentElement.scrollWidth, vw, offenders: offenders.slice(0, 5) };
  });
}

/** Visible controls/text that fall below the screen, are cut off by a clipping parent, or sit in a scroll area. */
async function verticalProblems(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const out: string[] = [];
    const label = (el: Element) => `${el.tagName.toLowerCase()}${el.getAttribute("data-testid") ? `[${el.getAttribute("data-testid")}]` : ""}.${el.className.toString().slice(0, 40)} "${(el.textContent ?? "").trim().slice(0, 24)}"`;
    const hidden = (el: Element) => {
      for (let p: Element | null = el; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0 || p.getAttribute("aria-hidden") === "true") return true;
      }
      return false;
    };
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("button, a, input, [data-testid], h1, h2, li, p"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || hidden(el)) continue;
      if (r.bottom > vh + 2 || r.top < -2) {
        out.push(`off-screen ${label(el)} bottom=${Math.round(r.bottom)} vh=${vh}`);
        continue;
      }
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const oy = getComputedStyle(p).overflowY;
        if (oy === "visible") continue;
        const pr = p.getBoundingClientRect();
        if (r.bottom > pr.bottom + 2 && r.top < pr.bottom) {
          out.push(`clipped ${label(el)} by ${label(p)} (${Math.round(r.bottom)} > ${Math.round(pr.bottom)})`);
          break;
        }
      }
    }
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 2) out.push(`scroll area ${label(el)}`);
    }
    // Lobby seats and the player count must not sit on top of each other.
    const boxes = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='lobby'] [data-testid^='seat-'], [data-testid='player-count']")).map((el) => ({ el, r: el.getBoundingClientRect() }));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r;
        const b = boxes[j].r;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 2 && h > 2) out.push(`overlap ${label(boxes[i].el)} × ${label(boxes[j].el)}`);
      }
    return [...new Set(out)].slice(0, 6);
  });
}

type Api = (path: string, body?: unknown) => Promise<Record<string, unknown> & { ok?: boolean }>;
const api = (page: Page): Api => (path, body) =>
  page.evaluate(
    async ([p, b]) =>
      (await fetch(p as string, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined)).json(),
    [path, body] as const,
  );
const cmd = (page: Page, code: string, command: Record<string, unknown>) => api(page)(`/api/rooms/${code}/command`, { command, commandId: crypto.randomUUID() });

async function setupRooms(page: Page) {
  await page.goto("/");
  const call = api(page);
  const shut = (await call("/api/rooms", { nickname: "Layout", avatar: "🦊", color: "blue" })).code as string;
  for (let i = 0; i < 3; i++) await cmd(page, shut, { type: "ADD_BOT", level: "easy" });
  const hm = (await call("/api/rooms", { game: "hangman", nickname: "Layout", avatar: "🦊", color: "blue", settings: { gameMode: "hangman_race", language: "ar", rounds: 3, maxPlayers: 4 } })).code as string;
  for (let i = 0; i < 3; i++) await cmd(page, hm, { type: "ADD_BOT", level: "easy" });
  await cmd(page, hm, { type: "DEV_HM_FORCE_WORD", words: ["كرة القدم"] });
  const open = (await call("/api/rooms", { nickname: "Host With A Long Name", avatar: "🐯", color: "green" })).code as string;
  await cmd(page, open, { type: "ADD_BOT", level: "easy" });
  const gw = (await call("/api/rooms", { game: "guesswho", nickname: "Layout", avatar: "🦊", color: "blue", settings: { category: "pharaohs", boardSize: 24 } })).code as string;
  await cmd(page, gw, { type: "ADD_BOT", level: "easy" });
  return { shut, hm, open, gw };
}

for (const vp of PHONES) {
  test(`every screen fits ${vp.name} (${vp.width}x${vp.height}) with no scrolling`, async ({ browser }) => {
    test.setTimeout(360_000);
    const context = await browser.newContext({ ...test.info().project.use, viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const guestContext = await browser.newContext({ ...test.info().project.use, viewport: { width: vp.width, height: vp.height } });
    const guest = await guestContext.newPage();
    const rooms = await setupRooms(page);

    const check = async (name: string) => {
      await page.waitForTimeout(450);
      const h = await horizontalOverflow(page);
      expect.soft(h.offenders, `${name} @${vp.width}x${vp.height} has elements past the screen edge`).toEqual([]);
      expect.soft(h.scrollWidth, `${name} @${vp.width}x${vp.height} scrolls sideways`).toBeLessThanOrEqual(h.vw);
      const v = await verticalProblems(page);
      if (v.length || process.env.LAYOUT_SHOTS) await page.screenshot({ path: `test-results/layout-${vp.name}-${name.replace(/[^a-z0-9]+/gi, "_")}.png` });
      expect.soft(v, `${name} @${vp.width}x${vp.height} does not fit vertically`).toEqual([]);
    };
    const wizard = async (name: string, prefix: string, steps: string[]) => {
      for (let i = 0; i < steps.length; i++) {
        if (i > 0) await page.getByTestId(`${prefix}-next`).click();
        await expect(page.getByTestId(prefix)).toHaveAttribute("data-step", steps[i]);
        await check(`${name}/${steps[i]}`);
      }
    };

    await page.goto("/");
    await check("home");
    // Every page of every beginner guide fits too.
    for (const game of ["shut10", "hangman", "guesswho"]) {
      await page.getByTestId(`guide-open-${game}`).click();
      for (let i = 0; i < 8; i++) {
        await check(`guide ${game} p${i + 1}`);
        if (!(await page.getByTestId("guide-next").isVisible())) break;
        await page.getByTestId("guide-next").click();
      }
      await page.getByTestId("guide-done").click();
      await expect(page.getByTestId(`guide-${game}`)).toBeHidden();
    }
    await page.goto("/create");
    await page.getByTestId("nickname").fill("Layout");
    await wizard("create", "create", ["you", "game", "rules", "more"]);
    await page.goto("/hangman/create");
    await page.getByTestId("nickname").fill("Layout");
    await wizard("hangman-create", "create", ["you", "game", "rules"]);
    await page.goto("/guesswho/create");
    await page.getByTestId("nickname").fill("Layout");
    await wizard("guesswho-create", "create", ["you", "game", "rules"]);
    await page.goto("/join");
    await check("join");
    await guest.goto(`/join/${rooms.open}`);
    await expect(guest.getByTestId("join-button")).toBeVisible();
    {
      // the guest page is a different phone — check it directly
      const v = await verticalProblems(guest);
      expect.soft(v, `join preview @${vp.width}x${vp.height}`).toEqual([]);
    }
    await page.goto("/practice");
    await check("practice");
    await page.getByTestId("solo-roll").click();
    await page.waitForTimeout(900);
    await check("practice rolled");
    await page.goto("/hangman/practice");
    await check("hangman practice setup");
    await page.getByTestId("hm-solo-start").click();
    await check("hangman practice game");
    await page.goto("/profile");
    for (const tab of ["you", "settings", "stats", "account"]) {
      await page.getByTestId(`profile-tab-${tab}`).click();
      await check(`profile/${tab}`);
    }

    // SHUT10 lobby + settings editor
    await page.goto(`/room/${rooms.shut}`);
    await expect(page.getByTestId("lobby")).toBeVisible();
    await check("lobby");
    await page.getByTestId("edit-settings").click();
    await wizard("lobby editor", "editor", ["game", "rules", "more"]);
    await page.keyboard.press("Escape");
    await page.goto(`/room/${rooms.shut}`);

    // SHUT10 game, tallest state: my turn, dice rolled, choosing tiles — both views
    await page.getByTestId("start-game").click();
    await expect(page.getByTestId("game-view")).toHaveAttribute("data-phase", "PLAYER_TURN", { timeout: 20_000 });
    const me = (await api(page)(`/api/rooms/${rooms.shut}/state`)).me as string;
    await cmd(page, rooms.shut, { type: "DEV_SET_TURN", playerId: me });
    await cmd(page, rooms.shut, { type: "DEV_FORCE_DICE", dice: [[3, 5]] });
    await page.getByTestId("roll-button").click();
    await expect(page.getByTestId("close-tiles")).toBeVisible();
    await page.waitForTimeout(900); // dice land + total appears
    for (const view of ["table", "players"]) {
      if ((await page.getByTestId("game-view").getAttribute("data-view")) !== view) await page.getByTestId("view-toggle").click();
      await expect(page.getByTestId("game-view")).toHaveAttribute("data-view", view);
      await check(`game (${view} view)`);
      await expect(page.getByTestId("close-tiles")).toBeInViewport();
    }

    // SHUT10 match results + shareable page
    await cmd(page, rooms.shut, { type: "END_MATCH" });
    await expect(page.getByTestId("match-results")).toBeVisible();
    for (const tab of ["standings", "stats"]) {
      await page.getByTestId(`tab-${tab}`).click();
      await check(`match results/${tab}`);
    }
    const shutMatch = ((await api(page)(`/api/rooms/${rooms.shut}/state`)).state as { match: { id: string } }).match.id;
    await expect.poll(async () => !!(await api(page)(`/api/matches/${shutMatch}`)).summary).toBe(true);
    await page.goto(`/results/${shutMatch}`);
    await expect(page.getByTestId("match-results")).toBeVisible();
    await check("results page (shut10)");

    // Hangman (Arabic race — the widest keyboard)
    await page.goto(`/room/${rooms.hm}`);
    await expect(page.getByTestId("lobby")).toBeVisible();
    await check("hangman lobby");
    await page.getByTestId("edit-settings").click();
    await wizard("hangman lobby editor", "editor", ["game", "rules"]);
    await page.keyboard.press("Escape");
    await page.goto(`/room/${rooms.hm}`);
    await page.getByTestId("start-game").click();
    await expect(page.getByTestId("keyboard")).toBeVisible({ timeout: 15_000 });
    await check("hangman race (ar)");
    await cmd(page, rooms.hm, { type: "END_MATCH" });
    await expect(page.getByTestId("hm-match-results")).toBeVisible({ timeout: 10_000 });
    for (const tab of ["standings", "stats"]) {
      await page.getByTestId(`tab-${tab}`).click();
      await check(`hangman results/${tab}`);
    }
    const hmMatch = ((await api(page)(`/api/rooms/${rooms.hm}/state`)).state as { match: { id: string } }).match.id;
    await expect.poll(async () => ((await api(page)(`/api/matches/${hmMatch}`)).summary as { game?: string } | null)?.game).toBe("hangman");
    await page.goto(`/results/${hmMatch}`);
    await expect(page.getByTestId("hm-match-results")).toBeVisible();
    await check("results page (hangman)");

    // Guess Who: lobby, editor, board, ask sheet, results; practice vs bot; credits
    await page.goto(`/room/${rooms.gw}`);
    await expect(page.getByTestId("lobby")).toBeVisible();
    await check("guesswho lobby");
    await page.getByTestId("edit-settings").click();
    await wizard("guesswho lobby editor", "editor", ["game", "rules"]);
    await page.keyboard.press("Escape");
    await page.goto(`/room/${rooms.gw}`);
    await page.getByTestId("start-game").click();
    await expect(page.getByTestId("gw-board")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(4000); // intro
    await expect(page.getByTestId("gw-ask")).toBeEnabled({ timeout: 10_000 }); // bot may open: wait for our turn
    await check("guesswho board");
    await page.getByTestId("gw-ask").click();
    await check("guesswho ask sheet");
    await page.getByTestId("gw-q-person").click();
    await check("guesswho after answer");
    await cmd(page, rooms.gw, { type: "END_MATCH" });
    await expect(page.getByTestId("gw-match-results")).toBeVisible({ timeout: 15_000 });
    await check("guesswho results");
    await page.goto("/guesswho/practice");
    await check("guesswho practice setup");
    await page.getByTestId("gw-solo-start").click();
    await expect(page.getByTestId("gw-board")).toBeVisible();
    await page.waitForTimeout(4000);
    await check("guesswho practice game");
    await page.goto("/credits");
    await check("credits");

    // Arabic (RTL) create page too.
    await context.addCookies([{ name: "s10_lang", value: "ar", url: test.info().project.use.baseURL as string }]);
    await page.goto("/create");
    await check("create (ar)");
    await page.goto("/");
    await check("home (ar)");
    await page.goto("/guesswho/practice");
    await page.getByTestId("gw-solo-start").click();
    await expect(page.getByTestId("gw-board")).toBeVisible();
    await page.waitForTimeout(4000);
    await check("guesswho practice (ar)");
    await context.close();
    await guestContext.close();
  });
}

test("desktop keeps the phone-width column", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  for (const path of ["/", "/create", "/join", "/practice", "/profile"]) {
    await page.goto(path);
    const widest = await page.evaluate(() =>
      Math.max(
        ...Array.from(document.querySelectorAll<HTMLElement>("main *"))
          .filter((el) => getComputedStyle(el).position !== "fixed" && !el.closest("[class*='fixed']"))
          .map((el) => el.getBoundingClientRect().width),
      ),
    );
    expect.soft(widest, `${path} content column`).toBeLessThanOrEqual(560);
    const r = await horizontalOverflow(page);
    expect.soft(r.scrollWidth, `${path} desktop sideways scroll`).toBeLessThanOrEqual(r.vw);
  }
  await context.close();
});
