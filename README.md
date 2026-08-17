# SkyGazer MCP

A Model Context Protocol (MCP) server for planning a night of stargazing: is tonight good for it, what's visible, and what's happening in the sky worth going outside for. Built on NASA and JPL data (APOD, NeoWs, DONKI, JPL SSD, JPL Horizons, SVS), not just a wrapper around one API — the flagship tools cross-reference moon illumination, planet ephemeris, and geomagnetic activity into a plain-language answer instead of relaying a single endpoint's raw JSON.

There are other NASA MCP servers with broader endpoint coverage (Mars rover photos, EPIC Earth imagery, EONET, etc.) — this one trades that breadth for depth on one concrete use case: "is tonight worth going outside for?"

## Status

Core tool set is built and wired into both Claude Code and Claude Desktop. See [TODO.md](./TODO.md) for the live phase checklist and [LEARNINGS.md](./LEARNINGS.md) for notes on MCP concepts and API quirks discovered along the way.

## Tools

| Tool | What it does | API |
| --- | --- | --- |
| `apod` | Astronomy Picture of the Day — title, explanation, and the image itself | `api.nasa.gov` |
| `neows` | Near-Earth objects in a date range (≤7 days), with hazard flags | `api.nasa.gov` |
| `geomagnetic_storms` | Geomagnetic storms in a date range, with an aurora-visibility estimate for a given lat/lon | `api.nasa.gov` (DONKI) |
| `sbdb` | Look up an asteroid/comet by name/designation — orbital elements + physical data | `ssd-api.jpl.nasa.gov` |
| `close_approach` | Asteroids/comets passing close to Earth in a date range | `ssd-api.jpl.nasa.gov` |
| `sentry` | Earth impact-risk assessment for a specific object | `ssd-api.jpl.nasa.gov` |
| `moon_phase` | Moon phase/illumination for a date, with a stargazing-suitability note | `svs.gsfc.nasa.gov` |
| `stargazing_conditions` | For a lat/lon + date: moon conditions plus which naked-eye planets are above the horizon | `svs.gsfc.nasa.gov` + `ssd.jpl.nasa.gov` (Horizons) |

## Resources

| Resource | URI | What it is |
| --- | --- | --- |
| Mars Rovers | `nasa://rovers` | Static list of valid rover names + active date ranges |

## Prerequisites

- Node.js (v24) and npm
- A free NASA API key from https://api.nasa.gov/ (or use `DEMO_KEY` for limited testing — 30 requests/hour, 50/day). Only needed for the `api.nasa.gov`-backed tools (`apod`, `neows`, `geomagnetic_storms`); the JPL/SVS-backed tools need no key at all.

## Setup

```bash
npm install
cp .env.example .env   # then fill in your NASA_API_KEY
npm run build
```

## Tech stack

- TypeScript
- `@modelcontextprotocol/sdk` (official MCP SDK for Node)
- Zod for tool input schema validation

## Project structure

```
src/
  index.ts             # server entrypoint, transport wiring, tool/resource registration
  nasa-client.ts        # fetch wrapper for api.nasa.gov: injects api_key, normalizes errors
  ssd-client.ts          # fetch wrapper for ssd-api.jpl.nasa.gov (SBDB/CAD/Sentry): no key, serialized
  svs-client.ts           # fetch wrapper for svs.gsfc.nasa.gov (Dial-A-Moon): no key
  horizons-client.ts       # fetch wrapper for ssd.jpl.nasa.gov Horizons: no key, serialized, parses text ephemeris
  lib/moon.ts               # shared moon-phase-name / stargazing-note helpers
  resources/rovers.ts        # static Mars rovers resource
  tools/                      # one file per tool
```

## Testing locally

Use the MCP Inspector to poke the server without needing a full client:

```bash
npm run inspect
```

Or run a quick scripted check with `tsx` + the MCP `Client`/`StdioClientTransport` classes — see past examples in this repo's history for the pattern.

## Using it from Claude Code / Claude Desktop

**Claude Code:**

```bash
claude mcp add skygazer-mcp -- node --env-file=/absolute/path/to/MCP-NASA/.env /absolute/path/to/MCP-NASA/dist/index.js
```

**Claude Desktop:** add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "skygazer-mcp": {
      "command": "node",
      "args": [
        "--env-file=/absolute/path/to/MCP-NASA/.env",
        "/absolute/path/to/MCP-NASA/dist/index.js"
      ]
    }
  }
}
```

Both require a full app/CLI restart to pick up a newly-registered server — MCP servers are loaded at startup, not hot-reloaded.
