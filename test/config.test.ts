import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { loadConfig } from '../src/config.js';

describe('Configuration Loading', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear relevant env vars
    delete process.env.GITHUB_TOKEN;
    delete process.env.GEMINI_API_KEY;
    delete process.env.DRY_RUN;
    delete process.env.REVIEW_MODE;
    delete process.env.GEMINI_MODEL;
    delete process.env.REVIEW_INSTRUCTIONS;
    delete process.env.COMMAND_TRIGGER;
    delete process.env.EXCLUDE;
    delete process.env.INCLUDE;
    delete process.env.MAX_FILES;
    delete process.env.MAX_HUNKS_PER_FILE;
    delete process.env.MAX_LINES_PER_HUNK;
    delete process.env.GLOBAL_REVIEW;
    delete process.env.GLOBAL_MAX_LINES;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('throws error when GEMINI_API_KEY is missing', () => {
    process.env.GITHUB_TOKEN = 'token';
    expect(() => loadConfig()).toThrow('Missing required env var: GEMINI_API_KEY');
  });

  test('throws error when GITHUB_TOKEN is missing and DRY_RUN is false', () => {
    process.env.GEMINI_API_KEY = 'key';
    expect(() => loadConfig()).toThrow('Missing required env var: GITHUB_TOKEN');
  });

  test('allows missing GITHUB_TOKEN when DRY_RUN is true', () => {
    process.env.GEMINI_API_KEY = 'key';
    process.env.DRY_RUN = 'true';
    const config = loadConfig();
    expect(config.githubToken).toBe('');
  });

  test('runs with minimal valid configuration', () => {
    process.env.GEMINI_API_KEY = 'key';
    process.env.GITHUB_TOKEN = 'token';
    const config = loadConfig();
    expect(config.geminiApiKey).toBe('key');
    expect(config.githubToken).toBe('token');
    // Check defaults
    expect(config.reviewMode).toBe('standard');
    expect(config.geminiModel).toBe('gemini-flash-latest');
    expect(config.maxFiles).toBe(50);
  });

  test('parses comma-separated lists correctly', () => {
    process.env.GEMINI_API_KEY = 'key';
    process.env.GITHUB_TOKEN = 'token';
    process.env.EXCLUDE = 'dist/**, *.md, temp';
    const config = loadConfig();
    expect(config.excludePatterns).toEqual(['dist/**', '*.md', 'temp']);
  });

  test('parses numeric values correctly', () => {
    process.env.GEMINI_API_KEY = 'key';
    process.env.GITHUB_TOKEN = 'token';
    process.env.MAX_FILES = '100';
    process.env.GLOBAL_MAX_LINES = '500';
    const config = loadConfig();
    expect(config.maxFiles).toBe(100);
    expect(config.globalMaxLines).toBe(500);
  });

  test('falls back to defaults for invalid numeric values', () => {
    process.env.GEMINI_API_KEY = 'key';
    process.env.GITHUB_TOKEN = 'token';
    process.env.MAX_FILES = 'invalid';
    process.env.GLOBAL_MAX_LINES = '-50';
    const config = loadConfig();
    expect(config.maxFiles).toBe(50); // Default
    expect(config.globalMaxLines).toBe(2000); // Default
  });

  test('parses boolean values correctly', () => {
    process.env.GEMINI_API_KEY = 'key';
    process.env.GITHUB_TOKEN = 'token';
    process.env.GLOBAL_REVIEW = 'false';
    const config = loadConfig();
    expect(config.globalReview).toBe(false);
  });

  test('parses review mode correctly and falls back to standard', () => {
    process.env.GEMINI_API_KEY = 'key';
    process.env.GITHUB_TOKEN = 'token';

    process.env.REVIEW_MODE = 'security';
    expect(loadConfig().reviewMode).toBe('security');

    process.env.REVIEW_MODE = 'INVALID_MODE';
    expect(loadConfig().reviewMode).toBe('standard');
  });
});
