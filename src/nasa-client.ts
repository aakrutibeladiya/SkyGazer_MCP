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

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    const message = body?.error?.message ?? body?.msg ?? res.statusText;
    throw new NasaApiError(res.status, `NASA API ${res.status}: ${message}`);
  }
  return res.json() as Promise<T>;
}

/** Fetches a binary resource (e.g. an image) and returns it base64-encoded with its content type. */
export async function fetchAsBase64(
  url: string,
): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new NasaApiError(res.status, `Failed to fetch ${url}: ${res.statusText}`);
  }
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType };
}
