# Gemini PR Reviewer

A GitHub Action that reviews pull requests using Google Gemini and posts inline comments plus a summary.

## Features
- Comment trigger (`/gemini-review`) on PRs
- Configurable review mode (`standard` default)
- Optional review instructions prompt
- File filtering with include/exclude patterns

## Setup

1. Create a repository secret named `GEMINI_API_KEY`.
2. Add a workflow like this:

```yaml
name: Gemini PR Review

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  gemini-review:
    if: |
      github.event.issue.pull_request &&
      contains(github.event.comment.body, '/gemini-review')
    runs-on: ubuntu-latest
    steps:
      - name: Run Gemini PR Reviewer
        uses: igorschechtel/gemini-pr-reviewer@main
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GEMINI_MODEL: gemini-2.5-flash
          REVIEW_MODE: standard
          REVIEW_INSTRUCTIONS: "Focus on correctness and security. Keep feedback concise."
          EXCLUDE: "*.md,*.txt"
```

## Inputs

- `GITHUB_TOKEN` (required): GitHub token to read PR data and post reviews.
- `GEMINI_API_KEY` (required): Gemini API key.
- `GEMINI_MODEL` (optional): Gemini model name. Default: `gemini-2.5-flash`.
- `REVIEW_MODE` (optional): `standard`, `strict`, `lenient`, `security`, `performance`.
- `REVIEW_INSTRUCTIONS` (optional): Extra instructions appended to the prompt.
- `COMMAND_TRIGGER` (optional): Comment trigger text. Default: `/gemini-review`.
- `EXCLUDE` (optional): Comma-separated glob patterns to skip.
- `INCLUDE` (optional): Comma-separated glob patterns to include.
- `MAX_FILES` (optional): Max files to review. Default: `50`.
- `MAX_HUNKS_PER_FILE` (optional): Max hunks per file. Default: `20`.
- `MAX_LINES_PER_HUNK` (optional): Max lines per hunk. Default: `500`.

## Notes
- The action always posts a summary review, even when no inline comments are generated.
- It currently only supports the `issue_comment` trigger.

## Local E2E (Safe, Low-Cost)

This harness runs the full pipeline locally with strict limits:
- `MAX_FILES=1`
- `MAX_HUNKS_PER_FILE=1`
- `MAX_LINES_PER_HUNK=50`

It defaults to `DRY_RUN=true`, so it won’t post reviews back to GitHub unless you opt in.

### Example

1. Save a GitHub event payload to a file (from a real comment event or a minimal stub).
2. Optionally save a PR diff to a file.
3. Run:

```bash
export GITHUB_TOKEN=ghs_your_token
export GEMINI_API_KEY=your_gemini_key
export LOCAL_EVENT_PATH=/path/to/event.json
export LOCAL_DIFF_PATH=/path/to/pr.diff  # optional
export DRY_RUN=true

bun run scripts/local_e2e.ts
```

### Minimal event payload example

```json
{
  "issue": { "number": 123, "pull_request": {} },
  "comment": { "body": "/gemini-review" },
  "repository": { "full_name": "owner/repo" }
}
```
