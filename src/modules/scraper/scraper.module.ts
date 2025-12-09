import { Module } from '@nestjs/common';
import { ScraperController } from './scraper.controller';
import { InstagramScraperService } from './instagram-scraper.service';
import { BrowserService } from './browser.service';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AccountsModule],
  controllers: [ScraperController],
  providers: [InstagramScraperService, BrowserService],
  exports: [InstagramScraperService, BrowserService],
})
export class ScraperModule {}
