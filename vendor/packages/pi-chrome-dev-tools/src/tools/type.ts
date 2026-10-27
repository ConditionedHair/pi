import { Type } from "typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { getActivePage } from "../browser.js";
import { textResult, errorResult, wrapError } from "../tool-result.js";

const TypeParams = Type.Object({
  text: Type.String({ description: "Text to type into the focused element" }),
});

export const typeTool: ToolDefinition<typeof TypeParams> = {
  name: "chrome_type",
  label: "Chrome Type",
  description: "Type text into the currently focused element. Click an input first to focus it.",
  promptSnippet: "Type text into the focused element",
  parameters: TypeParams,
  async execute(_id, args) {
    try {
      const page = await getActivePage();
      await page.keyboard.type(args.text);
      return textResult(`Typed ${args.text.length} characters`);
    } catch (err) {
      return errorResult(wrapError(err));
    }
  },
};

const PressKeyParams = Type.Object({
  key: Type.String({ description: "Key to press (e.g. Enter, Tab, Backspace, ArrowDown, a, A)" }),
});

export const pressKeyTool: ToolDefinition<typeof PressKeyParams> = {
  name: "chrome_press_key",
  label: "Chrome Press Key",
  description: "Press a keyboard key. Supports special keys (Enter, Tab, Escape, arrows, etc.) and characters.",
  promptSnippet: "Press a keyboard key",
  parameters: PressKeyParams,
  async execute(_id, args) {
    try {
      const page = await getActivePage();
      await page.keyboard.press(args.key);
      return textResult(`Pressed key: ${args.key}`);
    } catch (err) {
      return errorResult(wrapError(err));
    }
  },
};
