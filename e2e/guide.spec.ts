import { expect, test } from "@playwright/test";

test("beginners see each game's guide once before creating it; the hub opens it any time", async ({ browser }) => {
  // A brand-new player: no "seen" flags.
  const context = await browser.newContext({ ...test.info().project.use, storageState: undefined });
  const page = await context.newPage();

  for (const [path, game] of [
    ["/create", "shut10"],
    ["/hangman/create", "hangman"],
    ["/guesswho/create", "guesswho"],
  ] as const) {
    await page.goto(path);
    const guide = page.getByTestId(`guide-${game}`);
    await expect(guide).toBeVisible();
    // Page through to the end.
    for (let i = 0; i < 8 && (await page.getByTestId("guide-next").isVisible()); i++) {
      const before = await guide.getAttribute("data-page");
      await page.getByTestId("guide-next").click();
      await expect(guide).not.toHaveAttribute("data-page", before ?? "");
    }
    await page.getByTestId("guide-done").click();
    await expect(guide).toBeHidden();
    // Second visit: no auto-open, but the "?" button still opens it.
    await page.reload();
    await page.waitForTimeout(700);
    await expect(guide).toBeHidden();
    await page.getByTestId(`guide-open-${game}`).click();
    await expect(guide).toBeVisible();
  }

  // The hub has a guide on every game card (Arabic too).
  await context.addCookies([{ name: "s10_lang", value: "ar", url: test.info().project.use.baseURL as string }]);
  await page.goto("/");
  await page.getByTestId("guide-open-guesswho").click();
  await expect(page.getByTestId("guide-page-title")).toHaveText("الهدف");
  await context.close();
});

test("the hub and credits page credit Omar Badr with his website and LinkedIn", async ({ page }) => {
  for (const path of ["/", "/credits"]) {
    await page.goto(path);
    await expect(page.getByTestId("made-by")).toContainText("Omar Badr");
    await expect(page.getByTestId("author-website")).toHaveAttribute("href", "https://omar-badr.digital/");
    await expect(page.getByTestId("author-linkedin")).toHaveAttribute("href", "https://www.linkedin.com/in/omarsbadrss");
    await expect(page.getByTestId("author-website")).toHaveAttribute("target", "_blank");
  }
});
