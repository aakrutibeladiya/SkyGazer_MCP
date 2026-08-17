# TODO / Roadmap

Phased checklist. Work top to bottom — each phase should leave you with something runnable, not just code in progress.

## Phase 0 — Housekeeping (this session)

- [x] git init
- [x] README.md, CLAUDE.md, TODO.md, LEARNINGS.md
- [x] Get a NASA API key from <https://api.nasa.gov/> (free, instant, email delivery) — `DEMO_KEY` works meanwhile but caps at 30 req/hr, 50/day
- [x] `.gitignore` + `.env.example`

## Phase 1 — Project scaffold

- [x] `npm init`, install `@modelcontextprotocol/sdk`, `zod`, `typescript`, `tsx`/`ts-node`
- [x] `tsconfig.json`
- [x] Minimal `src/index.ts`: server that starts, connects over stdio transport, exposes zero tools
- [x] Verify it starts and stays alive on stdio (confirmed manually); `npm run build` and `npm run inspect` both wired up in package.json

## Phase 2 — First real tool: APOD (Astronomy Picture of the Day)

- [x] `src/nasa-client.ts`: fetch wrapper (base URL `https://api.nasa.gov`, injects `api_key`, throws normalized errors on non-2xx)
- [x] `src/tools/apod.ts`: tool with optional `date` param (Zod schema), calls `/planetary/apod`
- [x] Return image as MCP image content block, not just a URL string — this is the "image content-type handling" learning goal (also added an optional `hd` param to choose regular vs HD image)
- [x] Test: called via a scripted MCP `Client`/`StdioClientTransport` (no args, bad date, valid past date + hd) — confirmed schema validation rejects bad dates and image content returns correctly

## Phase 3 — NeoWs (Near Earth Object Web Service)

Originally planned as Mars Rover Photos, but that endpoint's upstream backend (Heroku-hosted, unmaintained) is currently returning "No such app" for every request — see LEARNINGS.md. Swapped in NeoWs instead: still `api.nasa.gov`, still teaches date-based query params (this time a *range*, not a single date), and stays thematically close to the asteroid trio in Phase 6.

- [x] `src/tools/neows.ts`: `start_date`/`end_date` params (both optional, YYYY-MM-DD), calls `/neo/rest/v1/feed`
- [x] Client-side check that the range is ≤ 7 days (NASA rejects wider ranges) — validated without hitting the network
- [x] Truncate to first 30 results across the range + report total count (same truncate-and-note-count pattern as the original Mars Rover plan)
- [x] Test: schema rejects malformed dates, range check rejects >7 days, and a real request correctly surfaced a `429` through `nasa-client.ts`'s error normalization (DEMO_KEY was rate-limited during testing)
- [x] Re-verify the happy path (actual asteroid data, not just error handling) once a personal `NASA_API_KEY` is set or DEMO_KEY quota resets — confirmed working once `.env` loading was fixed (see LEARNINGS.md)
- [ ] Revisit Mars Rover Photos later as a stretch goal if NASA's endpoint comes back online

## Phase 4 — Add a resource

- [x] Expose something as an MCP *resource* rather than a tool (`src/resources/rovers.ts`: static list of valid Mars rovers + their active date ranges, at `nasa://rovers`) to learn the tool-vs-resource distinction hands-on
- [x] Test: scripted MCP client confirmed `resources/list` surfaces it and `resources/read` returns the JSON content — separate protocol methods from `tools/call`

## Phase 5 — Error handling & rate limits

