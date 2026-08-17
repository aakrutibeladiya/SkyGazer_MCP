import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ssdGet, type SsdSignature } from "../ssd-client.js";

const MAX_RESULTS = 30;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format");

const closeApproachInputShape = {
  date_min: dateSchema.optional().describe("Start of the search range (YYYY-MM-DD). Defaults to today."),
  date_max: dateSchema
    .optional()
    .describe("End of the search range (YYYY-MM-DD). Defaults to 60 days after date_min."),
  max_distance_au: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "max_distance_au must be a plain decimal number")
    .optional()
    .describe(
      "Maximum close-approach distance in au (1 au ≈ 150 million km; the Moon is ~0.0026 au away). Defaults to '0.05'.",
    ),
};

interface CadResponse {
  signature?: SsdSignature;
  count: number;
  fields: string[];
  data: string[][];
}

export function registerCloseApproachTool(server: McpServer): void {
  server.registerTool(
    "close_approach",
    {
      title: "Small-Body Close Approach Data",
      description:
        "Lists asteroids/comets passing close to Earth in a date range, sorted by approach time, including miss distance and relative velocity (JPL SBDB Close Approach Data / CAD).",
      inputSchema: closeApproachInputShape,
    },
    async ({ date_min, date_max, max_distance_au }) => {
      const body = await ssdGet<CadResponse>(
        "/cad.api",
        {
          "date-min": date_min,
          "date-max": date_max,
          "dist-max": max_distance_au ?? "0.05",
          body: "Earth",
        },
        "1.5",
      );

      const textParts = [`# Close Approaches to Earth`, `Total in range: ${body.count}`, ""];

      if (body.count === 0) {
        textParts.push("No close approaches found in this range/distance.");
        return { content: [{ type: "text", text: textParts.join("\n") }] };
      }

      const idx = Object.fromEntries(body.fields.map((name, i) => [name, i]));
      const rows = body.data;
      const shown = rows.slice(0, MAX_RESULTS);
      if (rows.length > MAX_RESULTS) {
        textParts.push(`Showing first ${MAX_RESULTS} of ${rows.length}.`, "");
      }

      for (const row of shown) {
        const des = row[idx.des];
        const cd = row[idx.cd];
        const dist = Number(row[idx.dist]).toFixed(5);
        const vRel = Number(row[idx.v_rel]).toFixed(2);
        textParts.push(`- [${cd}] ${des}: ${dist} au away at ${vRel} km/s relative velocity`);
      }

      return { content: [{ type: "text", text: textParts.join("\n") }] };
    },
  );
}
