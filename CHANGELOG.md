# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.1.1] - 2026-02-08
### Fixed
- Fixed diff filtering logic to correctly support `matchBase: true` and `dot: true` for user-provided patterns (e.g., `*.js` now matches `src/foo.js`).
- Fixed CI to run full checks (linting, type checking, tests) instead of just tests.

### Added
- Comprehensive test suite for Gemini JSON parsing and configuration loading.
- Documentation for `GLOBAL_MAX_LINES` configuration.

## [0.1.0] - 2026-02-08
### Added
- Initial release of Gemini PR Reviewer action.
- Issue comment trigger with configurable command.
- Gemini-powered reviews with inline comments and summary fallback.
- Diff parsing with include/exclude filters and safety limits.
- Local E2E harness with dry-run mode.
- CI workflow for running tests.
- Roadmap for planned improvements.
