# Roadmap

## 📍 Current Status

The core functionality is fully implemented and operational.
- **End-to-End Workflow**: Functional issue comment trigger (`/gemini-review`), diff fetching, Gemini analysis, and review posting.
- **Two-Pass Review**: Implemented global context analysis followed by file-specific inline comments.
- **Safety & Config**: Configurable limits (files, hunks, lines) and comprehensive include/exclude filtering.
- **Robustness**: Graceful fallback to issue comments if review creation fails.
- **Local Dev**: E2E simulation script (`scripts/local_e2e.ts`) and full type coverage.

---

## 🚀 Future Phases

### Phase 1: Stabilization & Testing
Focus on ensuring reliability and maximizing test coverage before the v0.1.0 release.
- [x] **CI/CD Pipeline**: Implement GitHub Actions workflow for comprehensive testing and linting.
- [x] **Expanded Test Suite**:
    - [x] Configuration parsing edge cases.
    - [ ] Specialized filter behavior tests.
    - [x] Robust JSON parsing for Gemini responses.
- [x] **Documentation**: Finalize README configuration tables and defaults.
- [ ] **Release**: Tag v0.1.0 with a complete CHANGELOG.

### Phase 2: Reliability & Scale
Address potential bottlenecks for larger repositories and higher loads.
- [ ] **Large Diff Handling**: Implement intelligent chunking for diffs exceeding model context limits.
- [ ] **Rate Limiting**: Add backoff/retry logic for GitHub and Gemini API rate limits.
- [ ] **Configurable Thresholds**: Expose `MAX_COMMENTS` configuration (currently hard-capped).
- [ ] **Observability**: Implement structured JSON logging for better debugging in Action logs.

### Phase 3: UX & Security Enhancements
Improve the user experience and security controls.
- [ ] **Trigger Flexibility**: Support `pull_request` events (open, synchronize) and label-based triggers.
- [ ] **Access Control**: Implement allowlists for users authorized to trigger reviews.
- [ ] **Interactive Commands**: Support re-review commands or finer-grained triggers (e.g., `/gemini-review security`).

### Phase 4: Distribution & Optimization
Optimize the action for faster execution and broader distribution.
- [ ] **Pre-bundling**: Bundle the action to remove the `bun install` step at runtime.
- [ ] **Artifacts**: Publish pinned release artifacts for stable consumption.
