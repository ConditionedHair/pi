import { Type } from "typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { getActivePage } from "../browser.js";
import { textResult, errorResult, wrapError } from "../tool-result.js";

const ScrollParams = Type.Object({
  x: Type.Optional(Type.Number({ default: 0, description: "X coordinate to scroll at" })),
  y: Type.Optional(Type.Number({ default: 0, description: "Y coordinate to scroll at" })),
  deltaX: Type.Optional(Type.Number({ default: 0, description: "Horizontal scroll amount" })),
  deltaY: Type.Optional(Type.Number({ default: 300, description: "Vertical scroll amount. Positive = down, negative = up." })),
});

export const scrollTool: ToolDefinition<typeof ScrollParams> = {
  name: "chrome_scroll",
  label: "Chrome Scroll",
  description: "Scroll the page. deltaY positive = down, negative = up. Default scrolls down 300px.",
  promptSnippet: "Scroll the page",
  parameters: ScrollParams,
  async execute(_id, args) {
    try {
      const page = await getActivePage();
      await page.mouse.wheel(args.deltaX ?? 0, args.deltaY ?? 300);
      await page.waitForTimeout(200);
      const scroll = await page.evaluate(() => ({
        scrollX: Math.round(window.scrollX),
        scrollY: Math.round(window.scrollY),
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      }));
      return textResult(
        `Scrolled. Position: (${scroll.scrollX}, ${scroll.scrollY}) / ${scroll.scrollHeight}px total, ${scroll.clientHeight}px visible`,
      );
    } catch (err) {
      return errorResult(wrapError(err));
    }
  },
};
