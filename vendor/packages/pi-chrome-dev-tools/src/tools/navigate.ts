import { Type } from "typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { getActivePage } from "../browser.js";
import { textResult, errorResult, wrapError } from "../tool-result.js";

const NavigateParams = Type.Object({
  url: Type.String({ description: "URL to navigate to" }),
});

export const navigateTool: ToolDefinition<typeof NavigateParams> = {
  name: "chrome_navigate",
  label: "Chrome Navigate",
  description: "Navigate the active tab to a URL. Launches Chrome on first call.",
  promptSnippet: "Navigate Chrome to a URL",
  parameters: NavigateParams,
  async execute(_id, args) {
    try {
      const page = await getActivePage();
      await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      const title = await page.title();
      const url = page.url();
      return textResult(`Navigated to: ${url}\nTitle: ${title}`);
    } catch (err) {
      return errorResult(wrapError(err));
    }
  },
};
