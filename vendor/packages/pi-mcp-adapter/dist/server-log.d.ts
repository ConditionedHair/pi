import type { LoggingMessageNotificationParams } from "@modelcontextprotocol/client";
/**
 * Appends a server's `notifications/message` to `path` (`<agent dir>/mcp.log`), in the line format
 * Pi's built-in MCP uses. Several Pi processes share the file, so each message is one synchronous append.
 */
export declare function appendServerLogMessage(path: string, serverName: string, params: LoggingMessageNotificationParams): void;
