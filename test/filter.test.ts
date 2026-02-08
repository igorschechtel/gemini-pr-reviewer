import { describe, expect, test } from 'bun:test';
import { filterDiffFiles, parseUnifiedDiff } from '../src/diff.ts';

describe('Diff Filtering', () => {
  const diff = `diff --git a/src/foo.ts b/src/foo.ts
index 1111111..2222222 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1 +1 @@
-foo
+bar
diff --git a/src/bar.js b/src/bar.js
index 1111111..2222222 100644
--- a/src/bar.js
+++ b/src/bar.js
@@ -1 +1 @@
-bar
+baz
diff --git a/README.md b/README.md
index 1111111..2222222 100644
--- a/README.md
+++ b/README.md
@@ -1 +1 @@
-old
+new
`;

  const allFiles = parseUnifiedDiff(diff);
  // allFiles[0] -> src/foo.ts
  // allFiles[1] -> src/bar.js
  // allFiles[2] -> README.md

  const defaultOptions = {
    maxFiles: 100,
    maxHunksPerFile: 10,
    maxLinesPerHunk: 50,
    includePatterns: [],
    excludePatterns: [],
  };

  test('no filters returns all files', () => {
    const filtered = filterDiffFiles(allFiles, defaultOptions);
    expect(filtered.length).toBe(3);
  });

  test('exclude patterns filter out matching files', () => {
    const options = { ...defaultOptions, excludePatterns: ['*.md'] };
    const filtered = filterDiffFiles(allFiles, options);
    expect(filtered.length).toBe(2);
    expect(filtered.map((f) => f.path)).not.toContain('README.md');
  });

  test('exclude patterns support globs', () => {
    const options = { ...defaultOptions, excludePatterns: ['src/*.ts'] };
    const filtered = filterDiffFiles(allFiles, options);
    expect(filtered.length).toBe(2);
    expect(filtered.map((f) => f.path)).not.toContain('src/foo.ts');
    expect(filtered.map((f) => f.path)).toContain('src/bar.js');
  });

  test('include patterns only keep matching files', () => {
    const options = { ...defaultOptions, includePatterns: ['*.md'] };
    const filtered = filterDiffFiles(allFiles, options);
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.path).toBe('README.md');
  });

  test('include patterns support globs', () => {
    const options = { ...defaultOptions, includePatterns: ['src/**'] };
    const filtered = filterDiffFiles(allFiles, options);
    expect(filtered.length).toBe(2);
    expect(filtered.map((f) => f.path)).toContain('src/foo.ts');
    expect(filtered.map((f) => f.path)).toContain('src/bar.js');
  });

  test('include patterns override exclude patterns (if logic allows)', () => {
    // Logic check: src/diff.ts:87 checks include patterns first.
    // If includePatterns is present, a file MUST match one of them.
    // Then it checks excludePatterns. If it matches exclude, it is skipped.

    // This means "include patterns" acts as an allowlist.
    // And "exclude patterns" acts as a denylist applied AFTER the allowlist.

    const options = {
      ...defaultOptions,
      includePatterns: ['src/**'],
      excludePatterns: ['*.js'],
    };
    const filtered = filterDiffFiles(allFiles, options);

    // Should include src/foo.ts and src/bar.js (because of src/**)
    // THEN exclude src/bar.js (because of *.js)

    expect(filtered.length).toBe(1);
    expect(filtered[0]?.path).toBe('src/foo.ts');
  });

  test('respects maxFiles limit', () => {
    const options = { ...defaultOptions, maxFiles: 1 };
    const filtered = filterDiffFiles(allFiles, options);
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.path).toBe('src/foo.ts');
  });
});
