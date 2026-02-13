import type { BenchmarkCase } from '../types.js';

export const nPlusOne: BenchmarkCase = {
  id: 'n-plus-one',
  name: 'N+1 Query in Loop',
  reviewMode: 'standard',
  prTitle: 'Add user activity report',
  prBody: 'Generates a report of recent user activity including their latest posts.',
  diff: `diff --git a/src/report.ts b/src/report.ts
new file mode 100644
index 0000000..abcdef3
--- /dev/null
+++ b/src/report.ts
@@ -0,0 +1,35 @@
+import { db } from './database';
+
+interface User {
+  id: number;
+  name: string;
+}
+
+interface Post {
+  id: number;
+  userId: number;
+  title: string;
+  createdAt: Date;
+}
+
+interface ActivityEntry {
+  userName: string;
+  latestPost: string;
+  postCount: number;
+}
+
+export async function generateActivityReport(): Promise<ActivityEntry[]> {
+  const users: User[] = await db.query('SELECT id, name FROM users WHERE active = true');
+  const report: ActivityEntry[] = [];
+
+  for (const user of users) {
+    const posts: Post[] = await db.query(
+      'SELECT id, title, created_at FROM posts WHERE user_id = $1 ORDER BY created_at DESC',
+      [user.id],
+    );
+    report.push({
+      userName: user.name,
+      latestPost: posts[0]?.title ?? 'No posts',
+      postCount: posts.length,
+    });
+  }
+
+  return report;
+}
`,
  expectedFindings: [
    {
      filePath: 'src/report.ts',
      line: 26,
      keywords: ['n+1', 'loop', 'query', 'batch', 'performance', 'join'],
      priority: 'high',
      description: 'Database query inside for loop causes N+1 query problem',
    },
  ],
};
