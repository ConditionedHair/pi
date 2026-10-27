import { Type } from "typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { getActivePage } from "../browser.js";
import { textResult, errorResult, wrapError } from "../tool-result.js";

const ExecuteJsParams = Type.Object({
  expression: Type.String({ description: "JavaScript to evaluate in the page context. Last expression is returned." }),
});

export const executeJsTool: ToolDefinition<typeof ExecuteJsParams> = {
  name: "chrome_execute_js",
  label: "Chrome Execute JS",
  description: "Execute JavaScript in the page and return the result. Best for surgical DOM reads — element text, attributes, values, geometry.",
  promptSnippet: "Execute JS in the page (surgical DOM reads)",
  promptGuidelines: [
    "Prefer this over chrome_screenshot for extracting any data from the page.",
    "For click coordinates: JSON.stringify(document.querySelector('SEL').getBoundingClientRect())",
  ],
  parameters: ExecuteJsParams,
  async execute(_id, args) {
    try {
      const page = await getActivePage();
      const result = await page.evaluate(args.expression);
      const text = result === undefined ? "undefined" : JSON.stringify(result, null, 2);
      return textResult(text);
    } catch (err) {
      return errorResult(wrapError(err));
    }
  },
};
