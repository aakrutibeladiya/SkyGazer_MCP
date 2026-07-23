import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { nasaGet } from "../nasa-client.js";

const MAX_RESULTS = 30;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format");

const neowsInputShape = {
  start_date: dateSchema
    .optional()
    .describe("Start of the search range (YYYY-MM-DD). Defaults to today."),
  end_date: dateSchema
    .optional()
    .describe(
      "End of the search range (YYYY-MM-DD). Defaults to 7 days after start_date. NASA caps the range at 7 days.",
    ),
};

interface NeoObject {
  name: string;
  nasa_jpl_url: string;
  is_potentially_hazardous_asteroid: boolean;
  estimated_diameter: {
    kilometers: { estimated_diameter_min: number; estimated_diameter_max: number };
  };
  close_approach_data: Array<{
    close_approach_date: string;
    relative_velocity: { kilometers_per_hour: string };
    miss_distance: { kilometers: string };
    orbiting_body: string;
  }>;
}

interface NeoWsFeedResponse {
  element_count: number;
  near_earth_objects: Record<string, NeoObject[]>;
}

export function registerNeoWsTool(server: McpServer): void {
  server.registerTool(
    "neows",
    {
      title: "Near Earth Object Web Service",
      description:
        "Lists asteroids with a close approach to Earth in a date range, including size estimates, hazard flags, and closest-approach distance/velocity.",
      inputSchema: neowsInputShape,
    },
    async ({ start_date, end_date }) => {
      if (start_date && end_date) {
        const days =
          (Date.parse(end_date) - Date.parse(start_date)) / (1000 * 60 * 60 * 24);
        if (days < 0 || days > 7) {
          throw new Error("end_date must be on or after start_date, and within 7 days of it.");
        }
      }

      const feed = await nasaGet<NeoWsFeedResponse>("/neo/rest/v1/feed", {
        start_date,
        end_date,
      });

      const rows = Object.entries(feed.near_earth_objects)
        .flatMap(([date, neos]) => neos.map((neo) => ({ date, neo })))
        .sort((a, b) => a.date.localeCompare(b.date));

      const textParts = [
        `# Near-Earth Objects`,
        `Total objects in range: ${feed.element_count}`,
        "",
      ];

      if (rows.length === 0) {
        textParts.push("No near-Earth objects found in this range.");
        return { content: [{ type: "text", text: textParts.join("\n") }] };
      }

      const shown = rows.slice(0, MAX_RESULTS);
      if (rows.length > MAX_RESULTS) {
        textParts.push(`Showing first ${MAX_RESULTS} of ${rows.length}.`, "");
      }

      for (const { date, neo } of shown) {
        const { estimated_diameter_min, estimated_diameter_max } =
          neo.estimated_diameter.kilometers;
        const approach = neo.close_approach_data[0];
        const hazardFlag = neo.is_potentially_hazardous_asteroid ? " [HAZARDOUS]" : "";
        const diameter = `${estimated_diameter_min.toFixed(3)}-${estimated_diameter_max.toFixed(3)} km`;
        const missDistance = approach
          ? `${Number(approach.miss_distance.kilometers).toLocaleString()} km`
          : "unknown distance";
        const velocity = approach
          ? `${Number(approach.relative_velocity.kilometers_per_hour).toLocaleString()} km/h`
          : "unknown velocity";
        textParts.push(
          `- [${date}]${hazardFlag} ${neo.name}: diameter ${diameter}, miss distance ${missDistance} at ${velocity}`,
        );
      }

      return { content: [{ type: "text", text: textParts.join("\n") }] };
    },
  );
}
