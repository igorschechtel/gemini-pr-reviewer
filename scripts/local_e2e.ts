import { readFile } from "node:fs/promises";
import { loadConfig, type Config } from "../src/config";
import { run, loadEventPayload, type Dependencies } from "../src/index";
import {
  fetchPullRequest,
  fetchPullRequestDiff,
  createReview,
  postIssueComment,
  type PRDetails,
  type ReviewComment
} from "../src/github";
import { GeminiClient } from "../src/gemini";

function clamp(value: number, max: number): number {
  return Math.min(value, max);
}

function applySafetyLimits(config: Config): Config {
  const maxFiles = clamp(config.maxFiles, 1);
  const maxHunksPerFile = clamp(config.maxHunksPerFile, 1);
  const maxLinesPerHunk = clamp(config.maxLinesPerHunk, 50);

  if (
    maxFiles !== config.maxFiles ||
    maxHunksPerFile !== config.maxHunksPerFile ||
    maxLinesPerHunk !== config.maxLinesPerHunk
  ) {
    console.log(
      `Applying safe limits: MAX_FILES=${maxFiles}, MAX_HUNKS_PER_FILE=${maxHunksPerFile}, MAX_LINES_PER_HUNK=${maxLinesPerHunk}`
    );
  }

  return {
    ...config,
    maxFiles,
    maxHunksPerFile,
    maxLinesPerHunk
  };
}

function normalizeBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

async function loadDiffFromFile(diffPath: string): Promise<string> {
  const diff = await readFile(diffPath, "utf-8");
  if (!diff.trim()) {
    throw new Error(`Diff file is empty: ${diffPath}`);
  }
  return diff;
}

async function fetchLocalPullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string
): Promise<PRDetails> {
  const title = process.env.LOCAL_PR_TITLE || "Local PR";
  const body = process.env.LOCAL_PR_BODY || "Local PR body";

  if (process.env.LOCAL_PR_TITLE || process.env.LOCAL_PR_BODY) {
    return {
      owner,
      repo,
      pullNumber,
      title,
      body,
      headSha: "local",
      baseSha: "local"
    };
  }

  return await fetchPullRequest(owner, repo, pullNumber, token);
}

async function main(): Promise<void> {
  const baseConfig = loadConfig();
  const config = applySafetyLimits(baseConfig);

  const eventPath = process.env.LOCAL_EVENT_PATH || process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error("LOCAL_EVENT_PATH or GITHUB_EVENT_PATH is required for local E2E runs");
  }

  const diffPath = process.env.LOCAL_DIFF_PATH;
  const dryRun = normalizeBoolean(process.env.DRY_RUN, true);

  const deps: Dependencies = {
    loadEventPayload,
    fetchPullRequest: fetchLocalPullRequest,
    fetchPullRequestDiff: async (owner, repo, pullNumber, token) => {
      if (diffPath) {
        return await loadDiffFromFile(diffPath);
      }
      return await fetchPullRequestDiff(owner, repo, pullNumber, token);
    },
    createReview: async (pr, token, body, comments) => {
      if (dryRun) {
        console.log("DRY_RUN enabled: skipping createReview");
        logReviewPreview(body, comments);
        return;
      }
      await createReview(pr, token, body, comments);
    },
    postIssueComment: async (pr, token, body) => {
      if (dryRun) {
        console.log("DRY_RUN enabled: skipping postIssueComment");
        console.log(body);
        return;
      }
      await postIssueComment(pr, token, body);
    },
    createGeminiClient: (apiKey, modelName) => new GeminiClient(apiKey, modelName)
  };

  const env = {
    ...process.env,
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_EVENT_NAME: process.env.GITHUB_EVENT_NAME || "issue_comment"
  };

  const result = await run({ config, env, deps });
  if (result.skipped) {
    console.log(`Skipped: ${result.skippedReason}`);
  }
}

function logReviewPreview(body: string, comments: ReviewComment[]): void {
  console.log("--- Review Summary ---");
  console.log(body);
  console.log("--- Inline Comments ---");
  for (const comment of comments) {
    console.log(`- ${comment.path} @ ${comment.position}: ${comment.body}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
