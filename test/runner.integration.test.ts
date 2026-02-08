import { describe, expect, test } from "bun:test";
import { run, type Dependencies, type EventPayload } from "../src/index";
import { parseUnifiedDiff, buildNumberedPatch } from "../src/diff";
import type { Config } from "../src/config";

const diffText = `diff --git a/src/foo.ts b/src/foo.ts
index 1111111..2222222 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,1 +1,2 @@
-const a = 1;
+const a = 2;
+const b = 3;
`;

describe("integration pipeline", () => {
  test("runs end-to-end with stubbed clients", async () => {
    const config: Config = {
      githubToken: "ghs_test",
      geminiApiKey: "gemini_test_key",
      geminiModel: "gemini-2.5-flash",
      reviewMode: "standard",
      reviewInstructions: "",
      commandTrigger: "/gemini-review",
      excludePatterns: [],
      includePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: 500,
      globalReview: true,
      globalMaxLines: 2000
    };

    const event: EventPayload = {
      issue: { number: 42, pull_request: {} },
      comment: { body: "/gemini-review please" },
      repository: { full_name: "acme/rocket" }
    };

    const parsed = parseUnifiedDiff(diffText);
    const numbered = buildNumberedPatch(parsed[0], {
      includePatterns: [],
      excludePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: 500
    });

    const firstReviewable = Array.from(numbered.lineMeta.values()).find((m) => m.reviewable);
    if (!firstReviewable) throw new Error("No reviewable lines found in diff");

    const createReviewCalls: Array<{ body: string; comments: any[] }> = [];

    const deps: Dependencies = {
      loadEventPayload: async () => event,
      fetchPullRequest: async () => ({
        owner: "acme",
        repo: "rocket",
        pullNumber: 42,
        title: "Test PR",
        body: "Test description",
        headSha: "head",
        baseSha: "base"
      }),
      fetchPullRequestDiff: async () => diffText,
      createReview: async (_pr, _token, body, comments) => {
        createReviewCalls.push({ body, comments });
      },
      postIssueComment: async () => {
        throw new Error("postIssueComment should not be called");
      },
      createGeminiClient: () => ({
        review: async () => [
          {
            lineNumber: firstReviewable.position,
            reviewComment: "Consider using a named constant.",
            priority: "low"
          }
        ],
        reviewGlobal: async () => ({
          summary: "No cross-file issues detected.",
          findings: []
        })
      })
    };

    const result = await run({
      config,
      env: { GITHUB_EVENT_PATH: "/tmp/event.json", GITHUB_EVENT_NAME: "issue_comment" },
      deps
    });

    expect(result.skipped).toBe(false);
    expect(result.comments.length).toBe(1);
    expect(result.summary).toContain("Gemini PR Review");
    expect(createReviewCalls.length).toBe(1);
    expect(createReviewCalls[0].comments.length).toBe(1);
  });
});
