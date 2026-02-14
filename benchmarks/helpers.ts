import type { Config } from '../src/config.js';
import { GeminiClient } from '../src/gemini.js';
import type { ReviewComment } from '../src/github.js';
import type { Dependencies, EventPayload } from '../src/index.js';
import type { BenchmarkCase } from './types.js';

export function buildBenchmarkConfig(
  benchmarkCase: BenchmarkCase,
  apiKey: string,
  model?: string,
): Config {
  return {
    githubToken: 'benchmark-mock',
    geminiApiKey: apiKey,
    geminiModel: model || 'gemini-2.0-flash',
    reviewMode: benchmarkCase.reviewMode,
    reviewInstructions: '',
    commandTrigger: '/gemini-review',
    excludePatterns: [],
    includePatterns: [],
    maxFiles: 50,
    maxHunksPerFile: 20,
    maxLinesPerHunk: 500,
    globalReview: true,
    globalMaxLines: 2000,
    retryMaxAttempts: 4,
    retryInitialDelayMs: 1000,
  };
}

export function buildBenchmarkDeps(
  benchmarkCase: BenchmarkCase,
  capturedComments: ReviewComment[],
  model?: string,
): Dependencies {
  const event: EventPayload = {
    issue: { number: 1, pull_request: {} },
    comment: { id: 1, body: '/gemini-review' },
    repository: { full_name: 'benchmark/test-repo' },
  };

  return {
    loadEventPayload: async () => event,
    fetchPullRequest: async () => ({
      owner: 'benchmark',
      repo: 'test-repo',
      pullNumber: 1,
      title: benchmarkCase.prTitle,
      body: benchmarkCase.prBody,
      headSha: 'benchmark-head',
      baseSha: 'benchmark-base',
    }),
    fetchPullRequestDiff: async () => benchmarkCase.diff,
    createReview: async (_pr, _token, _body, comments) => {
      capturedComments.push(...comments);
    },
    postIssueComment: async () => {},
    addCommentReaction: async () => {},
    createGeminiClient: (key, modelName, retryOptions) =>
      new GeminiClient(key, model || modelName, retryOptions),
    fetchPullRequestCommits: async () => ['feat: benchmark test commit'],
    fetchIssue: async () => ({ title: '', body: '' }),
    extractLinkedIssueRefs: () => [],
    fetchFileContent: async () => '',
    fetchRepoFileStructure: async () => 'src/index.ts\npackage.json\nREADME.md',
  };
}
