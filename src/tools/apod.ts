import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { nasaGet, fetchAsBase64 } from "../nasa-client.js";
import { cached } from "../lib/cache.js";

const apodInputShape = {
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format")
    .optional()
    .describe("The date of the APOD image to retrieve (YYYY-MM-DD). Defaults to today."),
  hd: z
    .boolean()
    .optional()
    .describe("If true, fetch the HD version of the image (larger payload). Defaults to false."),
};

interface ApodResponse {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: "image" | "video";
  copyright?: string;
}

export function registerApodTool(server: McpServer): void {
  server.registerTool(
    "apod",
    {
      title: "Astronomy Picture of the Day",
      description:
        "Fetches NASA's Astronomy Picture of the Day: a title, explanation, and (when available) the image itself.",
      inputSchema: apodInputShape,
    },
    async ({ date, hd }) => {
      // Resolve "today" to a concrete calendar day before using it as a cache
      // key — caching under a literal "today" string would keep serving
      // yesterday's picture after the date rolls over on a long-lived server.
      const resolvedDate = date ?? new Date().toISOString().slice(0, 10);
      const cacheKey = `apod:${resolvedDate}:${hd ?? false}`;

      return cached(cacheKey, async () => {
        const apod = await nasaGet<ApodResponse>("/planetary/apod", { date });

        const textParts = [`# ${apod.title}`, `Date: ${apod.date}`];
        if (apod.copyright) textParts.push(`Copyright: ${apod.copyright}`);
        textParts.push("", apod.explanation);

        if (apod.media_type !== "image") {
          textParts.push("", `No image today — media is a video: ${apod.url}`);
          return { content: [{ type: "text", text: textParts.join("\n") }] };
        }

        const imageUrl = hd && apod.hdurl ? apod.hdurl : apod.url;
        const { data, mimeType } = await fetchAsBase64(imageUrl);

        return {
          content: [
            { type: "text", text: textParts.join("\n") },
            { type: "image", data, mimeType },
          ],
        };
      });
    },
  );
}
