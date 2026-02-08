# Gemini PR Reviewer Roadmap

Date: 2026-02-08

## Snapshot
The MVP works end-to-end: issue comment trigger, diff fetch + filtering, Gemini analysis, inline comments, and a summary review with fallback to an issue comment.

## Where This Is Stronger Than The Inspiration (based on local repo inspection)
- Bun + TypeScript implementation with a smaller runtime surface and clearer typing.
- More configurable inputs: review mode, review instructions, include/exclude patterns, max files/hunks/lines, and custom trigger text.
- No repo checkout required: pulls PR metadata and diff directly via GitHub API.
- Local E2E harness with safety limits and a dry run mode.
- Inline comment de-duplication and reviewable line adjustment to avoid invalid positions.
- Summary review with priority breakdown and graceful fallback if the review API fails.

Note: This list is based on the action inputs and README of the original project plus local inspection. If we discover hidden features there, we can refine this list.

## Test Status
Current tests cover:
- Prompt construction.
- Diff parsing and reviewable line adjustment.
- End-to-end run with stubbed dependencies.

Recommended additional tests:
- Config parsing (env defaults, invalid values, list parsing, numeric bounds).
- Filter behavior (include/exclude interactions, max files/hunks/lines).
- Gemini response parsing (invalid JSON, fenced JSON, missing fields, priority normalization).
- Summary formatting and priority counts.
- Error paths (failed review creation -> issue comment fallback).

## CI/CD Recommendation
Add a GitHub Actions workflow to run `bun test` on pull requests and main branch pushes. This should be a required check before merging. Optional additions:
- Linting/formatting check if we add a linter.
- Basic action smoke test with a stubbed event payload (no external calls).

## Roadmap
### Phase 1 - Stabilize
- Add CI workflow with `bun test` gating.
- Add the missing tests listed above.
- Document configuration and default limits in README.
- Add a CHANGELOG and tag the first release (v0.1.0 or v0.2.0).

### Phase 2 - Reliability & Scale
- Chunk large diffs to avoid model input limits.
- Add rate-limit/backoff handling for GitHub and Gemini.
- Make max comments configurable (currently hard-capped at 100).
- Add structured logging (levels, concise summary).

### Phase 3 - UX & Safety
- Support optional triggers (`pull_request` opened/synchronize) in addition to comment triggers.
- Add allowlist for who can trigger reviews.
- Support label-based triggers or re-review commands.

### Phase 4 - Distribution & Performance
- Consider prebuilding/bundling the action to avoid `bun install` on every run.
- Add release artifacts and pinned version tags for stable usage.

## Definition of “Solid Foundation”
- CI is required and green on main.
- Tests cover core parsing, config, prompt, and error paths.
- Clear README and changelog.
- A tagged release with stable inputs and defaults.
