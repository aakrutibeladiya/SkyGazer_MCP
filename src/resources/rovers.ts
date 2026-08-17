import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Static reference data (NASA's Mars Rover Photos API rover manifest, current as of this writing).
// Doesn't need a network call — that's exactly why this is a resource, not a tool.
const ROVERS = [
  {
    name: "Curiosity",
    landing_date: "2012-08-06",
    max_date: "active",
    status: "active",
  },
  {
    name: "Perseverance",
    landing_date: "2021-02-18",
    max_date: "active",
    status: "active",
  },
  {
    name: "Opportunity",
    landing_date: "2004-01-25",
    max_date: "2018-06-11",
    status: "complete",
  },
  {
    name: "Spirit",
    landing_date: "2004-01-04",
    max_date: "2010-03-22",
    status: "complete",
  },
];

export function registerRoversResource(server: McpServer): void {
  server.registerResource(
    "mars-rovers",
    "nasa://rovers",
    {
      title: "Mars Rovers",
      description:
        "Valid Mars rover names and their active date ranges, for use with Mars Rover Photos-style queries.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(ROVERS, null, 2),
        },
      ],
    }),
  );
}

