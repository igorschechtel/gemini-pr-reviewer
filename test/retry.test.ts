import { describe, expect, test } from 'bun:test';
import { isRetryableError, withRetry } from '../src/retry.js';

describe('isRetryableError', () => {
  test('retries on HTTP 429', () => {
    const error = Object.assign(new Error('Too Many Requests'), { status: 429 });
    expect(isRetryableError(error)).toBe(true);
  });

  test('retries on HTTP 500', () => {
    const error = Object.assign(new Error('Internal Server Error'), { status: 500 });
    expect(isRetryableError(error)).toBe(true);
  });

  test('retries on HTTP 502', () => {
    const error = Object.assign(new Error('Bad Gateway'), { status: 502 });
    expect(isRetryableError(error)).toBe(true);
  });

  test('retries on HTTP 503', () => {
    const error = Object.assign(new Error('Service Unavailable'), { status: 503 });
    expect(isRetryableError(error)).toBe(true);
  });

  test('retries on HTTP 504', () => {
    const error = Object.assign(new Error('Gateway Timeout'), { status: 504 });
    expect(isRetryableError(error)).toBe(true);
  });

  test('does not retry on HTTP 400', () => {
    const error = Object.assign(new Error('Bad Request'), { status: 400 });
    expect(isRetryableError(error)).toBe(false);
  });

  test('does not retry on HTTP 401', () => {
    const error = Object.assign(new Error('Unauthorized'), { status: 401 });
    expect(isRetryableError(error)).toBe(false);
  });

  test('does not retry on HTTP 403', () => {
    const error = Object.assign(new Error('Forbidden'), { status: 403 });
    expect(isRetryableError(error)).toBe(false);
  });

  test('does not retry on HTTP 404', () => {
    const error = Object.assign(new Error('Not Found'), { status: 404 });
    expect(isRetryableError(error)).toBe(false);
  });

  test('does not retry on HTTP 422', () => {
    const error = Object.assign(new Error('Unprocessable Entity'), { status: 422 });
    expect(isRetryableError(error)).toBe(false);
  });

  test('retries on network fetch failed error', () => {
    expect(isRetryableError(new TypeError('fetch failed'))).toBe(true);
  });

  test('retries on ECONNRESET', () => {
    expect(isRetryableError(new Error('read ECONNRESET'))).toBe(true);
  });

  test('retries on ETIMEDOUT', () => {
    expect(isRetryableError(new Error('connect ETIMEDOUT'))).toBe(true);
  });

  test('does not retry on generic errors', () => {
    expect(isRetryableError(new Error('Something went wrong'))).toBe(false);
  });

  test('does not retry on non-Error values', () => {
    expect(isRetryableError('string error')).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe('withRetry', () => {
  test('returns result on first attempt success', async () => {
    const result = await withRetry(() => Promise.resolve('ok'), 'test', {
      maxAttempts: 3,
      initialDelayMs: 1,
    });
    expect(result).toBe('ok');
  });

  test('retries then succeeds', async () => {
    let attempt = 0;
    const result = await withRetry(
      () => {
        attempt++;
        if (attempt < 3) {
          throw Object.assign(new Error('Service Unavailable'), { status: 503 });
        }
        return Promise.resolve('recovered');
      },
      'test',
      { maxAttempts: 4, initialDelayMs: 1 },
    );
    expect(result).toBe('recovered');
    expect(attempt).toBe(3);
  });

  test('throws immediately on non-retryable error', async () => {
    let attempt = 0;
    const fn = () => {
      attempt++;
      return Promise.reject(Object.assign(new Error('Not Found'), { status: 404 }));
    };

    await expect(withRetry(fn, 'test', { maxAttempts: 4, initialDelayMs: 1 })).rejects.toThrow(
      'Not Found',
    );
    expect(attempt).toBe(1);
  });

  test('throws after exhausting all attempts', async () => {
    let attempt = 0;
    const fn = () => {
      attempt++;
      return Promise.reject(Object.assign(new Error('Service Unavailable'), { status: 503 }));
    };

    await expect(withRetry(fn, 'test', { maxAttempts: 3, initialDelayMs: 1 })).rejects.toThrow(
      'Service Unavailable',
    );
    expect(attempt).toBe(3);
  });

  test('uses exponential backoff timing', async () => {
    let attempt = 0;
    const timestamps: number[] = [];

    const fn = () => {
      timestamps.push(Date.now());
      attempt++;
      if (attempt < 3) {
        throw Object.assign(new Error('Service Unavailable'), { status: 503 });
      }
      return Promise.resolve('ok');
    };

    await withRetry(fn, 'test', {
      maxAttempts: 4,
      initialDelayMs: 50,
      backoffFactor: 2,
    });

    expect(timestamps.length).toBe(3);
    const t0 = timestamps[0] ?? 0;
    const t1 = timestamps[1] ?? 0;
    const t2 = timestamps[2] ?? 0;
    // First retry delay should be ~50ms, second ~100ms
    const firstDelay = t1 - t0;
    const secondDelay = t2 - t1;
    // Allow generous margins for CI timing variance
    expect(firstDelay).toBeGreaterThanOrEqual(40);
    expect(secondDelay).toBeGreaterThanOrEqual(80);
    // Second delay should be roughly 2x the first (with jitter)
    expect(secondDelay).toBeGreaterThan(firstDelay * 1.3);
  });

  test('respects maxDelayMs cap', async () => {
    let attempt = 0;
    const timestamps: number[] = [];

    const fn = () => {
      timestamps.push(Date.now());
      attempt++;
      if (attempt < 4) {
        throw Object.assign(new Error('Service Unavailable'), { status: 503 });
      }
      return Promise.resolve('ok');
    };

    await withRetry(fn, 'test', {
      maxAttempts: 4,
      initialDelayMs: 50,
      backoffFactor: 100,
      maxDelayMs: 80,
    });

    // After attempt 1, delay would be 50*100=5000 but capped at 80
    const secondDelay = (timestamps[2] ?? 0) - (timestamps[1] ?? 0);
    expect(secondDelay).toBeLessThan(120); // 80ms + jitter + scheduling
  });
});
