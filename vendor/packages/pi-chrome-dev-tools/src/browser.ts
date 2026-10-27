import { chromium, type BrowserContext, type Page } from "playwright";
import { stealth } from "@mr_ozio/playwright-stealth";
import { join } from "node:path";
import { homedir } from "node:os";

const USER_DATA_DIR = join(homedir(), ".chrome-dev-tools", "profile");
const stealthChromium = stealth(chromium);

let context: BrowserContext | null = null;

export async function ensureBrowser(): Promise<BrowserContext> {
  if (context) {
    try {
      await context.pages()[0]?.title();
      return context;
    } catch {
      context = null;
    }
  }

  context = await stealthChromium.launchPersistentContext(USER_DATA_DIR, {
    channel: "chrome",
    headless: false,
    viewport: null,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  context.on("close", () => {
    context = null;
  });

  return context;
}

export async function getActivePage(): Promise<Page> {
  const ctx = await ensureBrowser();
  const pages = ctx.pages();
  return pages[pages.length - 1] ?? (await ctx.newPage());
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
}


