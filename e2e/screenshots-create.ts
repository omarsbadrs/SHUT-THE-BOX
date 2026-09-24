/** Captures the create page on a phone and on desktop. Usage: node --experimental-strip-types e2e/screenshots-create.ts <baseUrl> <outDir> */
import { chromium, devices } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3] ?? "screenshots";
const browser = await chromium.launch();

const phone = await (await browser.newContext({ ...devices["iPhone 13"], baseURL: base })).newPage();
await phone.goto("/create");
await phone.getByTestId("nickname").fill("Omar");
await phone.screenshot({ path: `${out}/create-phone-full.png`, fullPage: true });
await phone.getByText("More options").click();
await phone.getByTestId("format").getByRole("button", { name: "Custom", exact: true }).click();
await phone.screenshot({ path: `${out}/create-phone-advanced.png`, fullPage: true });

const desk = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: base })).newPage();
await desk.goto("/create");
await desk.screenshot({ path: `${out}/create-desktop.png` });
await browser.close();
console.log("done");
