export async function pLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  const active: Promise<void>[] = [];

  const runTask = async (i: number) => {
    const task = tasks[i];
    if (task) {
      results[i] = await task();
    }
  };

  for (let i = 0; i < tasks.length; i++) {
    const p = runTask(i).finally(() => {
      // Remove self from active
      const idx = active.indexOf(p);
      if (idx !== -1) active.splice(idx, 1);
    });
    active.push(p);
    if (active.length >= limit) {
      await Promise.race(active);
    }
  }
  await Promise.all(active);
  return results;
}
