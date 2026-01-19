import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * In-memory concurrency limiter.
 * Returns 429 Too Many Requests when max concurrent requests reached.
 */
@Injectable()
export class ConcurrencyService {
  private readonly logger = new Logger(ConcurrencyService.name);
  private activeRequests = 0;
  private readonly maxConcurrent: number;

  constructor(private configService: ConfigService) {
    // Max concurrent = number of IG accounts configured
    const accounts = this.configService.get('igAccounts', []);
    this.maxConcurrent = accounts.length > 0 ? accounts.length : 1;
    this.logger.log(`Concurrency limit set to ${this.maxConcurrent} (based on IG accounts)`);
  }

  /**
   * Try to acquire a concurrency slot.
   * Throws 429 if limit reached.
   */
  acquire(): void {
    if (this.activeRequests >= this.maxConcurrent) {
      this.logger.warn(`Concurrency limit reached (${this.activeRequests}/${this.maxConcurrent})`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many concurrent requests. Please try again later.',
          activeRequests: this.activeRequests,
          maxConcurrent: this.maxConcurrent,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.activeRequests++;
    this.logger.debug(`Acquired slot (${this.activeRequests}/${this.maxConcurrent})`);
  }

  /**
   * Release a concurrency slot.
   */
  release(): void {
    if (this.activeRequests > 0) {
      this.activeRequests--;
      this.logger.debug(`Released slot (${this.activeRequests}/${this.maxConcurrent})`);
    }
  }

  /**
   * Get current status.
   */
  getStatus(): { active: number; max: number } {
    return { active: this.activeRequests, max: this.maxConcurrent };
  }
}
