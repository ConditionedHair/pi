import { Type } from "typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { getActivePage } from "../browser.js";
import { textResult, errorResult, wrapError } from "../tool-result.js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ScreenshotParams = Type.Object({
  fullPage: Type.Optional(Type.Boolean({ default: false, description: "Capture the full scrollable page" })),
  path: Type.Optional(Type.String({ description: "Save path. Defaults to a temp file." })),
});

export const screenshotTool: ToolDefinition<typeof ScreenshotParams> = {
  name: "chrome_screenshot",
  label: "Chrome Screenshot",
  description: "Capture a screenshot of the current page. Use chrome_snapshot for page understanding — only screenshot for visual verification.",
  promptSnippet: "Screenshot the browser (visual verification only)",
  parameters: ScreenshotParams,
  async execute(_id, args) {
    try {
      const page = await getActivePage();
      const savePath = args.path ?? join(tmpdir(), `chrome-screenshot-${Date.now()}.png`);
      const buffer = await page.screenshot({
        fullPage: args.fullPage ?? false,
        type: "png",
      });
      writeFileSync(savePath, buffer);
      return textResult(`Screenshot saved to: ${savePath}`, { path: savePath });
    } catch (err) {
      return errorResult(wrapError(err));
    }
  },
};
