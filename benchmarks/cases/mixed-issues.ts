import type { BenchmarkCase } from '../types.js';

export const mixedIssues: BenchmarkCase = {
  id: 'mixed-issues',
  name: 'Multiple Security Issues',
  reviewMode: 'security',
  prTitle: 'Add admin dashboard backend',
  prBody: 'Backend routes for the admin dashboard with user management and system commands.',
  diff: `diff --git a/src/admin.ts b/src/admin.ts
new file mode 100644
index 0000000..abcdef5
--- /dev/null
+++ b/src/admin.ts
@@ -0,0 +1,55 @@
+import { exec } from 'node:child_process';
+import { Pool } from 'pg';
+
+const pool = new Pool({ connectionString: process.env.DATABASE_URL });
+
+const ADMIN_PASSWORD = 'super_secret_admin_123';
+
+export async function authenticateAdmin(password: string): Promise<boolean> {
+  return password === ADMIN_PASSWORD;
+}
+
+export async function searchUsers(query: string): Promise<unknown[]> {
+  const sql = \`SELECT * FROM users WHERE name ILIKE '%\${query}%' OR email ILIKE '%\${query}%'\`;
+  const result = await pool.query(sql);
+  return result.rows;
+}
+
+export async function runDiagnostic(command: string): Promise<string> {
+  return new Promise((resolve, reject) => {
+    exec(command, (error, stdout, stderr) => {
+      if (error) {
+        reject(new Error(stderr || error.message));
+        return;
+      }
+      resolve(stdout);
+    });
+  });
+}
+
+export function buildUserProfile(user: { name: string; bio: string }): string {
+  return \`
+    <div class="profile">
+      <h2>\${user.name}</h2>
+      <p>\${user.bio}</p>
+    </div>
+  \`;
+}
+
+export async function getUserStats(userId: number): Promise<{ posts: number; comments: number }> {
+  const posts = await pool.query('SELECT COUNT(*) FROM posts WHERE user_id = $1', [userId]);
+  const comments = await pool.query('SELECT COUNT(*) FROM comments WHERE user_id = $1', [userId]);
+  return {
+    posts: parseInt(posts.rows[0].count, 10),
+    comments: parseInt(comments.rows[0].count, 10),
+  };
+}
+
+export async function deleteUser(userId: number): Promise<void> {
+  await pool.query('DELETE FROM comments WHERE user_id = $1', [userId]);
+  await pool.query('DELETE FROM posts WHERE user_id = $1', [userId]);
+  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
+}
+
+export function formatAdminPage(title: string, content: string): string {
+  return \`<html><head><title>\${title}</title></head><body>\${content}</body></html>\`;
+}
`,
  expectedFindings: [
    {
      filePath: 'src/admin.ts',
      line: 13,
      keywords: ['sql', 'injection', 'interpolation', 'parameterized'],
      priority: 'high',
      description: 'SQL injection via string interpolation in searchUsers',
    },
    {
      filePath: 'src/admin.ts',
      line: 20,
      keywords: ['command', 'injection', 'exec', 'shell', 'arbitrary'],
      priority: 'high',
      description: 'Command injection via unsanitized exec() in runDiagnostic',
    },
    {
      filePath: 'src/admin.ts',
      line: 6,
      keywords: ['password', 'hardcoded', 'plaintext', 'secret', 'credential'],
      priority: 'high',
      description: 'Hardcoded admin password in source code',
    },
    {
      filePath: 'src/admin.ts',
      line: 32,
      keywords: ['xss', 'escape', 'sanitize', 'html', 'injection'],
      priority: 'medium',
      description: 'XSS vulnerability via unsanitized HTML interpolation in buildUserProfile',
    },
  ],
};
