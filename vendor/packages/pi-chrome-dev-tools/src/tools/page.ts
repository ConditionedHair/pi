import { Type } from "typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { getActivePage } from "../browser.js";
import { textResult, errorResult, wrapError } from "../tool-result.js";

const EmptyParams = Type.Object({});

export const pageInfoTool: ToolDefinition<typeof EmptyParams> = {
  name: "chrome_page_info",
  label: "Chrome Page Info",
  description: "Get current page URL, title, viewport size, and scroll position.",
  promptSnippet: "Get page URL, title, and viewport info",
  parameters: EmptyParams,
  async execute() {
    const page = await getActivePage();
    const info = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scroll: { x: Math.round(window.scrollX), y: Math.round(window.scrollY) },
      pageSize: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
    }));
    return textResult([
      `URL: ${info.url}`,
      `Title: ${info.title}`,
      `Viewport: ${info.viewport.width}x${info.viewport.height}`,
      `Scroll: (${info.scroll.x}, ${info.scroll.y})`,
      `Page size: ${info.pageSize.width}x${info.pageSize.height}`,
    ].join("\n"));
  },
};

const WaitParams = Type.Object({
  seconds: Type.Number({ minimum: 0.1, maximum: 30, description: "Seconds to wait" }),
});

export const waitTool: ToolDefinition<typeof WaitParams> = {
  name: "chrome_wait",
  label: "Chrome Wait",
  description: "Wait a specified number of seconds.",
  promptSnippet: "Wait N seconds",
  parameters: WaitParams,
  async execute(_id, args) {
    const page = await getActivePage();
    await page.waitForTimeout(args.seconds * 1000);
    return textResult(`Waited ${args.seconds}s`);
  },
};

const WaitForLoadParams = Type.Object({
  timeout: Type.Optional(Type.Number({ default: 15, description: "Timeout in seconds" })),
});

export const waitForLoadTool: ToolDefinition<typeof WaitForLoadParams> = {
  name: "chrome_wait_for_load",
  label: "Chrome Wait For Load",
  description: "Wait until the page reaches document.readyState === 'complete'.",
  promptSnippet: "Wait for page load to complete",
  parameters: WaitForLoadParams,
  async execute(_id, args) {
    const page = await getActivePage();
    const timeout = (args.timeout ?? 15) * 1000;
    await page.waitForLoadState("load", { timeout });
    const title = await page.title();
    return textResult(`Page loaded: ${page.url()} — ${title}`);
  },
};

export const goBackTool: ToolDefinition<typeof EmptyParams> = {
  name: "chrome_go_back",
  label: "Chrome Go Back",
  description: "Navigate back one page in history.",
  promptSnippet: "Go back in browser history",
  parameters: EmptyParams,
  async execute() {
    try {
      const page = await getActivePage();
      const response = await page.goBack({ waitUntil: "domcontentloaded" });
      if (!response) return textResult("No previous page in history.");
      const title = await page.title();
      return textResult(`Back to: ${page.url()} — ${title}`);
    } catch (err) {
      return errorResult(wrapError(err));
    }
  },
};

export const goForwardTool: ToolDefinition<typeof EmptyParams> = {
  name: "chrome_go_forward",
  label: "Chrome Go Forward",
  description: "Navigate forward one page in history.",
  promptSnippet: "Go forward in browser history",
  parameters: EmptyParams,
  async execute() {
    try {
      const page = await getActivePage();
      const response = await page.goForward({ waitUntil: "domcontentloaded" });
      if (!response) return textResult("No forward page in history.");
      const title = await page.title();
      return textResult(`Forward to: ${page.url()} — ${title}`);
    } catch (err) {
      return errorResult(wrapError(err));
    }
  },
};

export const reloadTool: ToolDefinition<typeof EmptyParams> = {
  name: "chrome_reload",
  label: "Chrome Reload",
  description: "Reload the current page.",
  promptSnippet: "Reload the current page",
  parameters: EmptyParams,
  async execute() {
    try {
      const page = await getActivePage();
      await page.reload({ waitUntil: "domcontentloaded" });
      const title = await page.title();
      return textResult(`Reloaded: ${page.url()} — ${title}`);
    } catch (err) {
      return errorResult(wrapError(err));
    }
  },
};
