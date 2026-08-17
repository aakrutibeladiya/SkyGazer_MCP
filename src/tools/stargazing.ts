import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { svsGet } from "../svs-client.js";
import { horizonsObserve, HorizonsApiError } from "../horizons-client.js";
import { phaseName, moonStargazingNote } from "../lib/moon.js";

const stargazingInputShape = {
  latitude: z.number().min(-90).max(90).describe("Observer latitude in decimal degrees (-90 to 90)."),
  longitude: z.number().min(-180).max(180).describe("Observer longitude in decimal degrees, west negative (-180 to 180)."),
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
      "Hour of the night to check, 0-23, in UTC (not local time) — convert your evening time to UTC first. Defaults to 21 (21:00 UTC). Note: this tool doesn't know sunset/sunrise times, so pick an hour you know is after dark at that location.",
    ),
};

interface DialAMoonResponse {
  phase: number;
  age: number;
}

const PLANETS: Array<{ command: string; name: string }> = [
  { command: "199", name: "Mercury" },
  { command: "299", name: "Venus" },
  { command: "499", name: "Mars" },
  { command: "599", name: "Jupiter" },
  { command: "699", name: "Saturn" },
];

const COMPASS_POINTS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function compassDirection(azimuthDeg: number): string {
  const index = Math.round(azimuthDeg / 22.5) % 16;
  return COMPASS_POINTS[index];
}

function brightnessDescription(magnitude: number): string {
  if (magnitude < -3) return "extremely bright, unmistakable";
  if (magnitude < 0) return "very bright";
  if (magnitude < 2) return "bright, easy to spot";
  return "faint";
}

function overallVerdict(moonIlluminationPercent: number, visiblePlanetCount: number): string {
  const moonPart =
    moonIlluminationPercent < 40
      ? "the moon is dim enough to stay out of the way"
      : "a bright moon will wash out fainter objects";
  const planetPart =
    visiblePlanetCount === 0
      ? "no naked-eye planets are up"
      : `${visiblePlanetCount} naked-eye planet${visiblePlanetCount > 1 ? "s" : ""} will be visible`;

  if (moonIlluminationPercent < 40 && visiblePlanetCount > 0) {
    return `Good night overall — ${planetPart}, and ${moonPart}.`;
  }
  if (visiblePlanetCount > 0) {
    return `Decent night for planet-watching — ${planetPart}, though ${moonPart}. Bright planets will still show up despite the moon.`;
  }
  if (moonIlluminationPercent < 40) {
    return `Fair night — ${moonPart}, but ${planetPart}. Good for stars and constellations, less for planet-spotting.`;
  }
  return `Not the best night — ${planetPart}, and ${moonPart}. Still fine for casual stargazing, just don't expect much to stand out.`;
}

export function registerStargazingTool(server: McpServer): void {
  server.registerTool(
    "stargazing_conditions",
    {
      title: "Stargazing Conditions",
      description:
        "Reports stargazing conditions for a specific location and night: moon illumination, and which naked-eye planets (Mercury-Saturn) will be above the horizon, with direction/altitude/brightness for each. Combines NASA SVS's Dial-A-Moon with JPL Horizons ephemeris data.",
      inputSchema: stargazingInputShape,
    },
    async ({ latitude, longitude, date, hour }) => {
      const day = date ?? new Date().toISOString().slice(0, 10);
      const h = (hour ?? 21).toString().padStart(2, "0");

      const moon = await svsGet<DialAMoonResponse>(`/api/dialamoon/${day}T${h}:00`);

      const observations: Array<{ name: string; visible: boolean; detail: string }> = [];
      for (const planet of PLANETS) {
        try {
          const obs = await horizonsObserve(planet.command, planet.name, latitude, longitude, `${day} ${h}:00`);
          if (obs.elevationDeg > 0) {
            observations.push({
              name: planet.name,
              visible: true,
              detail: `${Math.round(obs.elevationDeg)}° above the horizon, looking ${compassDirection(obs.azimuthDeg)} — ${brightnessDescription(obs.magnitude)}.`,
            });
          } else {
            observations.push({ name: planet.name, visible: false, detail: "below the horizon." });
          }
        } catch (err) {
          const message = err instanceof HorizonsApiError ? err.message : String(err);
          observations.push({ name: planet.name, visible: false, detail: `couldn't check (${message}).` });
        }
      }

      const visibleCount = observations.filter((o) => o.visible).length;

      const textParts = [
        `# Stargazing Conditions — ${latitude}, ${longitude} on ${day} at ${h}:00 UTC`,
        "",
        "## Moon",
        `${phaseName(moon.age)}, ${moon.phase.toFixed(1)}% illuminated`,
        moonStargazingNote(moon.phase),
        "",
        "## Naked-eye planets",
      ];
      for (const o of observations) {
        textParts.push(`- ${o.name}: ${o.visible ? "visible" : "not visible"} — ${o.detail}`);
      }
      textParts.push("", "## Overall", overallVerdict(moon.phase, visibleCount));

      return { content: [{ type: "text", text: textParts.join("\n") }] };
    },
  );
}
