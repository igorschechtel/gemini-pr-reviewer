# AI Agent Instructions

Welcome to the **Gemini PR Reviewer** project. This document provides essential instructions and context for AI agents working on this codebase.

## 🚀 Mandatory Development Rule

**ALWAYS** run the following command and ensure it passes before considering any task finished:

```bash
bun run check
```

This command runs:
1. **Linting & Formatting**: `biome check --fix`
2. **Type Checking**: `tsgo` 
3. **Tests**: `bun test`

## 🛠 Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Language**: TypeScript
- **Linting/Formatting**: [Biome](https://biomejs.dev/)
- **AI**: Google Gemini API via `@google/generative-ai`
- **Actions**: GitHub Actions (Composite)

## 📂 Project Structure

- `src/index.ts`: Entry point and main execution flow.
- `src/config.ts`: Configuration loading and validation.
- `src/diff.ts`: Unified diff parsing, filtering, and reviewable line adjustment.
- `src/gemini.ts`: Gemini API client and response parsing.
- `src/github.ts`: GitHub API interactions.
- `src/prompt.ts`: Prompt construction logic for global and inline reviews.
- `test/`: Unit tests using Bun's test runner.
- `scripts/`: Utility scripts, including `local_e2e.ts` for local testing.

## 🧠 Core Logic: Two-Pass Review

The reviewer operates in two passes:
1. **Global Pass**: Analyzes the PR title, description, and a summarized diff to understand the overall context and cross-file implications.
2. **Inline Pass**: Analyzes each file individually, using the global summary as context to provide specific inline comments.

## 📝 Coding Standards

- **Files**: Use kebab-case for filenames.
- **Imports**: Use `.js` extensions in imports (required for ESM/Bun interop in some configurations).
- **Complexity**: Keep functions focused. Use the `Dependencies` injection pattern in `src/index.ts` to keep the core logic testable.

## 🧪 Testing

- Unit tests are located in `test/`.
- Use `bun test` to run them.
- For local E2E simulation, use `bun run e2e:local` (requires `GEMINI_API_KEY` and `GITHUB_TOKEN`).
