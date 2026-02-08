import { describe, expect, it } from 'bun:test';
import { pLimit } from '../src/util.js';

describe('Concurrency Limiter (pLimit)', () => {
  it('should run tasks in sequence if limit is 1', async () => {
    const results: number[] = [];
    const tasks = [
      async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(1);
        return 1;
      },
      async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(2);
        return 2;
      },
      async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(3);
        return 3;
      },
    ];

    const output = await pLimit(tasks, 1);
    expect(output).toEqual([1, 2, 3]);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should run tasks in parallel if limit is high', async () => {
    const start = Date.now();
    const tasks = [
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 1;
      },
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 2;
      },
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 3;
      },
    ];

    const output = await pLimit(tasks, 3);
    const duration = Date.now() - start;

    expect(output).toEqual([1, 2, 3]);
    // Should take roughly 50ms, definitely less than 150ms
    expect(duration).toBeLessThan(100);
  });

  it('should respect the concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;

    const task = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return true;
    };

    const tasks = Array(10).fill(task);
    await pLimit(tasks, 3);

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('should handle empty task list', async () => {
    const output = await pLimit([], 5);
    expect(output).toEqual([]);
  });

  it('should return results in order even if completed out of order', async () => {
    const tasks = [
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 1;
      },
      async () => {
        await new Promise((r) => setTimeout(r, 10)); // finishes first
        return 2;
      },
    ];

    const output = await pLimit(tasks, 2);
    expect(output).toEqual([1, 2]);
  });
});
