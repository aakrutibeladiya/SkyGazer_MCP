# TODO / Roadmap

Phased checklist. Work top to bottom — each phase should leave you with something runnable, not just code in progress.

## Phase 0 — Housekeeping (this session)

- [x] git init
- [x] README.md, CLAUDE.md, TODO.md, LEARNINGS.md
- [x] Get a NASA API key from <https://api.nasa.gov/> (free, instant, email delivery) — `DEMO_KEY` works meanwhile but caps at 30 req/hr, 50/day
- [ ] `.gitignore` + `.env.example`

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

- [ ] Expose something as an MCP *resource* rather than a tool (e.g., list of valid Mars rovers + their active date ranges) to learn the tool-vs-resource distinction hands-on

## Phase 5 — Error handling & rate limits

- [ ] Normalize NASA API error responses into meaningful MCP tool errors
- [ ] Handle 429 (rate limit) explicitly — surface a clear message pointing at swapping DEMO_KEY for a real key

## Phase 6 — JPL SSD/CNEOS API tools (asteroid trio)

Different API family from `api.nasa.gov` — base `ssd-api.jpl.nasa.gov`, no API key needed, but requests must be serialized (see LEARNINGS.md). Needs its own `src/ssd-client.ts` rather than reusing `nasa-client.ts`.

- [ ] `src/ssd-client.ts`: fetch wrapper for `ssd-api.jpl.nasa.gov`, no key injection, serializes calls (simple queue/mutex — no concurrent requests per fair-use policy), checks response `version` field and warns on mismatch
- [ ] `src/tools/sbdb.ts` — **SBDB**: look up an asteroid/comet by name/designation, return orbital elements + physical data ("tell me about asteroid Apophis")
- [ ] `src/tools/close-approach.ts` — **SB Close Approach (CAD)**: asteroids/comets passing close to Earth in a date range + min distance ("what's approaching Earth this month?")
- [ ] `src/tools/sentry.ts` — **Sentry**: Earth impact risk assessment data ("is this asteroid a risk?")
- [ ] Demo: chain the three in one natural-language prompt against the running server ("is there anything dangerous approaching Earth right now?")
- [ ] Stretch (optional, later): Fireball (real meteor impact events, simple date-range query)

## Phase 6b — More `api.nasa.gov` endpoints (optional, pick 1-2 if time allows)

- [ ] NeoWs (Near Earth Object Web Service) — asteroid data, teaches date-range query params
- [ ] EPIC (Earth imagery)
- [ ] DONKI (space weather events)

## Phase 7 — Real client testing

- [ ] Wire into Claude Code or Claude Desktop's MCP server config
- [ ] Run a few natural-language prompts against it end to end

## Phase 8 — Polish (stretch)

- [ ] README usage examples with real output
- [ ] Basic caching (APOD doesn't change more than once/day)
- [ ] Consider publishing to npm / listing in an MCP server registry
- [ ] Revisit Mars Rover Photos truncation from Phase 3 — real client-side pagination (a `page`/`offset` param) if truncating to ~20 turns out to hide results users actually wanted

---

Update this file as phases complete. If a phase turns out to be wrong-sized (too big/small), just edit it — this isn't sacred.
