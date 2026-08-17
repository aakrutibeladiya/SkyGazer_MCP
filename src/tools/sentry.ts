import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ssdGet, type SsdSignature } from "../ssd-client.js";

const sentryInputShape = {
  designation: z
    .string()
    .min(1)
    .describe(
      "Numeric or provisional asteroid designation (e.g. '99942', '2000 SG344') — Sentry's lookup does not resolve common names.",
    ),
};

interface SentrySummary {
  fullname: string;
  ip: string;
  ps_max: string;
  ps_cum: string;
  n_imp: number;
  first_obs: string;
  last_obs: string;
  darc: string;
  diameter?: string;
  h: string;
}

interface SentryImpact {
  date: string;
  ip: string;
  ps: string;
  energy: string;
}

interface SentryResponse {
  signature?: SsdSignature;
  error?: string;
  removed?: string;
  summary?: SentrySummary;
  data?: SentryImpact[];
}

export function registerSentryTool(server: McpServer): void {
  server.registerTool(
    "sentry",
    {
      title: "Sentry Earth Impact Risk",
      description:
        "Reports JPL Sentry's Earth-impact risk assessment for a specific asteroid: cumulative impact probability, Palermo Scale rating, and next potential impact dates, if any.",
      inputSchema: sentryInputShape,
    },
    async ({ designation }) => {
      const body = await ssdGet<SentryResponse>("/sentry.api", { des: designation }, "2.0");

      if (body.removed) {
        return {
          content: [
            {
              type: "text",
              text: `${designation} was previously on the Sentry risk list but was removed on ${body.removed} — its impact risk has since been ruled out.`,
            },
          ],
        };
      }

      if (body.error === "specified object not found") {
        return {
          content: [
            {
              type: "text",
              text: `${designation} is not on JPL's Sentry risk list — no Earth impact risk is currently being tracked for it.`,
            },
          ],
        };
      }

      if (body.error) {
        throw new Error(`Sentry lookup for "${designation}" failed: ${body.error}`);
      }

      const { summary, data = [] } = body;
      const textParts = [`# Sentry Risk Assessment: ${summary?.fullname ?? designation}`];
      if (summary) {
        textParts.push(
          `Cumulative impact probability: ${summary.ip}`,
          `Palermo Scale (max / cumulative): ${summary.ps_max} / ${summary.ps_cum}`,
          `Potential impacts tracked: ${summary.n_imp}`,
          `Estimated diameter: ${summary.diameter ?? "unknown"} km`,
          `Observed: ${summary.first_obs} to ${summary.last_obs} (data arc: ${summary.darc})`,
        );
      }

      if (data.length > 0) {
        textParts.push("", "## Next potential impact dates");
        for (const impact of data.slice(0, 10)) {
          textParts.push(
            `- ${impact.date}: impact probability ${impact.ip}, Palermo Scale ${impact.ps}, energy ${impact.energy} Mt`,
          );
        }
        if (data.length > 10) textParts.push(`(${data.length - 10} more not shown)`);
      }

      return { content: [{ type: "text", text: textParts.join("\n") }] };
    },
  );
}
