import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InstagramScraperService } from './instagram-scraper.service';
import { ScrapeRequestDto } from '@common/dto/scrape-request.dto';
import { ScrapeResponseDto } from '@common/dto/scrape-response.dto';
import { ConfigService } from '@nestjs/config';

@ApiTags('instagram-post-scraper')
@Controller('instagram-post-scraper')
export class ScraperController {
  private queueEvents: QueueEvents;

  constructor(
    private readonly scraperService: InstagramScraperService,
    @InjectQueue('scraper') private readonly scraperQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.queueEvents = new QueueEvents('scraper', {
      connection: {
        url: this.configService.get('REDIS_URL', 'redis://localhost:6379'),
      },
    });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scrape Instagram posts from one or multiple profiles',
    description:
      'Extracts posts from Instagram profiles using GraphQL interception with automated account rotation.\n\n' +
      '**Single Profile Mode**: Provide `username` field for scraping a single profile.\n\n' +
      '**Batch Mode**: Provide `usernames` array (max 5) for batch scraping. In batch mode, a single bot processes all profiles sequentially before switching to another bot, simulating human behavior.\n\n' +
      'Returns structured post data ready for consumption. (Processed via Redis Queue)',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully scraped Instagram profile(s)',
    type: ScrapeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters (must provide either username or usernames)',
  })
  @ApiResponse({
    status: 503,
    description: 'No Instagram accounts configured or service unavailable',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal scraping error',
  })
  async scrapeInstagramPosts(
    @Body() scrapeRequest: ScrapeRequestDto,
  ): Promise<ScrapeResponseDto> {
    // Validate that either username or usernames is provided (but not both)
    const hasSingleUsername = !!scrapeRequest.username;
    const hasMultipleUsernames = !!scrapeRequest.usernames && scrapeRequest.usernames.length > 0;

    if (!hasSingleUsername && !hasMultipleUsernames) {
      throw new BadRequestException('Either "username" or "usernames" must be provided');
    }

    if (hasSingleUsername && hasMultipleUsernames) {
      throw new BadRequestException('Provide either "username" OR "usernames", not both');
    }

    // Batch mode: multiple usernames
    if (hasMultipleUsernames) {
      // NOTE: For batch mode ensuring "single bot processes all" works best directly calling service
      // OR we queue a "batch-job". 
      // Current plan: Delegate completely to service via Processor if possible, but processor is single-job driven.
      // If we blindly queue M jobs, we lose the "single bot" affinity unless we group them.
      // 
      // SIMPLEST PATH: We queue ONE job called 'scrape-batch' if we want to keep logic, 
      // BUT our processor only handles 'scrape-profile'.
      // 
      // Let's implement 'scrape-batch' support in processor OR iterate here.
      // Iterating here breaks the "response aggregation" pattern easily unless we wait for all.
      // 
      // DECISION: To keep it robust without rewriting everything, we will queue the BATCH as a single unit if possible,
      // OR queue individually.
      // However, the user wants DYNAMIC concurrency. Queueing individually allows BullMQ to distribute better.
      // BUT the original requirement "In batch mode, a single bot processes all profiles sequentially" suggests session affinity.
      
      // FALLBACK for Batch: Keep it direct service call OR implement 'scrape-batch' job.
      // Given time: Direct call for batch might block HTTP thread but respects "single bot" logic.
      // BETTER: Queue individual "scrape-profile" jobs and aggregate. 
      // BUT that breaks "single bot processes all".
      // 
      // Let's stick to Direct Service call for BATCH for now (as it's complex logic) 
      // OR wrap it in a 'scrape-batch' job.
      // I'll wrap it in a 'scrape-batch' job to ensure it respects the queue limits (at least 1 slot).
      
      // Wait, ScraperServices.scrapeProfiles handles concurrency internally too.
      // Let's continue using the service directly for batch to avoid breaking complex logic,
      // BUT for single profile (90% use case) use the Queue.
      
      const batchResult = await this.scraperService.scrapeProfiles(
        scrapeRequest.usernames!,
        scrapeRequest.maxPosts,
        scrapeRequest.createdAt,
        scrapeRequest.createdAtMap,
      );

      return {
        success: batchResult.success,
        totalProfiles: batchResult.results.length,
        successfulProfiles: batchResult.results.filter(r => r.success).length,
        failedProfiles: batchResult.results.filter(r => !r.success).length,
        results: batchResult.results.map((result) => ({
          success: result.success,
          username: result.username,
          postsCount: result.posts.length,
          posts: result.posts.map((post) => ({
            id: post.id,
            shortcode: post.shortcode,
            text: post.text,
            createdAt: post.createdAt,
            type: post.type,
            username: post.username,
            media: post.media,
            likes: post.likes,
            comments: post.comments,
            permalink: post.permalink,
            originalData: post.originalData,
          })),
          scrapedWith: result.scrapedWith,
          scrapedAt: result.scrapedAt,
          error: result.error,
        })),
      };
    }

    // Single mode: single username -> QUEUE IT
    const job = await this.scraperQueue.add('scrape-profile', {
      username: scrapeRequest.username,
      maxPosts: scrapeRequest.maxPosts,
      createdAt: scrapeRequest.createdAt,
    });

    try {
      // Wait for the job to complete and get the result
      // This keeps the API synchronous for the client
      const result = await job.waitUntilFinished(this.queueEvents);
      
      return {
        success: result.success,
        totalProfiles: 1,
        successfulProfiles: result.success ? 1 : 0,
        failedProfiles: result.success ? 0 : 1,
        results: [{
          success: result.success,
          username: result.username,
          postsCount: result.posts.length,
          posts: result.posts.map((post: any) => ({
            id: post.id,
            shortcode: post.shortcode,
            text: post.text,
            createdAt: post.createdAt,
            type: post.type,
            username: post.username,
            media: post.media,
            likes: post.likes,
            comments: post.comments,
            permalink: post.permalink,
            originalData: post.originalData,
          })),
          scrapedWith: result.scrapedWith,
          scrapedAt: result.scrapedAt,
          error: result.error,
        }],
      };
    } catch (error) {
       throw new BadRequestException(error.message || 'Scraping failed via queue');
    }
  }
}
