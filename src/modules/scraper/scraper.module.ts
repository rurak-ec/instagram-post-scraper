import { Module } from '@nestjs/common';
import { ScraperController } from './scraper.controller';
import { InstagramScraperService } from './instagram-scraper.service';
import { BrowserService } from './browser.service';
import { AccountsModule } from '../accounts/accounts.module';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScraperProcessor } from './scraper.processor';

@Module({
  imports: [
    AccountsModule,
    BullModule.registerQueueAsync({
      name: 'scraper',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // Calculate concurrency based on number of accounts
        const accounts = configService.get('igAccounts', []);
        const concurrency = accounts.length > 0 ? accounts.length : 1;
        return {
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: 1000,
            attempts: 1, // Let the service handle internal retries or manual re-queue
          },
          // Worker concurrency (handled by @Processor options or here?)
          // BullMQ Module handles processor registration separately.
          // This configures the QUEUE client.
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [ScraperController],
  providers: [InstagramScraperService, BrowserService, ScraperProcessor],
  exports: [InstagramScraperService, BrowserService, BullModule],
})
export class ScraperModule {}
