import { describe, expect, test } from 'bun:test';
import type { Config } from '../src/config.ts';
import { buildNumberedPatch, parseUnifiedDiff } from '../src/diff.ts';
import type { ReviewComment } from '../src/github.ts';
import { type Dependencies, type EventPayload, run } from '../src/index.ts';

const diffText = `diff --git a/src/foo.ts b/src/foo.ts
index 1111111..2222222 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,1 +1,2 @@
-const a = 1;
+const a = 2;
+const b = 3;
`;

describe('integration pipeline', () => {
  test('runs end-to-end with stubbed clients', async () => {
    const config: Config = {
      githubToken: 'ghs_test',
      geminiApiKey: 'gemini_test_key',
      geminiModel: 'gemini-flash-latest',
      reviewMode: 'standard',
      reviewInstructions: '',
      commandTrigger: '/gemini-review',
      excludePatterns: [],
      includePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: 500,
      globalReview: true,
      globalMaxLines: 2000,
    };

    const event: EventPayload = {
      issue: { number: 42, pull_request: {} },
      comment: { body: '/gemini-review please' },
      repository: { full_name: 'acme/rocket' },
    };

    const parsed = parseUnifiedDiff(diffText);
    const file = parsed[0];
    if (!file) throw new Error('File not found');
    const numbered = buildNumberedPatch(file, {
      includePatterns: [],
      excludePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: 500,
    });

    const firstReviewable = Array.from(numbered.lineMeta.values()).find((m) => m.reviewable);
    if (!firstReviewable) throw new Error('No reviewable lines found in diff');

    const createReviewCalls: Array<{ body: string; comments: ReviewComment[] }> = [];

    const deps: Dependencies = {
      loadEventPayload: async () => event,
      fetchPullRequest: async () => ({
        owner: 'acme',
        repo: 'rocket',
        pullNumber: 42,
        title: 'Test PR',
        body: 'Test description',
        headSha: 'head',
        baseSha: 'base',
      }),
      fetchPullRequestDiff: async () => diffText,
      createReview: async (
        _pr: unknown,
        _token: string,
        body: string,
        comments: ReviewComment[],
      ) => {
        createReviewCalls.push({ body, comments });
      },
      postIssueComment: async () => {
        throw new Error('postIssueComment should not be called');
      },
      addCommentReaction: async () => {},
      createGeminiClient: (_apiKey: string, _modelName: string) => ({
        review: async () => [
          {
            lineNumber: firstReviewable.position,
            reviewComment: 'Consider using a named constant.',
            priority: 'low',
          },
        ],
        reviewGlobal: async () => ({
          summary: 'No cross-file issues detected.',
          findings: [],
        }),
        generatePRGoal: async () => ({
          goal: 'Test Goal',
          context: 'Test Context',
        }),
      }),
      fetchPullRequestCommits: async () => [],
      fetchIssue: async () => ({ title: 'Test Issue', body: 'Test Body' }),
      extractLinkedIssueRefs: () => [{ owner: 'acme', repo: 'rocket', issueNumber: 123 }],
      fetchFileContent: async () => 'mock content',
      fetchRepoFileStructure: async () => 'mock structure',
    };

    const result = await run({
      config,
      env: { GITHUB_EVENT_PATH: '/tmp/event.json', GITHUB_EVENT_NAME: 'issue_comment' },
      deps,
    });

    expect(result.skipped).toBe(false);
    expect(result.comments.length).toBe(1);
    expect(result.summary).toContain('Gemini PR Review');
    expect(createReviewCalls.length).toBe(1);
    const firstCall = createReviewCalls[0];
    if (!firstCall) throw new Error('No review created');
    expect(firstCall.comments.length).toBe(1);
  });
});
