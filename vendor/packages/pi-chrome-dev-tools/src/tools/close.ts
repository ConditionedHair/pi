import { Type } from "typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { closeBrowser } from "../browser.js";
import { textResult } from "../tool-result.js";

const EmptyParams = Type.Object({});

export const closeBrowserTool: ToolDefinition<typeof EmptyParams> = {
  name: "chrome_close",
  label: "Chrome Close",
  description: "Close the browser entirely. It will relaunch on next tool call.",
  promptSnippet: "Close Chrome",
  parameters: EmptyParams,
  async execute() {
    await closeBrowser();
    return textResult("Browser closed.");
  },
};
