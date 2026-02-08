# Gemini PR Reviewer

![CI](https://github.com/igorschechtel/gemini-pr-reviewer/actions/workflows/ci.yml/badge.svg)
![Version](https://img.shields.io/github/v/tag/igorschechtel/gemini-pr-reviewer?label=version)
![License](https://img.shields.io/github/license/igorschechtel/gemini-pr-reviewer)

A fast, configurable GitHub Action that reviews pull requests with Google Gemini. It posts inline comments and a concise summary.

## Quick Start

1. Create a repository secret named `GEMINI_API_KEY`.
2. Add this workflow to `.github/workflows/gemini-review.yml`.
3. Open a PR and comment `/gemini-review`.

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
        uses: igorschechtel/gemini-pr-reviewer@v0.1.0
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GEMINI_MODEL: gemini-2.5-flash
          REVIEW_MODE: standard
          REVIEW_INSTRUCTIONS: "Focus on correctness and security. Keep feedback concise."
          EXCLUDE: "*.md,*.txt"
```

## Features

- Comment trigger (`/gemini-review`) on PRs.
- Multiple review modes to control strictness and focus.
- Optional custom instructions appended to the prompt.
- File filtering with include and exclude patterns.
- Safety limits for files, hunks, and lines.
- Always posts a summary review, even if there are zero inline comments.

## Inputs

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | Yes | - | GitHub token to read PR data and post reviews. |
| `GEMINI_API_KEY` | Yes | - | Google Gemini API key. |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model name. |
| `REVIEW_MODE` | No | `standard` | `standard`, `strict`, `lenient`, `security`, `performance`. |
| `REVIEW_INSTRUCTIONS` | No | `""` | Extra instructions appended to the prompt. |
| `COMMAND_TRIGGER` | No | `/gemini-review` | Comment trigger text. |
| `EXCLUDE` | No | `""` | Comma-separated glob patterns to skip. |
| `INCLUDE` | No | `""` | Comma-separated glob patterns to include. |
| `MAX_FILES` | No | `50` | Max files to review. |
| `MAX_HUNKS_PER_FILE` | No | `20` | Max hunks per file. |
| `MAX_LINES_PER_HUNK` | No | `500` | Max lines per hunk. |

## Review Modes

- `standard`: Bugs, security, performance, and maintainability. Skips minor style.
- `strict`: Thorough and pedantic, includes minor issues.
- `lenient`: Only critical bugs and security issues.
- `security`: Security issues only.
- `performance`: Performance issues only.

## Notes

- The action currently supports only the `issue_comment` trigger.
- No repository checkout is required. The action reads PR data via the GitHub API.
- Use `COMMAND_TRIGGER` to customize the comment text.

## Local E2E (Safe, Low-Cost)

This harness runs the full pipeline locally with strict limits:
- `MAX_FILES=1`
- `MAX_HUNKS_PER_FILE=1`
- `MAX_LINES_PER_HUNK=50`

It defaults to `DRY_RUN=true`, so it won’t post reviews back to GitHub unless you opt in.

```bash
export GITHUB_TOKEN=ghs_your_token
export GEMINI_API_KEY=your_gemini_key
export LOCAL_EVENT_PATH=/path/to/event.json
export LOCAL_DIFF_PATH=/path/to/pr.diff  # optional
export DRY_RUN=true

bun run scripts/local_e2e.ts
```

Minimal event payload example:

```json
{
  "issue": { "number": 123, "pull_request": {} },
  "comment": { "body": "/gemini-review" },
  "repository": { "full_name": "owner/repo" }
}
```

## Roadmap

Planned improvements and milestones are tracked in `roadmap.md`.

## License

MIT License. See `LICENSE`.
