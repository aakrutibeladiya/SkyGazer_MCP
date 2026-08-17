# MCP NASA

A Model Context Protocol (MCP) server that wraps NASA's public APIs (APOD, Mars Rover Photos, NeoWs, EPIC, DONKI) so an MCP client (Claude Desktop, Claude Code, etc.) can query space data as tools/resources.

Built primarily as a learning project: nail MCP protocol mechanics (tools, resources, schemas, error handling, image content) on a free, key-friendly API before moving on to harder auth/side-effect patterns (OAuth, Stripe, Linear, etc.).

## Status

Early scaffolding — see [TODO.md](./TODO.md) for the current phase and [LEARNINGS.md](./LEARNINGS.md) for notes on MCP concepts as they're learned.

## Prerequisites

- Node.js (v24 installed locally) and npm
- A free NASA API key from https://api.nasa.gov/ (or use `DEMO_KEY` for very limited testing — 30 requests/hour, 50/day)

## Setup

```bash
npm install
cp .env.example .env   # then fill in your NASA_API_KEY
```

## Tech stack

- TypeScript
- `@modelcontextprotocol/sdk` (official MCP SDK for Node)
- Zod for tool input schema validation

## Project structure (planned)

```
src/
  index.ts        # server entrypoint, transport wiring
  tools/          # one file per NASA API wrapped as an MCP tool
  nasa-client.ts  # thin fetch wrapper: base URL, API key, error normalization
```

## Testing locally

Use the MCP Inspector to poke the server without needing a full client:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```


