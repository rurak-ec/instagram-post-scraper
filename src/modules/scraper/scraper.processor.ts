import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InstagramScraperService } from './instagram-scraper.service';
import { CleanedInstagramPost } from './interfaces/instagram-graphql.interface';
import { ConfigService } from '@nestjs/config';

@Processor('scraper')
export class ScraperProcessor extends WorkerHost {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    private readonly scraperService: InstagramScraperService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`⚙️ Processing job ${job.id} of type ${job.name} with data: ${JSON.stringify(job.data)}`);

    switch (job.name) {
      case 'scrape-profile':
        return this.handleScrapeProfile(job);
      default:
        this.logger.warn(`⚠️ Unknown job name: ${job.name}`);
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async handleScrapeProfile(job: Job): Promise<{
    success: boolean;
    username: string;
    posts: CleanedInstagramPost[];
    scrapedWith: string;
    scrapedAt: number;
  }> {
    const { username, maxPosts, createdAt } = job.data;
    
    // The scraperService expects these parameters. 
    // Note: scrapeProfile internally manages retries and rotation.
    // The queue concurrency (controlled in module) ensures we don't call this more often than allowed.
    const result = await this.scraperService.scrapeProfile(username, maxPosts, createdAt);
    
    return result;
  }
}
