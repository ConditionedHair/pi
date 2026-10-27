import { Type } from "typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { getActivePage } from "../browser.js";
import { textResult, errorResult, wrapError } from "../tool-result.js";

const ClickParams = Type.Object({
  x: Type.Number({ description: "X coordinate in CSS pixels" }),
  y: Type.Number({ description: "Y coordinate in CSS pixels" }),
  button: Type.Optional(Type.Union([Type.Literal("left"), Type.Literal("right"), Type.Literal("middle")])),
  clickCount: Type.Optional(Type.Integer({ minimum: 1, maximum: 3, default: 1 })),
});

export const clickTool: ToolDefinition<typeof ClickParams> = {
  name: "chrome_click",
  label: "Chrome Click",
  description: "Click at viewport coordinates. Get coordinates from chrome_snapshot @(x,y) hints.",
  promptSnippet: "Click at (x, y) in the browser",
  parameters: ClickParams,
  async execute(_id, args) {
    try {
      const page = await getActivePage();
      await page.mouse.click(args.x, args.y, {
        button: args.button ?? "left",
        clickCount: args.clickCount ?? 1,
      });
      return textResult(`Clicked at (${args.x}, ${args.y})`);
    } catch (err) {
      return errorResult(wrapError(err));
    }
  },
};
