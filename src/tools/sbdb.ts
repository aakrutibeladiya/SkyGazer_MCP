import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ssdGet, type SsdSignature } from "../ssd-client.js";

const sbdbInputShape = {
  designation: z
    .string()
    .min(1)
    .describe(
      "Asteroid or comet name, number, or designation (e.g. 'Apophis', '99942', '2004 MN4', 'Halley').",
    ),
};

interface SbdbNamedValue {
  name: string;
  title: string;
  value: string;
  units: string | null;
}

interface SbdbResponse {
  signature?: SsdSignature;
  code?: string;
  message?: string;
  object?: {
    fullname: string;
    shortname: string;
    neo: boolean;
    pha: boolean;
    orbit_class: { name: string; code: string };
  };
  orbit?: {
    elements: SbdbNamedValue[];
    moid?: string;
  };
  phys_par?: SbdbNamedValue[];
}

function findValue(entries: SbdbNamedValue[] | undefined, name: string): SbdbNamedValue | undefined {
  return entries?.find((entry) => entry.name === name);
}

function formatValue(entry: SbdbNamedValue | undefined): string | undefined {
  if (!entry) return undefined;
  return entry.units ? `${entry.value} ${entry.units}` : entry.value;
}

export function registerSbdbTool(server: McpServer): void {
  server.registerTool(
    "sbdb",
    {
      title: "Small-Body Database Lookup",
      description:
        "Looks up an asteroid or comet by name/designation and returns its orbital elements and known physical data (JPL Small-Body Database).",
      inputSchema: sbdbInputShape,
    },
    async ({ designation }) => {
      const body = await ssdGet<SbdbResponse>(
        "/sbdb.api",
        { sstr: designation, "phys-par": "true" },
        "1.3",
      );

      if (!body.object) {
        throw new Error(
          `No SBDB record found for "${designation}": ${body.message ?? "not found"}`,
        );
      }

      const { object, orbit, phys_par } = body;
      const textParts = [
        `# ${object.fullname}`,
        `Orbit class: ${object.orbit_class.name} (${object.orbit_class.code})`,
        `Near-Earth object: ${object.neo ? "yes" : "no"}`,
        `Potentially hazardous: ${object.pha ? "yes" : "no"}`,
        "",
        "## Orbital elements",
      ];

      const elementNames: Array<[string, string]> = [
        ["a", "Semi-major axis"],
        ["e", "Eccentricity"],
        ["i", "Inclination"],
        ["q", "Perihelion distance"],
        ["per", "Orbital period"],
      ];
      for (const [name, label] of elementNames) {
        const formatted = formatValue(findValue(orbit?.elements, name));
        if (formatted) textParts.push(`- ${label}: ${formatted}`);
      }
      if (orbit?.moid) textParts.push(`- Earth MOID (minimum orbit intersection distance): ${orbit.moid} au`);

      const physNames: Array<[string, string]> = [
        ["H", "Absolute magnitude (H)"],
        ["diameter", "Diameter"],
        ["rot_per", "Rotation period"],
        ["albedo", "Albedo"],
      ];
      const physLines = physNames
        .map(([name, label]) => [label, formatValue(findValue(phys_par, name))] as const)
        .filter(([, formatted]) => formatted !== undefined);
      if (physLines.length > 0) {
        textParts.push("", "## Physical parameters");
        for (const [label, formatted] of physLines) {
          textParts.push(`- ${label}: ${formatted}`);
        }
      }

      return { content: [{ type: "text", text: textParts.join("\n") }] };
    },
  );
}
