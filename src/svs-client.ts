const BASE_URL = "https://svs.gsfc.nasa.gov";

export class SvsApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "SvsApiError";
  }
}

/** Calls an svs.gsfc.nasa.gov endpoint. No API key needed. Error bodies are HTML, not JSON, so errors carry statusText rather than a parsed message. */
export async function svsGet<T>(path: string): Promise<T> {
  const url = new URL(path, BASE_URL);

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new SvsApiError(
      0,
      `Network error calling SVS API: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new SvsApiError(res.status, `SVS API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