- [x] Normalize NASA API error responses into meaningful MCP tool errors (`throwNormalized` in `src/nasa-client.ts`: branches on status, extracts NASA's own `error.message`/`msg` body when present, falls back to `statusText`)
- [x] Handle 429 (rate limit) explicitly — message differs based on whether `NASA_API_KEY` is set: DEMO_KEY gets pointed at getting a personal key, a personal key gets told it hit its own 1000/hr cap
- [x] Also normalized 403 (invalid key) and wrapped raw network failures (DNS/connection errors) into `NasaApiError` instead of letting a bare fetch `TypeError` leak through
- [x] Test: scripted test with a mocked `fetch` covering 429 (both key states), 403, an unmapped 500, and a network-level rejection — confirmed each produces the intended message; re-verified the real APOD happy path still returns text+image after the changes

## Phase 6 — JPL SSD/CNEOS API tools (asteroid trio)

Different API family from `api.nasa.gov` — base `ssd-api.jpl.nasa.gov`, no API key needed, but requests must be serialized (see LEARNINGS.md). Needs its own `src/ssd-client.ts` rather than reusing `nasa-client.ts`.

- [x] `src/ssd-client.ts`: fetch wrapper for `ssd-api.jpl.nasa.gov`, no key injection, serializes calls (promise-chain queue — no concurrent requests per fair-use policy, verified with a mocked-fetch concurrency test), checks response `signature.version` field and warns on stderr on mismatch
- [x] `src/tools/sbdb.ts` — **SBDB**: look up an asteroid/comet by name/designation, return orbital elements + physical data ("tell me about asteroid Apophis")
- [x] `src/tools/close-approach.ts` — **SB Close Approach (CAD)**: asteroids/comets passing close to Earth in a date range + min distance ("what's approaching Earth this month?")
- [x] `src/tools/sentry.ts` — **Sentry**: Earth impact risk assessment data ("is this asteroid a risk?") — handles three distinct non-risk shapes from the API: never assessed, ruled out/removed, and genuinely at-risk
- [x] Demo: chained sbdb → close_approach → sentry against the running server via a scripted client, including edge cases (not-found designation, an object never on Sentry's list, one removed from it)
- [ ] Stretch (optional, later): Fireball (real meteor impact events, simple date-range query)

## Phase 6c — Moon Phase (stargazing helper)

Third API family — `svs.gsfc.nasa.gov` (NASA Scientific Visualization Studio's "Dial-A-Moon"), no key needed. Added for a concrete use case: a friend who plans stargazing nights needs moon illumination, since that's the single biggest factor in whether a night's sky is dark enough for faint deep-sky viewing — not covered by anything on `api.nasa.gov`.

- [x] `src/svs-client.ts`: minimal fetch wrapper, no key injection, no serialization needed (no documented fair-use rule like SSD's, unlike `ssd-client.ts`)
- [x] `src/tools/moon-phase.ts`: illumination %, phase name (derived from lunar age), distance, and a plain-language stargazing-suitability note; optional `include_image` embeds NASA's rendered moon image for that date/time (reuses `fetchAsBase64` from `nasa-client.ts` — generic binary fetch, not NASA-key-specific)
- [x] Test: verified near-new (1.8%) and near-full (99.5%) illumination extremes produce the right phase name and note, `include_image: true` returns a real image content block, and a malformed date is rejected by the Zod schema before hitting the API

## Phase 6d — Stargazing conditions (location + date → what's visible)

Fourth API family — `ssd.jpl.nasa.gov`'s Horizons ephemeris API (distinct host from `ssd-api.jpl.nasa.gov`, despite being the same JPL infrastructure). Driven by a concrete ask: given a lat/lon and date, tell a friend planning a stargazing trip which naked-eye planets will be above the horizon that night, plus the moon conditions from Phase 6c.

- [x] `src/horizons-client.ts`: fetch wrapper for Horizons' `OBSERVER` ephemeris mode, serialized like `ssd-client.ts` (no documented fair-use policy found, but same JPL family — erring conservative). Parses the fixed-width text table Horizons returns (not JSON like every other tool here) between `$$SOE`/`$$EOE` markers.
- [x] `src/lib/moon.ts`: extracted `phaseName`/`moonStargazingNote` out of `moon-phase.ts` once a second tool needed them — the "second/third use makes the pattern obvious" trigger for abstraction.
- [x] `src/tools/stargazing.ts` — `stargazing_conditions`: takes `latitude`/`longitude`/`date`/`hour`, checks Mercury–Saturn's altitude/azimuth/brightness via Horizons plus moon illumination via SVS, and gives a combined plain-language verdict.
- [x] Explicitly scoped out (see conversation): ISS passes (no reliable current NASA API), weather/cloud cover (not a NASA data source — would need a separate, non-NASA MCP server to stay in scope with this project's NASA-only identity).
- [x] Test: scripted client calls confirming both the "nothing visible" and "several planets visible" branches render correctly (found real above/below-horizon hours for Venus from San Francisco by scanning), plus schema rejection of an out-of-range latitude.

## Phase 6e — Geomagnetic storms / aurora forecast (DONKI)

Back on `api.nasa.gov` (reuses `nasa-client.ts` as-is). Extends the stargazing feature set: moon phase and planet visibility don't cover the "something special is happening tonight" case that aurora does.

- [x] `src/tools/geomagnetic-storms.ts` — `geomagnetic_storms`: lists storms in a date range from `/DONKI/GST`, peak Kp index per storm, and an approximate aurora-visibility latitude threshold from a standard Kp table
- [x] Optional `latitude`/`longitude` (required together): estimates the observer's *geomagnetic* latitude via a dipole-pole approximation and compares that — not raw geographic latitude — against the threshold
- [x] **Caught and fixed a real correctness bug during testing**: the first version compared geographic latitude directly to the Kp threshold table, which said NYC (40.7°N geographic) "likely isn't strong enough" for the May 10, 2024 G5 storm — a storm that was in fact widely seen and photographed from the US Northeast. Root cause: geomagnetic latitude, which is what actually governs aurora visibility, runs well north of geographic latitude in North America (NYC ≈ 50°N geomagnetic) because the magnetic pole is offset toward Canada. Fixed by converting to geomagnetic latitude before comparing; re-tested the same storm/location and it now correctly reads "plausibly visible."
- [x] Test: known G5 storm (May 2024) from NYC now shows "plausibly visible" (post-fix), a low-latitude location correctly shows "not visible" for the same storms, an empty historical range (Jan 2015) returns the right no-storms message, and providing latitude without longitude is rejected with a clear error

## Phase 6b — More `api.nasa.gov` endpoints (optional, pick 1-2 if time allows)

- [ ] EPIC (Earth imagery)

## Phase 7 — Real client testing

- [x] Wire into Claude Code's MCP server config — registered via `claude mcp add mcp-nasa -- node --env-file=.../.env .../dist/index.js` (local scope, so the absolute path + key setup stays out of the repo); `claude mcp get mcp-nasa` confirms `Status: ✓ Connected`
- [ ] Run a few natural-language prompts against it end to end — needs a **new** Claude Code session (MCP servers load at session startup, so a server registered mid-session isn't available in that same session)

## Phase 8 — Polish (stretch)

- [x] README usage examples with real output — rewrote README.md: tool/resource tables, updated project structure (all 4 API-family client files + `lib/`), Claude Code + Claude Desktop wiring snippets
- [x] Basic caching (APOD doesn't change more than once/day) — `src/lib/cache.ts`, memoized per resolved date + `hd` flag in `apod.ts`
- [ ] Consider publishing to npm / listing in an MCP server registry

- [ ] Revisit Mars Rover Photos truncation from Phase 3 — real client-side pagination (a `page`/`offset` param) if truncating to ~20 turns out to hide results users actually wanted — **blocked**: no Mars Rover Photos tool exists yet (Phase 3 swapped to NeoWs), and the upstream proxy still 404s "No such app" as of 2026-08-17; can't start until the endpoint is back and the tool actually exists

---

Update this file as phases complete. If a phase turns out to be wrong-sized (too big/small), just edit it — this isn't sacred.
