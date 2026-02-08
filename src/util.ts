import pLimitLib from 'p-limit';

export function pLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const limitFn = pLimitLib(limit);
  return Promise.all(tasks.map((task) => limitFn(task)));
}
