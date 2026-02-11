import { describe, expect, test } from 'bun:test';
import {
  buildGlobalDiff,
  buildNumberedPatch,
  parseUnifiedDiff,
  resolveCommentPosition,
  resolveEndPosition,
} from '../src/diff.ts';

describe('diff parsing and numbering', () => {
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

  test('propagates fileLineNumber from DiffLine.newNumber', () => {
    const file = {
      path: 'src/test.ts',
      hunks: [
        {
          header: '@@ -1,2 +1,3 @@',
          lines: [
            { content: ' context', type: 'normal' as const, newNumber: 1, oldNumber: 1 },
            { content: '+added', type: 'add' as const, newNumber: 2 },
            { content: '-removed', type: 'del' as const, oldNumber: 2 },
          ],
        },
      ],
    };

    const numbered = buildNumberedPatch(file, {
      includePatterns: [],
      excludePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: 500,
    });

    // Position 1 = header (no fileLineNumber)
    expect(numbered.lineMeta.get(1)?.fileLineNumber).toBeUndefined();

    // Position 2 = context line, newNumber=1
    expect(numbered.lineMeta.get(2)?.fileLineNumber).toBe(1);

    // Position 3 = added line, newNumber=2
    expect(numbered.lineMeta.get(3)?.fileLineNumber).toBe(2);

    // Position 4 = deleted line, no newNumber
    expect(numbered.lineMeta.get(4)?.fileLineNumber).toBeUndefined();
  });

  test('resolveCommentPosition walks forward to reviewable line', () => {
    const file = {
      path: 'src/test.ts',
      hunks: [
        {
          header: '@@ -1,3 +1,3 @@',
          lines: [
            { content: '-old', type: 'del' as const, oldNumber: 1 },
            { content: '+new1', type: 'add' as const, newNumber: 1 },
            { content: '+new2', type: 'add' as const, newNumber: 2 },
          ],
        },
      ],
    };

    const numbered = buildNumberedPatch(file, {
      includePatterns: [],
      excludePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: 500,
    });

    // Position 2 is the deleted line (not reviewable)
    const deletedMeta = numbered.lineMeta.get(2);
    expect(deletedMeta?.reviewable).toBe(false);

    // Should walk forward to the next reviewable line (position 3, newNumber=1)
    const resolved = resolveCommentPosition(2, numbered.lineMeta, numbered.hunkPositions);
    expect(resolved).not.toBeNull();
    expect(resolved?.fileLineNumber).toBe(1);

    // Directly reviewable line
    const direct = resolveCommentPosition(3, numbered.lineMeta, numbered.hunkPositions);
    expect(direct).not.toBeNull();
    expect(direct?.fileLineNumber).toBe(1);
  });

  test('resolveCommentPosition returns null for unknown line', () => {
    const file = {
      path: 'src/test.ts',
      hunks: [
        {
          header: '@@ -1,1 +1,1 @@',
          lines: [{ content: '+line', type: 'add' as const, newNumber: 1 }],
        },
      ],
    };

    const numbered = buildNumberedPatch(file, {
      includePatterns: [],
      excludePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: 500,
    });

    expect(resolveCommentPosition(999, numbered.lineMeta, numbered.hunkPositions)).toBeNull();
  });

  test('resolveEndPosition walks backward to reviewable line', () => {
    const file = {
      path: 'src/test.ts',
      hunks: [
        {
          header: '@@ -1,3 +1,3 @@',
          lines: [
            { content: '+new1', type: 'add' as const, newNumber: 1 },
            { content: '+new2', type: 'add' as const, newNumber: 2 },
            { content: '-old', type: 'del' as const, oldNumber: 3 },
          ],
        },
      ],
    };

    const numbered = buildNumberedPatch(file, {
      includePatterns: [],
      excludePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: 500,
    });

    // Position 4 is the deleted line (not reviewable) — should walk backward to position 3
    const resolved = resolveEndPosition(4, numbered.lineMeta, numbered.hunkPositions);
    expect(resolved).not.toBeNull();
    expect(resolved?.fileLineNumber).toBe(2);

    // Directly reviewable line
    const direct = resolveEndPosition(3, numbered.lineMeta, numbered.hunkPositions);
    expect(direct).not.toBeNull();
    expect(direct?.fileLineNumber).toBe(2);
  });

  test('resolveEndPosition returns null for unknown line', () => {
    const file = {
      path: 'src/test.ts',
      hunks: [
        {
          header: '@@ -1,1 +1,1 @@',
          lines: [{ content: '+line', type: 'add' as const, newNumber: 1 }],
        },
      ],
    };

    const numbered = buildNumberedPatch(file, {
      includePatterns: [],
      excludePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: 500,
    });

    expect(resolveEndPosition(999, numbered.lineMeta, numbered.hunkPositions)).toBeNull();
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
