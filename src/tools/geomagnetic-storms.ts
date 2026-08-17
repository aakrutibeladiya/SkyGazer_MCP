import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { nasaGet } from "../nasa-client.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format");

const geomagneticStormsInputShape = {
  start_date: dateSchema
    .optional()
    .describe("Start of the search range (YYYY-MM-DD). Defaults to NASA's own default (roughly the last 30 days)."),
  end_date: dateSchema.optional().describe("End of the search range (YYYY-MM-DD). Defaults to today."),
  latitude: z
    .number()
    .min(-90)
    .max(90)
    .optional()
    .describe("Observer latitude. Provide together with longitude to estimate whether aurora from a storm could reach that far from the pole."),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .describe("Observer longitude, west negative. Required if latitude is given — aurora visibility depends on geomagnetic (not geographic) latitude, which needs both coordinates to estimate."),
};

interface KpReading {
  observedTime: string;
  kpIndex: number;
}

interface GstEvent {
  startTime: string;
  allKpIndex: KpReading[];
  link: string;
}

// NOAA's approximate rule of thumb: geomagnetic latitude aurora typically becomes visible at,
// indexed by rounded Kp (0-9). Geomagnetic latitude, not geographic — a rough guide, not a forecast.
const KP_AURORA_LATITUDE = [66.5, 64.5, 62.4, 60.4, 58.3, 56.3, 54.2, 52.2, 50.1, 48.1];

function auroraLatitudeThreshold(kp: number): number {
  const index = Math.min(9, Math.max(0, Math.round(kp)));
  return KP_AURORA_LATITUDE[index];
}

// Approximate location of Earth's north geomagnetic (dipole) pole. Drifts slowly year to
// year, so this is a rough estimate, not a precise current value.
const GEOMAGNETIC_NORTH_POLE = { lat: 80.65, lon: -72.68 };

/**
 * Approximates geomagnetic latitude from geographic lat/lon via a simple dipole model.
 * Matters because geomagnetic latitude — not geographic — is what determines aurora
 * visibility, and the two can differ substantially: e.g. New York City sits at ~41°N
 * geographic but ~50°N geomagnetic, because the magnetic pole is offset toward Canada.
 * Comparing raw geographic latitude against the Kp threshold table would make well-known
 * events (like the May 2024 G5 storm, widely seen from the US Northeast) look "not visible."
 */
function geomagneticLatitude(latitude: number, longitude: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const phi = toRad(latitude);
  const phiPole = toRad(GEOMAGNETIC_NORTH_POLE.lat);
  const deltaLon = toRad(longitude - GEOMAGNETIC_NORTH_POLE.lon);
  const sinLatM = Math.sin(phi) * Math.sin(phiPole) + Math.cos(phi) * Math.cos(phiPole) * Math.cos(deltaLon);
  return toDeg(Math.asin(sinLatM));
}

function stormLevel(kp: number): string {
  if (kp >= 9) return "G5 Extreme";
  if (kp >= 8) return "G4 Severe";
  if (kp >= 7) return "G3 Strong";
  if (kp >= 6) return "G2 Moderate";
  if (kp >= 5) return "G1 Minor";
  return "sub-storm";
}

export function registerGeomagneticStormsTool(server: McpServer): void {
  server.registerTool(
    "geomagnetic_storms",
    {
      title: "Geomagnetic Storms (Aurora Forecast)",
      description:
        "Lists geomagnetic storms in a date range from NASA's DONKI database, with peak Kp index and an approximate aurora-visibility latitude for each — the main NASA-derived signal for whether aurora might be visible.",
      inputSchema: geomagneticStormsInputShape,
    },
    async ({ start_date, end_date, latitude, longitude }) => {
      if ((latitude !== undefined) !== (longitude !== undefined)) {
        throw new Error("Provide both latitude and longitude, or neither.");
      }
      const geomagLat =
        latitude !== undefined && longitude !== undefined
          ? geomagneticLatitude(latitude, longitude)
          : undefined;

      const events = await nasaGet<GstEvent[]>("/DONKI/GST", {
        startDate: start_date,
        endDate: end_date,
      });

      const textParts = [
        `# Geomagnetic Storms`,
        `Range: ${start_date ?? "(default)"} to ${end_date ?? "(default, today)"}`,
        "",
      ];

      if (events.length === 0) {
        textParts.push(
          "No geomagnetic storms in this range — no elevated aurora chances from space weather right now.",
        );
        return { content: [{ type: "text", text: textParts.join("\n") }] };
      }

      for (const event of events) {
        if (event.allKpIndex.length === 0) continue;
        const peak = event.allKpIndex.reduce((max, r) => (r.kpIndex > max.kpIndex ? r : max));
        const threshold = auroraLatitudeThreshold(peak.kpIndex);
        textParts.push(
          `## ${event.startTime}`,
          `Peak Kp index: ${peak.kpIndex.toFixed(2)} (${stormLevel(peak.kpIndex)}) at ${peak.observedTime}`,
          `Aurora may be visible down to ~${threshold.toFixed(1)}° geomagnetic latitude (north or south).`,
        );
        if (geomagLat !== undefined) {
          const likely = Math.abs(geomagLat) >= threshold;
          textParts.push(
            likely
              ? `→ At ${latitude}, ${longitude} (≈${geomagLat.toFixed(1)}° geomagnetic latitude), aurora is plausibly visible during this storm (clear skies and low light pollution permitting).`
              : `→ At ${latitude}, ${longitude} (≈${geomagLat.toFixed(1)}° geomagnetic latitude), this storm likely isn't strong enough for aurora to reach you.`,
          );
        }
        textParts.push(`Details: ${event.link}`, "");
      }

      textParts.push(
        "Note: aurora latitude thresholds are a rough NOAA rule of thumb, and the geomagnetic-latitude estimate above uses a simplified dipole model of Earth's (slowly drifting) magnetic pole — treat both as a guide, not a precise forecast.",
      );

      return { content: [{ type: "text", text: textParts.join("\n") }] };
    },
  );
}
