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
- [x] **Release**: Tag v0.1.0 with a complete CHANGELOG.

### Phase 2: Context & Insight Quality
Focus on optimizing *how* we present data to the model to extract better reviews.
- [ ] **Golden Data Suite**: Create `benchmarks/` with static diffs to measure consistency.
- [ ] **Context Optimization**:
    - [x] Implemented PR Goal generation from commits and linked issues.
    - [ ] Experiment with context strategies (full file vs. chunks, dependency graphs) to improve signal-to-noise.
- [ ] **System Prompt Architecture**: Refactor `src/prompt.ts` to separate "Role" from "Data".
    - [ ] **Modular Personas**: Allow swapping system prompts (e.g., "Security Auditor" vs "Code Stylist").
    - [ ] **Structured Output**: Enforce JSON schemas via system instructions for robustness.
- [ ] **Prompt Engineering**: Iteratively refine prompts to guide the fixed model towards better insights.
- [ ] **Automated Scoring**: Use a "Judge" to verify if context/prompt changes actually yield better comments for the same model.

### Phase 3: Reliability & Scale
Address potential bottlenecks for larger repositories and higher loads.
- [ ] **Large Diff Handling**: Implement intelligent chunking for diffs exceeding model context limits.
- [ ] **Rate Limiting**: Add backoff/retry logic for GitHub and Gemini API rate limits.
- [ ] **Configurable Thresholds**: Expose `MAX_COMMENTS` configuration (currently hard-capped).
- [ ] **Observability**: Implement structured JSON logging for better debugging in Action logs.

### Phase 4: UX & Security Enhancements
Improve the user experience and security controls.
- [ ] **Trigger Flexibility**: Support `pull_request` events (open, synchronize) and label-based triggers.
- [ ] **Access Control**: Implement allowlists for users authorized to trigger reviews.
- [ ] **Interactive Commands**: Support re-review commands or finer-grained triggers (e.g., `/gemini-review security`).
- [ ] **Review Satisfaction & Scope Control**:
    - [ ] **Stateful context (via history)**: Maintain statelessness by fetching the PR's existing comment/review history before analysis. Feed "resolved" or "ignored" threads back to the AI to prevent repetitive nagging on the same code locations.
    - [ ] **Acceptance Thresholds**: Introduce an AI-generated "Readiness Score" (0-100%). If a PR is >90% ready, suppress minor nits to avoid "never-ending" loops.
    - [ ] **Explicit Scope Control**: Allow users to define "Non-Critical Areas" or "Out of Scope" files in configuration to limit AI pedantry.
    - [ ] **Review Fatigue Prevention**: Limit the total number of reviews per PR/branch to encourage human closure on open threads.
    - [ ] **Contextual Severity Tuning**: Adjust the AI's "strictness" based on the PR's priority or lifecycle stage (e.g., "Draft" vs "Hotfix").

### Phase 5: Distribution & Optimization
Optimize the action for faster execution and broader distribution.
- [ ] **Pre-bundling**: Bundle the action to remove the `bun install` step at runtime.
- [ ] **Artifacts**: Publish pinned release artifacts for stable consumption.
