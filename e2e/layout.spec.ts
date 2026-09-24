import { expect, test, type Page } from "@playwright/test";

/**
 * Layout regression: no screen may scroll sideways on a phone, and on desktop
 * the game column stays narrow (mobile layout, centered).
 */

const PHONES = [
  { name: "small-android", width: 360, height: 740 },
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
      // Content inside an intentional horizontal scroller is fine.
      let p = el.parentElement;
      let scrolled = false;
      while (p) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") {
          scrolled = true;
          break;
        }
        p = p.parentElement;
      }
      if (!scrolled && getComputedStyle(el).position !== "fixed") offenders.push(`${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 60)} → ${Math.round(r.right)}px`);
    }
    return { scrollWidth: document.documentElement.scrollWidth, vw, offenders: offenders.slice(0, 5) };
  });
}

async function setupRoom(page: Page) {
  await page.goto("/");
  return page.evaluate(async () => {
    const post = (url: string, body: unknown) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    const room = await post("/api/rooms", { nickname: "Layout", avatar: "🦊", color: "blue" });
    for (let i = 0; i < 3; i++) await post(`/api/rooms/${room.code}/command`, { command: { type: "ADD_BOT", level: "easy" }, commandId: crypto.randomUUID() });
    return room.code as string;
  });
}

for (const vp of PHONES) {
  test(`no sideways scrolling on ${vp.name} (${vp.width}px)`, async ({ browser }) => {
    const context = await browser.newContext({ ...test.info().project.use, viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const code = await setupRoom(page);

    const screens: Array<[string, () => Promise<void>]> = [
      ["home", async () => void (await page.goto("/"))],
      ["create", async () => void (await page.goto("/create"))],
      [
        "create+advanced",
        async () => {
          await page.goto("/create");
          await page.getByText(/More options|خيارات أكثر/).click();
          await page.getByTestId("format").getByRole("button", { name: "Custom", exact: true }).click();
        },
      ],
      ["join", async () => void (await page.goto("/join"))],
      ["practice", async () => void (await page.goto("/practice"))],
      ["profile", async () => void (await page.goto("/profile"))],
      ["lobby", async () => void (await page.goto(`/room/${code}`))],
      [
        "game",
        async () => {
          await page.goto(`/room/${code}`);
          await page.getByTestId("start-game").click();
          await expect(page.getByTestId("game-view")).toHaveAttribute("data-phase", "PLAYER_TURN", { timeout: 20_000 });
          // Tallest state: my turn, dice rolled, choosing tiles.
          await page.evaluate(async (c) => {
            const post = (body: unknown) =>
              fetch(`/api/rooms/${c}/command`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: body, commandId: crypto.randomUUID() }) });
            const me = (await (await fetch(`/api/rooms/${c}/state`)).json()).me;
            await post({ type: "DEV_SET_TURN", playerId: me });
            await post({ type: "DEV_FORCE_DICE", dice: [[3, 5]] });
          }, code);
          await page.getByTestId("roll-button").click();
          await expect(page.getByTestId("choose-prompt")).toBeVisible();
        },
      ],
    ];
    for (const [name, open] of screens) {
      await open();
      await page.waitForTimeout(400);
      const r = await horizontalOverflow(page);
      expect.soft(r.offenders, `${name} @${vp.width}px has elements past the screen edge`).toEqual([]);
      expect.soft(r.scrollWidth, `${name} @${vp.width}px scrolls sideways`).toBeLessThanOrEqual(r.vw);
    }
    // The game screen must fit the phone with no vertical scrolling, in both views.
    for (const view of ["table", "players"]) {
      if ((await page.getByTestId("game-view").getAttribute("data-view")) !== view) await page.getByTestId("view-toggle").click();
      await expect(page.getByTestId("game-view")).toHaveAttribute("data-view", view);
      await page.waitForTimeout(300);
      const v = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, vh: window.innerHeight }));
      expect.soft(v.sh, `game (${view} view) @${vp.width}x${vp.height} scrolls vertically`).toBeLessThanOrEqual(v.vh);
      const close = await page.getByTestId("close-tiles").boundingBox();
      expect.soft(close && close.y + close.height <= v.vh, `CLOSE TILES visible in ${view} view @${vp.width}x${vp.height}`).toBe(true);
    }
    // Arabic (RTL) create page too.
    await context.addCookies([{ name: "s10_lang", value: "ar", url: test.info().project.use.baseURL as string }]);
    await page.goto("/create");
    const ar = await horizontalOverflow(page);
    expect.soft(ar.offenders, `create (ar) @${vp.width}px`).toEqual([]);
    await context.close();
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
