import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("exit", {
    description: "Exit Pi cleanly",
    handler: async (_args, ctx) => {
      ctx.shutdown();
    },
  });
}
