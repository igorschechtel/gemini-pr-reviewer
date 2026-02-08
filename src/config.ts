export type ReviewMode = 'standard' | 'strict' | 'lenient' | 'security' | 'performance';

export type Config = {
  githubToken: string;
  geminiApiKey: string;
  geminiModel: string;
  reviewMode: ReviewMode;
  reviewInstructions: string;
  commandTrigger: string;
  excludePatterns: string[];
  includePatterns: string[];
  maxFiles: number;
  maxHunksPerFile: number;
  maxLinesPerHunk: number;
  globalReview: boolean;
  globalMaxLines: number;
};

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

export function loadConfig(): Config {
  const githubToken = process.env.GITHUB_TOKEN || '';
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const dryRun = process.env.DRY_RUN === 'true';

  if (!geminiApiKey) {
    throw new Error('Missing required env var: GEMINI_API_KEY');
  }

  if (!githubToken && !dryRun) {
    console.info(
      "Tip: you can run this action with `DRY_RUN=true` and `GITHUB_TOKEN` won't be required.",
    );
    throw new Error('Missing required env var: GITHUB_TOKEN');
  }

  const reviewModeRaw = (process.env.REVIEW_MODE || 'standard').toLowerCase();
  const reviewMode: ReviewMode =
    reviewModeRaw === 'strict' ||
    reviewModeRaw === 'lenient' ||
    reviewModeRaw === 'security' ||
    reviewModeRaw === 'performance'
      ? reviewModeRaw
      : 'standard';

  return {
    githubToken,
    geminiApiKey,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-latest',
    reviewMode,
    reviewInstructions: process.env.REVIEW_INSTRUCTIONS || '',
    commandTrigger: process.env.COMMAND_TRIGGER || '/gemini-review',
    excludePatterns: parseList(process.env.EXCLUDE),
    includePatterns: parseList(process.env.INCLUDE),
    maxFiles: parseNumber(process.env.MAX_FILES, 50),
    maxHunksPerFile: parseNumber(process.env.MAX_HUNKS_PER_FILE, 20),
    maxLinesPerHunk: parseNumber(process.env.MAX_LINES_PER_HUNK, 500),
    globalReview: parseBoolean(process.env.GLOBAL_REVIEW, true),
    globalMaxLines: parseNumber(process.env.GLOBAL_MAX_LINES, 2000),
  };
}
