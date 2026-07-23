# TODO / Roadmap

Phased checklist. Work top to bottom — each phase should leave you with something runnable, not just code in progress.

## Phase 0 — Housekeeping (this session)
- [x] git init
- [x] README.md, CLAUDE.md, TODO.md, LEARNINGS.md
- [ ] Get a NASA API key from https://api.nasa.gov/ (free, instant, email delivery) — `DEMO_KEY` works meanwhile but caps at 30 req/hr, 50/day
- [ ] `.gitignore` + `.env.example`

## Phase 1 — Project scaffold
- [ ] `npm init`, install `@modelcontextprotocol/sdk`, `zod`, `typescript`, `tsx`/`ts-node`
- [ ] `tsconfig.json`
- [ ] Minimal `src/index.ts`: server that starts, connects over stdio transport, exposes zero tools
- [ ] Verify it starts with `npx @modelcontextprotocol/inspector node dist/index.js` (or `tsx src/index.ts`)

## Phase 2 — First real tool: APOD (Astronomy Picture of the Day)
- [ ] `src/nasa-client.ts`: fetch wrapper (base URL `https://api.nasa.gov`, injects `api_key`, throws normalized errors on non-2xx)
- [ ] `src/tools/apod.ts`: tool with optional `date` param (Zod schema), calls `/planetary/apod`
- [ ] Return image as MCP image content block, not just a URL string — this is the "image content-type handling" learning goal
- [ ] Test via Inspector: call with and without `date`, confirm schema validation rejects bad dates

## Phase 3 — Mars Rover Photos
- [ ] `src/tools/mars-rover-photos.ts`: params for rover name (enum: curiosity/opportunity/spirit/perseverance), sol or earth_date, camera (optional)
- [ ] Handle pagination / large result sets sensibly (NASA returns all matches — decide: truncate + note count, or paginate client-side)
- [ ] Test edge cases: invalid rover name, no photos for that sol/date

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

---
Update this file as phases complete. If a phase turns out to be wrong-sized (too big/small), just edit it — this isn't sacred.
