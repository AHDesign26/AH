/**
 * Reject rather than hang, so one stalled channel cannot hold a request open.
 *
 * Not needed for plain fetch, which takes an AbortSignal; this is for the SMTP
 * client, which talks over a raw socket and has no cancellation of its own.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}
