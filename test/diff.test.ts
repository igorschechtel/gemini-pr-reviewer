import { describe, expect, test } from "bun:test";
import { parseUnifiedDiff, buildNumberedPatch, adjustToReviewablePosition } from "../src/diff";

describe("diff parsing and numbering", () => {
  test("builds numbered patch and adjusts to reviewable lines", () => {
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

    const numbered = buildNumberedPatch(files[0], {
      includePatterns: [],
      excludePatterns: [],
      maxFiles: 50,
      maxHunksPerFile: 20,
      maxLinesPerHunk: 500
    });

    expect(numbered.lines[0]).toContain("@@");

    const metaValues = Array.from(numbered.lineMeta.values());
    const deletedLine = metaValues.find((m) => m.content.startsWith("-const a"));
    const addedLine = metaValues.find((m) => m.content.startsWith("+const a"));

    expect(deletedLine).toBeDefined();
    expect(addedLine).toBeDefined();

    const adjusted = adjustToReviewablePosition(
      deletedLine!.position,
      numbered.lineMeta,
      numbered.hunkPositions
    );

    expect(adjusted).toBe(addedLine!.position);
  });
});
