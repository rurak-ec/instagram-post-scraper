import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService {
  constructor(private configService: ConfigService) {}

  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'instagram-scraper-api',
      version: '1.0.0',
    };
  }

  detailedCheck() {
    const igAccounts = this.configService.get('igAccounts', []);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'instagram-scraper-api',
      version: '1.0.0',
      environment: {
        nodeEnv: this.configService.get('nodeEnv'),
        headless: this.configService.get('headless'),
        verboseLogs: this.configService.get('verboseLogs'),
      },
      accounts: {
        configured: igAccounts.length,
        usernames: igAccounts.map((acc: any) => acc.username),
      },
      config: {
        maxPostsPerRequest: this.configService.get('maxPostsPerRequest'),
        scraperTimeoutMs: this.configService.get('scraperTimeoutMs'),
        scraperConcurrency: this.configService.get('scraperConcurrency'),
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}
