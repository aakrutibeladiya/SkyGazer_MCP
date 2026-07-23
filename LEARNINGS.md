# Learnings

Running notes on things worth remembering later. Add an entry whenever something is non-obvious, surprising, or took more than a couple minutes to figure out. Newest at the bottom of each section.

## MCP core concepts (primer, fill in / correct as understanding deepens)

- **Tools** — actions the model can *call* with arguments (like a function call). Use for anything that takes input and does/returns something: "get today's APOD", "search Mars photos for sol 1000".
- **Resources** — data the client can *read*, addressed by URI, usually without arguments (or simple ones). Think "list of files" / "list of valid rovers" — things you'd browse rather than invoke. Resources can be listed and read separately, and clients may cache them.
- **Prompts** — reusable prompt templates the server exposes to the client. Not used in this project (yet).
- **Transport** — how client and server talk. Local servers typically use stdio (spawn a process, talk over stdin/stdout). Remote servers use HTTP/SSE.
- **Schema validation** — tool inputs are declared with a JSON Schema (via Zod in the TS SDK). The client/model sees this schema and it constrains what arguments get sent — get it precise, since it's effectively the tool's API contract.
- **Content types in responses** — a tool result isn't just text; it can be text, image, or embedded resource blocks. NASA's imagery APIs are a natural fit for testing image content blocks specifically.

## NASA API notes

- There are (at least) two separate NASA API families: `api.nasa.gov` (APOD, Mars Rover Photos, NeoWs, EPIC, DONKI — needs an API key) and JPL's **SSD/CNEOS API** (`ssd-api.jpl.nasa.gov` — Close Approach Data, Small-Body Database, Sentry, Fireball, NHATS — no key needed). Different base URLs, different fair-use rules; don't assume one client config covers both.
- SSD API fair-use rule that actually affects code: **no simultaneous requests** — any client for this API must serialize calls (no `Promise.all` fan-out), not just rate-limit them. Its "no embedding in a website" / CORS rule doesn't apply to a server-side MCP server — that's a browser-only restriction.
- SSD API responses include a `version` field specifically because formats can change without notice — worth checking it against an expected value and warning on mismatch rather than assuming the shape.

*(fill in more as Phase 2+ progresses — e.g., DEMO_KEY limits, quirks in APOD/Mars Rover Photos response shapes, date format gotchas)*

- Mars Rover Photos has no server-side pagination — a single sol/date query can return hundreds of photos in one JSON response. Decided to truncate to the first ~20 and report the total count in the text response, rather than embedding real client-side pagination (a `page` param, cursor, etc.) up front. Reasoning: this is a learning project, and building pagination machinery before knowing whether truncation is actually a problem in practice is premature — easy to revisit later (flagged in Phase 8) if 20 turns out to be too few for real use.
- **Mars Rover Photos' upstream is currently broken** — `api.nasa.gov/mars-photos/api/v1/rovers/.../photos` returns a raw Heroku "No such app" HTML page (not JSON, not a NASA error) for every request, including valid ones. The underlying `mars-photo-api` project was Heroku-hosted and the maintainer archived it after running out of time to keep it working post-Heroku's 2022 free-tier shutdown. Confirmed via direct `curl` (not our code) before building anything, so Phase 3 was swapped to NeoWs instead. Worth re-checking periodically in case NASA points the proxy elsewhere.
- **`DEMO_KEY` is a shared, globally-throttled key** — hit `429 OVER_RATE_LIMIT` on it after a modest number of calls during Phase 2/3 testing (a handful of APOD + NeoWs calls), well under the documented 30/hr personal cap. Because `DEMO_KEY` is the same key every anonymous NASA API user shares, its quota can be exhausted by *other people's* traffic, not just your own — it's unreliable for actual dev iteration. A free personal key from <https://api.nasa.gov/> (instant, email-delivered) gives 1000 req/hr and avoids this entirely; worth doing before Phase 3's happy-path re-test.

- APOD's `media_type` can be `"video"` (no `url` pointing at an image) — a tool that always tries to fetch/embed an image needs to branch on this rather than assume every day has a photo.
- `hdurl` is sometimes absent even when `hdurl` would normally be present; fall back to `url` if the caller asked for HD but it's missing.

## MCP SDK / TypeScript gotchas

- `registerTool`'s `inputSchema` takes a **raw shape** (a plain object of Zod schemas, e.g. `{ date: z.string().optional() }`), not a `z.object({...})` — the SDK wraps it internally.
- Thrown errors inside a tool handler are caught automatically by the SDK and turned into a `CallToolResult` with `isError: true` — no need for a try/catch in every handler just to report failure to the client. Same applies to Zod input-validation failures: they never reach the handler as a thrown exception the *caller* sees; the client gets back `isError: true` with the validation message in a text block, not a rejected promise/protocol-level error.
- `tsconfig.json` needs `"types": ["node"]` in `compilerOptions` for Node globals (`process`, `Buffer`) to resolve under `strict` mode, even with `@types/node` installed as a dependency — install alone isn't enough.
- For manual testing without the interactive Inspector UI, spin up an MCP `Client` + `StdioClientTransport` in a small script that spawns `tsx src/index.ts` — lets you call `listTools()`/`callTool()` programmatically and assert on results, which is more scriptable than clicking through Inspector for every check.

## Debugging notes

- **`.env` isn't loaded automatically — silent fallback to `DEMO_KEY` masqueraded as a real rate-limit problem.** `nasa-client.ts` reads `process.env.NASA_API_KEY` directly, but neither Node nor `tsx` reads `.env` files on their own; nothing in this project used a `dotenv`-style loader. So a real personal key sitting in `.env` was never actually reaching the process — every run silently fell back to the shared `DEMO_KEY`, which is what was producing `429` errors in the Inspector even though a working key already existed. Fixed by adding `--env-file=.env` to the `dev`/`start`/`inspect` npm scripts in `package.json` — Node 20.6+ supports this flag natively (confirmed on Node 24 here), and `tsx` forwards it straight through to Node, so no `dotenv` dependency was needed. Lesson: if a fix "should" work but the symptom persists, check whether the config is actually reaching the process before assuming the fix is wrong.

## Useful links

- MCP spec / docs: <https://modelcontextprotocol.io>
- NASA API portal (get a key, browse all endpoints): <https://api.nasa.gov/>
- MCP Inspector (manual testing tool): `npx @modelcontextprotocol/inspector`
