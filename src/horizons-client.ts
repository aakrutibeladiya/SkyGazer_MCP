const BASE_URL = "https://ssd.jpl.nasa.gov";

export class HorizonsApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HorizonsApiError";
  }
}

export interface HorizonsObservation {
  time: string;
  azimuthDeg: number;
  elevationDeg: number;
  magnitude: number;
  surfaceBrightness: number;
}

// Same "no simultaneous requests" caution as ssd-client.ts: Horizons' docs don't spell out a
// fair-use policy explicitly, but it's the same JPL infrastructure family as the SSD API
// (which does), so calls are serialized rather than assumed safe to fire concurrently.
let queue: Promise<void> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function addOneMinuteUtc(dateTimeUtc: string): string {
  const ms = Date.parse(`${dateTimeUtc.replace(" ", "T")}:00Z`);
  const next = new Date(ms + 60_000);
  return next.toISOString().slice(0, 16).replace("T", " ");
}

/**
 * Parses a Horizons observer-table result into a single row. Row shape (whitespace-separated):
 * "<date> <time> [flag] <azimuth> <elevation> <magnitude> <surface-brightness>" — the flag
 * column (interfering-body marker) is sometimes blank, so columns are taken from the *end*
 * of the token list rather than by fixed position.
 */
function parseObservation(result: string, bodyLabel: string): HorizonsObservation {
  const soeIdx = result.indexOf("$$SOE");
  const eoeIdx = result.indexOf("$$EOE");
  if (soeIdx === -1 || eoeIdx === -1) {
    throw new HorizonsApiError(0, `No ephemeris data returned for ${bodyLabel}.`);
  }
  const line = result
    .slice(soeIdx + 5, eoeIdx)
    .trim()
    .split("\n")[0];
  const tokens = line.trim().split(/\s+/);
  const [datePart, timePart, ...rest] = tokens;
  const last4 = rest.slice(-4).map(Number);
  if (!datePart || !timePart || last4.length < 4 || last4.some(Number.isNaN)) {
    throw new HorizonsApiError(0, `Unexpected ephemeris row shape for ${bodyLabel}: "${line}"`);
  }
  const [azimuthDeg, elevationDeg, magnitude, surfaceBrightness] = last4;
  return { time: `${datePart} ${timePart}`, azimuthDeg, elevationDeg, magnitude, surfaceBrightness };
}

/**
 * Looks up a body's azimuth/elevation/magnitude as seen from a lat/lon on Earth at a given
 * UTC date+time (format "YYYY-MM-DD HH:mm"). `bodyCommand` is a Horizons body ID
 * (e.g. "299" for Venus). Requests a 1-row observer table by setting STOP_TIME one minute
 * after START_TIME with a 1-hour step, so exactly one row comes back.
 */
export function horizonsObserve(
  bodyCommand: string,
  bodyLabel: string,
  latitude: number,
  longitude: number,
  dateTimeUtc: string,
): Promise<HorizonsObservation> {
  return serialize(async () => {
    const url = new URL("/api/horizons.api", BASE_URL);
    url.searchParams.set("format", "json");
    url.searchParams.set("COMMAND", `'${bodyCommand}'`);
    url.searchParams.set("OBJ_DATA", "'NO'");
    url.searchParams.set("MAKE_EPHEM", "'YES'");
    url.searchParams.set("EPHEM_TYPE", "'OBSERVER'");
    url.searchParams.set("CENTER", "'coord@399'");
    url.searchParams.set("COORD_TYPE", "'GEODETIC'");
    url.searchParams.set("SITE_COORD", `'${longitude},${latitude},0'`);
    url.searchParams.set("START_TIME", `'${dateTimeUtc}'`);
    url.searchParams.set("STOP_TIME", `'${addOneMinuteUtc(dateTimeUtc)}'`);
    url.searchParams.set("STEP_SIZE", "'1h'");
    url.searchParams.set("QUANTITIES", "'4,9'");

    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new HorizonsApiError(
        0,
        `Network error calling Horizons API: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const body = await res.json().catch(() => undefined);
    if (!res.ok || body?.error) {
      throw new HorizonsApiError(res.status, body?.error ?? res.statusText ?? "unknown error");
    }

    return parseObservation(body.result as string, bodyLabel);
  });
}
