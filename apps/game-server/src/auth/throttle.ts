import { AuthError } from "./types.js";

interface AttemptState {
  failures: number;
  blockedUntil: number;
}

export class LoginThrottle {
  readonly #attempts = new Map<string, AttemptState>();

  assertAllowed(key: string, now: Date): void {
    const attempt = this.#attempts.get(key);
    if (attempt && attempt.blockedUntil > now.getTime()) {
      throw new AuthError("RATE_LIMITED", 429, "auth.tooManyAttempts", true);
    }
  }

  recordFailure(key: string, now: Date): void {
    const previous = this.#attempts.get(key);
    const failures = (previous?.failures ?? 0) + 1;
    const delaySeconds = failures < 5 ? 0 : Math.min(15 * 60, 30 * 2 ** Math.min(failures - 5, 5));
    this.#attempts.set(key, {
      failures,
      blockedUntil: now.getTime() + delaySeconds * 1000,
    });
  }

  recordSuccess(key: string): void {
    this.#attempts.delete(key);
  }
}
