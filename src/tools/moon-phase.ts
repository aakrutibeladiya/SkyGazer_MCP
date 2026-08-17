import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { svsGet } from "../svs-client.js";
import { fetchAsBase64 } from "../nasa-client.js";
import { phaseName, moonStargazingNote } from "../lib/moon.js";

const moonPhaseInputShape = {
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format")
    .optional()
    .describe("Date to check (YYYY-MM-DD). Defaults to today."),
  hour: z
    .number()
    .int()
    .min(0)
    .max(23)
    .optional()
    .describe(
      "Hour of the night to check, 0-23, in UTC (not local time) — convert your evening time to UTC first. Defaults to 21 (21:00 UTC).",
    ),
  include_image: z
    .boolean()
    .optional()
    .describe("If true, include a rendered image of the moon as it will appear at that time. Defaults to false."),
};

interface DialAMoonResponse {
  time: string;
  phase: number; // percent illuminated, 0-100
  age: number; // days since the last new moon (cycle ≈ 29.53 days)
  distance: number; // km from Earth
  image: { url: string };
}

export function registerMoonPhaseTool(server: McpServer): void {
  server.registerTool(
    "moon_phase",
    {
      title: "Moon Phase & Illumination",
      description:
        "Reports the Moon's phase and illumination percentage for a given date/time, with a stargazing-suitability note — dark (low-illumination) nights are best for viewing faint deep-sky objects. Uses NASA SVS's Dial-A-Moon.",
      inputSchema: moonPhaseInputShape,
    },
    async ({ date, hour, include_image }) => {
      const day = date ?? new Date().toISOString().slice(0, 10);
      const h = (hour ?? 21).toString().padStart(2, "0");
      const moon = await svsGet<DialAMoonResponse>(`/api/dialamoon/${day}T${h}:00`);

      const name = phaseName(moon.age);
      const textParts = [
        `# Moon Phase for ${moon.time} UTC`,
        `Phase: ${name}`,
        `Illumination: ${moon.phase.toFixed(1)}%`,
        `Age: ${moon.age.toFixed(1)} days into the lunar cycle`,
        `Distance from Earth: ${Math.round(moon.distance).toLocaleString()} km`,
        "",
        moonStargazingNote(moon.phase),
      ];

      if (!include_image) {
        return { content: [{ type: "text", text: textParts.join("\n") }] };
      }

      const { data, mimeType } = await fetchAsBase64(moon.image.url);
      return {
        content: [
          { type: "text", text: textParts.join("\n") },
          { type: "image", data, mimeType },
        ],
      };
    },
  );
}
