# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Gemini PR Reviewer is a GitHub Action that reviews pull requests using Google's Gemini AI. It is triggered by PR comments (default: `/gemini-review`), analyzes diffs, and posts inline review comments and a PR summary via the GitHub API.

## Commands

```bash
bun run check          # Lint + format (Biome) + type check (tsgo) + tests — MUST pass before finishing any task
bun test               # Run unit tests only (Bun's native test runner)
bun run start          # Run the action locally
bun run e2e:local      # Local E2E simulation with mock data and DRY_RUN=true
bunx biome check --fix # Fix formatting/linting issues only
```

`bun run check` is the single gate — always run it before considering work done.

## Architecture

**Two-pass review flow** (orchestrated in `src/index.ts`):

1. **Global pass** — sends a summarized diff of all files to Gemini for cross-file analysis and overall PR summary
2. **Inline pass** — reviews each file individually (parallel, concurrency=5 via `p-limit`), using the global summary as context, and produces line-level comments

Key modules:
- `src/index.ts` — entry point and orchestration; uses dependency injection for testability
- `src/config.ts` — loads and validates config from environment variables
- `src/prompt.ts` — constructs system/user prompts; modular review modes (standard, strict, lenient, security, performance)
- `src/gemini.ts` — Gemini API client, JSON response parsing
- `src/github.ts` — GitHub REST API interactions (fetch PR/diff/commits/issues, post reviews)
- `src/diff.ts` — unified diff parsing, file filtering (include/exclude globs), reviewable line adjustment

## Conventions

- **Runtime**: Bun (not Node.js)
- **Formatting**: Biome — single quotes, 2-space indent, 100-char line width
- **File naming**: kebab-case
- **Imports**: use `.js` extensions (ESM/Bun interop requirement)
- **Testing**: unit tests in `test/` using Bun's test runner; mocks in `test/mocks/`
- **TypeScript**: strict mode, path alias `~/*` maps to `./src/*`
- **Dependencies are injected** in `src/index.ts` to keep core logic testable

## Prompt Engineering

The prompts in `src/prompt.ts` are a critical part of the system. When modifying them:
- Keep **System Prompt** (identity + rules) separate from **User Context** (diff + metadata)
- Review modes are modular personas — don't hardcode a single personality
- Optimize for **insight per token sent** — lean, relevant context produces better reviews
