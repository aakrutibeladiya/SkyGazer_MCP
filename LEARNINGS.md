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

## MCP SDK / TypeScript gotchas

*(fill in as encountered)*

## Debugging notes

*(fill in — anything that took real time to diagnose, so future-you doesn't re-diagnose it)*

## Useful links

- MCP spec / docs: <https://modelcontextprotocol.io>
- NASA API portal (get a key, browse all endpoints): <https://api.nasa.gov/>
- MCP Inspector (manual testing tool): `npx @modelcontextprotocol/inspector`
