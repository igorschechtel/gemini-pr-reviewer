import { describe, expect, test } from 'bun:test';
import {
  adjustToReviewablePosition,
  buildGlobalDiff,
  buildNumberedPatch,
  parseUnifiedDiff,
} from '../src/diff.ts';

describe('diff parsing and numbering', () => {
  test('builds numbered patch and adjusts to reviewable lines', () => {
    const diff = `diff --git a/src/foo.ts b/src/foo.ts
index 1111111..2222222 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,1 +1,2 @@
-const a = 1;
+const a = 2;
+const b = 3;
`;

    const files = parseUnifiedDiff(diff);
    expect(files.length).toBe(1);
    const file = files[0];
    if (!file) throw new Error('File not found');

    const numbered = buildNumberedPatch(file, {
      includePatterns: [],
      excludePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: 500,
    });

    expect(numbered.lines[0]).toContain('@@');

    const metaValues = Array.from(numbered.lineMeta.values());
    const deletedLine = metaValues.find((m) => m.content.startsWith('-const a'));
    const addedLine = metaValues.find((m) => m.content.startsWith('+const a'));

    if (!deletedLine || !addedLine) throw new Error('Lines not found');

    const adjusted = adjustToReviewablePosition(
      deletedLine.position,
      numbered.lineMeta,
      numbered.hunkPositions,
    );

    expect(adjusted).toBe(addedLine.diffPosition);
  });

  test('correctly maps truncated hunk positions to real diff positions', () => {
    // A diff with ONE hunk that has 5 lines
    const diff = `diff --git a/src/long.ts b/src/long.ts
index 1111111..2222222 100644
--- a/src/long.ts
+++ b/src/long.ts
@@ -1,5 +1,5 @@
+line1
+line2
+line3
+line4
+line5
`;
    // We only want to show the first 2 lines to the LLM
    const limit = 2;

    const files = parseUnifiedDiff(diff);
    const file = files[0];
    if (!file) throw new Error('File not found');

    const numbered = buildNumberedPatch(file, {
      includePatterns: [],
      excludePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: limit, // Only show top 2 lines
    });

    // The prompt (numbered.lines) should only have header + 2 lines
    // Header is at index 0, lines at 1 and 2
    expect(numbered.lines.length).toBe(1 + limit);

    // Virtual position 1 -> Header
    // Virtual position 2 -> line1
    // Virtual position 3 -> line2

    // Now let's check lineMeta.
    // We expect lineMeta to have entries for positions 1, 2, 3.
    // BUT we want to ensure `diffPosition` is correct relative to the full patch.

    const headerMeta = numbered.lineMeta.get(1);
    expect(headerMeta?.content).toContain('@@');
    expect(headerMeta?.diffPosition).toBe(1); // Header is always 1st line of patch

    const line1Meta = numbered.lineMeta.get(2); // 'line1'
    expect(line1Meta?.content).toContain('line1');
    expect(line1Meta?.diffPosition).toBe(2);

    const line2Meta = numbered.lineMeta.get(3); // 'line2'
    expect(line2Meta?.content).toContain('line2');
    expect(line2Meta?.diffPosition).toBe(3);

    // Manually construct a DiffFile to ensure we have multiple hunks
    // without relying on parse-diff's strict parsing of string patches.
    const multiFile = {
      path: 'src/multi.ts',
      hunks: [
        {
          header: '@@ -1,2 +1,2 @@',
          lines: [
            { content: '+h1_line1', type: 'add' as const, newNumber: 1 },
            { content: '+h1_line2', type: 'add' as const, newNumber: 2 },
          ],
        },
        {
          header: '@@ -10,2 +10,2 @@',
          lines: [
            { content: '+h2_line1', type: 'add' as const, newNumber: 10 },
            { content: '+h2_line2', type: 'add' as const, newNumber: 11 },
          ],
        },
      ],
    };

    const multiNumbered = buildNumberedPatch(multiFile, {
      includePatterns: [],
      excludePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: 1, // TRUNCATE each hunk to 1 line
    });

    // Structure of Prompt (lines):
    // 1. Hunk 1 Header
    // 2. h1_line1
    // 3. Hunk 2 Header
    // 4. h2_line1

    expect(multiNumbered.lines.length).toBe(4);

    // Hunk 1 Header
    // Real Diff: Line 1 (Header 1)
    // Virtual: Line 1
    expect(multiNumbered.lineMeta.get(1)?.diffPosition).toBe(1);

    // h1_line1
    // Real Diff: Line 2 (Content 1)
    // Virtual: Line 2
    expect(multiNumbered.lineMeta.get(2)?.diffPosition).toBe(2);

    // SKIPPED: h1_line2 (Real Diff Line 3)

    // Hunk 2 Header
    // Real Diff: Line 4 (Because line 3 was skipped)
    // Virtual: Line 3
    expect(multiNumbered.lineMeta.get(3)?.diffPosition).toBe(4);

    // h2_line1
    // Real Diff: Line 5 (Content 1 of Hunk 2)
    // Virtual: Line 4
    expect(multiNumbered.lineMeta.get(4)?.diffPosition).toBe(5);
  });

  test('builds a global diff snippet with a max line cap', () => {
    const diff = `diff --git a/src/foo.ts b/src/foo.ts
index 1111111..2222222 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,1 +1,2 @@
-const a = 1;
+const a = 2;
+const b = 3;
`;

    const files = parseUnifiedDiff(diff);
    const snippet = buildGlobalDiff(
      files,
      {
        includePatterns: [],
        excludePatterns: [],
        maxFiles: 50,
        maxHunksPerFile: 20,
        maxLinesPerHunk: 500,
      },
      3,
    );

    const lines = snippet.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('File: src/foo.ts');
  });
});
