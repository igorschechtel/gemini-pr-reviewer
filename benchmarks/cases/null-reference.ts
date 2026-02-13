import type { BenchmarkCase } from '../types.js';

export const nullReference: BenchmarkCase = {
  id: 'null-reference',
  name: 'Null Dereference on Optional Return',
  reviewMode: 'standard',
  prTitle: 'Add order summary feature',
  prBody: 'Shows order details with customer info for the dashboard.',
  diff: `diff --git a/src/orders.ts b/src/orders.ts
new file mode 100644
index 0000000..abcdef2
--- /dev/null
+++ b/src/orders.ts
@@ -0,0 +1,30 @@
+import { db } from './database';
+
+interface Order {
+  id: number;
+  customerId: number;
+  total: number;
+}
+
+interface Customer {
+  id: number;
+  name: string;
+  email: string;
+}
+
+function findCustomerById(id: number): Customer | undefined {
+  return db.customers.find((c) => c.id === id);
+}
+
+function findOrderById(id: number): Order | undefined {
+  return db.orders.find((o) => o.id === id);
+}
+
+export function getOrderSummary(orderId: number): string {
+  const order = findOrderById(orderId);
+  const customer = findCustomerById(order.customerId);
+  return \`Order #\${order.id}: \${customer.name} — $\${order.total.toFixed(2)}\`;
+}
+
+export function getOrderTotal(orderId: number): number {
+  const order = findOrderById(orderId);
+  return order?.total ?? 0;
+}
`,
  expectedFindings: [
    {
      filePath: 'src/orders.ts',
      line: 25,
      keywords: ['null', 'undefined', 'optional', 'dereference', 'check', 'guard'],
      priority: 'high',
      description:
        'Accessing .customerId on possibly-undefined order without null check in getOrderSummary',
    },
  ],
};
