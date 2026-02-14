import type { BenchmarkCase } from '../types.js';

export const cleanCode: BenchmarkCase = {
  id: 'clean-code',
  name: 'Clean Utility Functions (No Issues Expected)',
  reviewMode: 'standard',
  prTitle: 'Add string utility helpers',
  prBody: 'Adds well-tested utility functions for common string operations.',
  diff: `diff --git a/src/utils/strings.ts b/src/utils/strings.ts
new file mode 100644
index 0000000..abcdef4
--- /dev/null
+++ b/src/utils/strings.ts
@@ -0,0 +1,30 @@
+export function capitalize(str: string): string {
+  if (str.length === 0) return str;
+  return str.charAt(0).toUpperCase() + str.slice(1);
+}
+
+export function slugify(str: string): string {
+  return str
+    .toLowerCase()
+    .trim()
+    .replace(/[^a-z0-9\\s-]/g, '')
+    .replace(/[\\s_]+/g, '-')
+    .replace(/-+/g, '-');
+}
+
+export function truncate(str: string, maxLength: number, suffix = '...'): string {
+  if (maxLength < 0) throw new RangeError('maxLength must be non-negative');
+  if (str.length <= maxLength) return str;
+  const end = Math.max(0, maxLength - suffix.length);
+  return str.slice(0, end) + suffix;
+}
+
+export function countOccurrences(str: string, substring: string): number {
+  if (substring.length === 0) return 0;
+  let count = 0;
+  let pos = str.indexOf(substring);
+  while (pos !== -1) {
+    count++;
+    pos = str.indexOf(substring, pos + substring.length);
+  }
+  return count;
+}
`,
  expectedFindings: [],
  maxFalsePositives: 1,
};
