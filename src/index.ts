#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerApodTool } from "./tools/apod.js";
import { registerNeoWsTool } from "./tools/neows.js";
import { registerRoversResource } from "./resources/rovers.js";
import { registerSbdbTool } from "./tools/sbdb.js";
import { registerCloseApproachTool } from "./tools/close-approach.js";
import { registerSentryTool } from "./tools/sentry.js";
import { registerMoonPhaseTool } from "./tools/moon-phase.js";
import { registerStargazingTool } from "./tools/stargazing.js";
import { registerGeomagneticStormsTool } from "./tools/geomagnetic-storms.js";

const server = new McpServer({
  name: "skygazer-mcp",
  version: "1.0.0",
});

registerApodTool(server);
registerNeoWsTool(server);
registerRoversResource(server);
registerSbdbTool(server);
registerCloseApproachTool(server);
registerSentryTool(server);
registerMoonPhaseTool(server);
registerStargazingTool(server);
registerGeomagneticStormsTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
