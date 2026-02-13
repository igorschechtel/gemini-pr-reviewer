export type RetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  maxDelayMs?: number;
};

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 4,
  initialDelayMs: 1000,
  backoffFactor: 2,
  maxDelayMs: 30_000,
};

export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors from fetch
    const msg = error.message.toLowerCase();
    if (
      msg.includes('fetch failed') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('network') ||
      msg.includes('socket hang up')
    ) {
      return true;
    }

    // HTTP status codes
    const status = (error as Error & { status?: number }).status;
    if (typeof status === 'number') {
      return status === 429 || status >= 500;
    }
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryableError(error) || attempt === opts.maxAttempts) {
        throw error;
      }

      const baseDelay = Math.min(
        opts.initialDelayMs * opts.backoffFactor ** (attempt - 1),
        opts.maxDelayMs,
      );
      // Add 0-25% jitter
      const jitter = baseDelay * Math.random() * 0.25;
      const delay = baseDelay + jitter;

      const status = (error as Error & { status?: number }).status;
      const statusInfo = status ? ` (HTTP ${status})` : '';
      console.warn(
        `[retry] ${label}: attempt ${attempt}/${opts.maxAttempts} failed${statusInfo}, retrying in ${Math.round(delay)}ms...`,
      );

      await sleep(delay);
    }
  }
}
