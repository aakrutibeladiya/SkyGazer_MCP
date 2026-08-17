const BASE_URL = "https://ssd-api.jpl.nasa.gov";

export class SsdApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "SsdApiError";
  }
}

export interface SsdSignature {
  version: string;
  source: string;
}

// Serializes all SSD API calls: fair-use policy forbids simultaneous requests, so each
// call is chained after the previous one settles (success or failure) rather than firing
// concurrently. No API key needed for this API family, unlike api.nasa.gov.
let queue: Promise<void> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Calls an ssd-api.jpl.nasa.gov endpoint. Requests are serialized (never concurrent) per
 * the API's fair-use policy. Warns on stderr if the response's signature.version doesn't
 * match what the caller expected, since JPL can change response shapes without notice.
 */
export function ssdGet<T extends { signature?: SsdSignature }>(
  path: string,
  params: Record<string, string | undefined>,
  expectedVersion: string,
): Promise<T> {
  return serialize(async () => {
    const url = new URL(path, BASE_URL);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }

    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new SsdApiError(
        0,
        `Network error calling SSD API: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const body = await res.json().catch(() => undefined);
    if (!res.ok) {
      const message = body?.message ?? res.statusText;
      throw new SsdApiError(res.status, `SSD API ${res.status}: ${message}`);
    }

    if (body?.signature && body.signature.version !== expectedVersion) {
      console.error(
        `[ssd-client] warning: ${path} returned signature version ${body.signature.version}, expected ${expectedVersion} — response shape may have changed.`,
      );
    }

    return body as T;
  });
}
