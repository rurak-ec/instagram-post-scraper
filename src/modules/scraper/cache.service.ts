import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry {
  result: any;
  timestamp: number;
}

/**
 * In-memory cache for scrape results.
 * Caches results for 10 minutes.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Get cached result for username if not expired.
   */
  get(username: string): any | null {
    const entry = this.cache.get(username.toLowerCase());
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.TTL_MS) {
      this.cache.delete(username.toLowerCase());
      this.logger.debug(`Cache expired for @${username}`);
      return null;
    }

    this.logger.log(`Cache hit for @${username} (age: ${Math.round(age / 1000)}s)`);
    return entry.result;
  }

  /**
   * Store result in cache.
   */
  set(username: string, result: any): void {
    this.cache.set(username.toLowerCase(), {
      result,
      timestamp: Date.now(),
    });
    this.logger.debug(`Cached result for @${username}`);
  }

  /**
   * Check if username has valid cache.
   */
  has(username: string): boolean {
    return this.get(username) !== null;
  }

  /**
   * Clear all cache.
   */
  clear(): void {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  /**
   * Get cache stats.
   */
  getStats(): { size: number; ttlMinutes: number } {
    return { size: this.cache.size, ttlMinutes: this.TTL_MS / 60000 };
  }
}
