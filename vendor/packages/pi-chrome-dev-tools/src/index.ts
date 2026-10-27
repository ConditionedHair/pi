import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { closeBrowser } from "./browser.js";
import { navigateTool } from "./tools/navigate.js";
import { clickTool } from "./tools/click.js";
import { typeTool, pressKeyTool } from "./tools/type.js";
import { screenshotTool } from "./tools/screenshot.js";
import { snapshotTool } from "./tools/snapshot.js";
import { executeJsTool } from "./tools/execute-js.js";
import { scrollTool } from "./tools/scroll.js";
import { listTabsTool, switchTabTool, newTabTool, closeTabTool } from "./tools/tabs.js";
import { pageInfoTool, waitTool, waitForLoadTool, goBackTool, goForwardTool, reloadTool } from "./tools/page.js";
import { closeBrowserTool } from "./tools/close.js";

export default function chromeDevToolsExtension(pi: ExtensionAPI): void {
  pi.registerTool(navigateTool);
  pi.registerTool(clickTool);
  pi.registerTool(typeTool);
  pi.registerTool(pressKeyTool);
  pi.registerTool(screenshotTool);
  pi.registerTool(snapshotTool);
  pi.registerTool(executeJsTool);
  pi.registerTool(scrollTool);
  pi.registerTool(listTabsTool);
  pi.registerTool(switchTabTool);
  pi.registerTool(newTabTool);
  pi.registerTool(closeTabTool);
  pi.registerTool(pageInfoTool);
  pi.registerTool(waitTool);
  pi.registerTool(waitForLoadTool);
  pi.registerTool(goBackTool);
  pi.registerTool(goForwardTool);
  pi.registerTool(reloadTool);
  pi.registerTool(closeBrowserTool);

  pi.on("session_shutdown", async () => {
    await closeBrowser();
  });
}
