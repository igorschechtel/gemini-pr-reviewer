import type { BenchmarkCase } from '../types.js';

export const sqlInjection: BenchmarkCase = {
  id: 'sql-injection',
  name: 'SQL Injection via String Interpolation',
  reviewMode: 'standard',
  prTitle: 'Add user search endpoint',
  prBody: 'Adds a new endpoint to search users by name from the database.',
  diff: `diff --git a/src/db.ts b/src/db.ts
new file mode 100644
index 0000000..abcdef1
--- /dev/null
+++ b/src/db.ts
@@ -0,0 +1,25 @@
+import { Pool } from 'pg';
+
+const pool = new Pool({
+  connectionString: process.env.DATABASE_URL,
+});
+
+export interface User {
+  id: number;
+  name: string;
+  email: string;
+}
+
+export async function findUsersByName(name: string): Promise<User[]> {
+  const query = \`SELECT id, name, email FROM users WHERE name LIKE '%\${name}%'\`;
+  const result = await pool.query(query);
+  return result.rows as User[];
+}
+
+export async function getUserById(id: number): Promise<User | null> {
+  const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [id]);
+  return (result.rows[0] as User) ?? null;
+}
+
+export async function getActiveUserCount(): Promise<number> {
+  const result = await pool.query('SELECT COUNT(*) FROM users WHERE active = true');
+  return parseInt(result.rows[0].count, 10);
+}
`,
  expectedFindings: [
    {
      filePath: 'src/db.ts',
      line: 14,
      keywords: ['sql', 'injection', 'interpolation', 'parameterized', 'sanitize'],
      priority: 'high',
      description: 'SQL injection via string interpolation in findUsersByName',
    },
  ],
};
