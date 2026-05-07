import axios from 'axios';
import env from './env';

/**
 * AI Service HTTP Client
 * Configured with timeout to ensure AI never blocks the billing flow.
 * All calls should be wrapped in try/catch — AI is optional.
 */
const aiClient = axios.create({
  baseURL: env.ai.baseUrl,
  timeout: env.ai.timeout,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Simple circuit breaker to avoid hammering a down AI service.
 * After 3 consecutive failures, stops calling for 60 seconds.
 */
class AICircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold = 3;
  private readonly cooldown = 60000; // 60 seconds

  isOpen(): boolean {
    if (this.failures >= this.threshold) {
      if (Date.now() - this.lastFailure < this.cooldown) {
        return true;  // Circuit is open — don't call AI
      }
      // Cooldown expired — reset and allow retry
      this.failures = 0;
    }
    return false;
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
  }

  recordSuccess(): void {
    this.failures = 0;
  }
}

export const circuitBreaker = new AICircuitBreaker();
export default aiClient;
