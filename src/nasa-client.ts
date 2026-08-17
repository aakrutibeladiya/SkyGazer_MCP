const BASE_URL = "https://api.nasa.gov";

export class NasaApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "NasaApiError";
  }
}

function usingDemoKey(): boolean {
  return !process.env.NASA_API_KEY;
}

/** Reads the error body (if any) and throws a NasaApiError with a message tailored to the status. */
async function throwNormalized(res: Response): Promise<never> {
  const body = await res.json().catch(() => undefined);
  const upstreamMessage = body?.error?.message ?? body?.msg;

  if (res.status === 429) {
    const hint = usingDemoKey()
      ? "You're using the shared DEMO_KEY, which is rate-limited across every anonymous NASA API user (30 req/hr, 50/day) and can be exhausted by other people's traffic, not just yours. Get a free personal key at https://api.nasa.gov/ and set it as NASA_API_KEY."
      : "Your personal NASA_API_KEY has hit its rate limit (1000 req/hr). Wait for the limit to reset before retrying.";
    throw new NasaApiError(429, `NASA API rate limit exceeded. ${hint}`);
  }

  if (res.status === 403) {
    throw new NasaApiError(
      403,
      `NASA API rejected the request as forbidden — check that NASA_API_KEY is set to a valid key (${upstreamMessage ?? res.statusText}).`,
    );
  }

  throw new NasaApiError(res.status, `NASA API ${res.status}: ${upstreamMessage ?? res.statusText}`);
}

/**
 * Calls an api.nasa.gov endpoint, injecting the API key and normalizing errors.
 * `path` is like "/planetary/apod"; `params` are additional query params.
 */
export async function nasaGet<T>(
  path: string,
  params: Record<string, string | undefined> = {},
): Promise<T> {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("api_key", process.env.NASA_API_KEY ?? "DEMO_KEY");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new NasaApiError(
      0,
      `Network error calling NASA API: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    await throwNormalized(res);
  }
  return res.json() as Promise<T>;
}

/** Fetches a binary resource (e.g. an image) and returns it base64-encoded with its content type. */
export async function fetchAsBase64(
  url: string,
): Promise<{ data: string; mimeType: string }> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new NasaApiError(
      0,
      `Network error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new NasaApiError(res.status, `Failed to fetch ${url}: ${res.statusText}`);
  }
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType };
}
