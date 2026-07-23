# CLAUDE.md

Project context for Claude Code sessions working in this repo.

## What this is

An MCP (Model Context Protocol) server exposing NASA's public APIs as tools for MCP clients. First project in a series meant to build genuine MCP protocol understanding (not just "call an API") — see the parent conversation's broader plan: NASA first (protocol basics), then something with real OAuth (Stripe test-mode or Linear) for auth + side-effect-safety patterns.

## Goals for this repo specifically

- Learn: tool vs resource design, input schema validation (Zod), error handling/normalization, image/document content-type responses, rate-limit handling.
- Keep it small and legible — this is a learning project, not a production integration. Prefer explicit code over abstractions until a second/third tool makes the pattern obvious.

## Conventions

- TypeScript, official `@modelcontextprotocol/sdk`, Zod for schemas.
- One NASA endpoint per tool file under `src/tools/`.
- NASA API key comes from `NASA_API_KEY` env var (see `.env.example`); never commit a real key.
- Track progress in [TODO.md](./TODO.md) (checklist, phased). Update it as phases complete.
- Record non-obvious things learned while building in [LEARNINGS.md](./LEARNINGS.md) — MCP concepts, NASA API quirks, gotchas. This is the file to check before re-learning something.

## Where things stand

See TODO.md for the live checklist — don't duplicate that state here.
