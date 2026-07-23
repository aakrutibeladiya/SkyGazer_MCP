import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerApodTool } from "./tools/apod.js";
import { registerNeoWsTool } from "./tools/neows.js";

const server = new McpServer({
  name: "mcp-nasa",
  version: "1.0.0",
});

registerApodTool(server);
registerNeoWsTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
