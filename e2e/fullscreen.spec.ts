import { devices, expect, test } from "@playwright/test";

const IPHONE_UA = devices["iPhone 15 Pro Max"]?.userAgent ?? devices["iPhone 13"].userAgent;

test("iPhone home-screen app fills the whole screen (no empty strip under the status-bar bug)", async ({ browser }) => {
  // iPhone 15 Plus: 430 × 932 screen; as a home-screen app iOS reports a viewport 59pt short.
  const context = await browser.newContext({
    ...test.info().project.use,
    userAgent: IPHONE_UA,
    viewport: { width: 430, height: 873 },
    screen: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() => Object.defineProperty(window.navigator, "standalone", { get: () => true }));
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("style", /--app-h:\s*932px/);
  const dims = await page.evaluate(() => ({ screen: [screen.width, screen.height], inner: [innerWidth, innerHeight], main: document.querySelector("main")!.getBoundingClientRect().height }));
  expect(dims.main, JSON.stringify(dims)).toBe(932);
  // The Join button sits in the bottom part of the real screen, not 59px above it.
  const join = await page.getByTestId("home-join").boundingBox();
  expect(join!.y + join!.height).toBeGreaterThan(932 - 120);
  // Sheets reach the real bottom too.
  await page.getByTestId("theme-button").click();
  await page.waitForTimeout(900); // the sheet springs up from below
  const dialog = await page.getByRole("dialog").boundingBox();
  expect(Math.round(dialog!.y + dialog!.height)).toBe(932);
  await context.close();
});

test("normal browsers keep the dynamic viewport and the hub title is centred", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("style", /--app-h/);
  for (const lang of ["en", "ar"]) {
    if (lang === "ar") await page.context().addCookies([{ name: "s10_lang", value: "ar", url: test.info().project.use.baseURL as string }]);
    for (const [w, h] of [
      [360, 640],
      [412, 839],
      [430, 932],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await page.reload();
      const title = await page.getByTestId("hub-title").boundingBox();
      const centre = title!.x + title!.width / 2;
      expect(Math.abs(centre - w / 2), `${lang} @${w}px title centre`).toBeLessThanOrEqual(2);
      // and it never runs into the buttons beside it
      const left = await page.getByTestId("theme-button").boundingBox();
      const right = await page.getByTestId("home-lang").boundingBox();
      const [a, b] = lang === "ar" ? [right!, left!] : [left!, right!];
      expect(title!.x, `${lang} @${w}px left gap`).toBeGreaterThanOrEqual(a.x + a.width);
      expect(title!.x + title!.width, `${lang} @${w}px right gap`).toBeLessThanOrEqual(b.x);
    }
  }
});
