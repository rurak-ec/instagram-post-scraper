import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InstagramScraperService } from './instagram-scraper.service';
import { ConcurrencyService } from './concurrency.service';
import { CacheService } from './cache.service';
import { ScrapeRequestDto } from '@common/dto/scrape-request.dto';
import { ScrapeResponseDto } from '@common/dto/scrape-response.dto';

@ApiTags('instagram-post-scraper')
@Controller('instagram-post-scraper')
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(
    private readonly scraperService: InstagramScraperService,
    private readonly concurrencyService: ConcurrencyService,
    private readonly cacheService: CacheService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scrape Instagram posts from one or multiple profiles',
    description:
      'Extracts posts from Instagram profiles using GraphQL interception with automated account rotation.\n\n' +
      '**Single Profile Mode**: Provide `username` field for scraping a single profile.\n\n' +
      '**Batch Mode**: Provide `usernames` array (max 5) for batch scraping.\n\n' +
      'Results are cached for 10 minutes. Returns HTTP 429 if too many concurrent requests.',
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
    status: 429,
    description: 'Too many concurrent requests',
  })
  @ApiResponse({
    status: 503,
    description: 'No Instagram accounts configured or service unavailable',
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

    // Normalize to array (unify single/batch logic)
    const usernames = hasMultipleUsernames 
      ? scrapeRequest.usernames! 
      : [scrapeRequest.username!];

    // Check cache for all usernames
    const cachedResults: any[] = [];
    const usernamesToScrape: string[] = [];

    for (const username of usernames) {
      const cached = this.cacheService.get(username);
      if (cached) {
        cachedResults.push(cached);
      } else {
        usernamesToScrape.push(username);
      }
    }

    // If all are cached, return immediately
    if (usernamesToScrape.length === 0) {
      this.logger.log(`All ${usernames.length} profiles served from cache`);
      return this.buildResponse(cachedResults);
    }

    // Acquire concurrency slot (throws 429 if limit reached)
    this.concurrencyService.acquire();

    try {
      // Scrape only non-cached usernames
      const scrapeResult = await this.scraperService.scrapeProfiles(
        usernamesToScrape,
        scrapeRequest.maxPosts,
        scrapeRequest.createdAt,
        scrapeRequest.createdAtMap,
      );

      // Cache successful results
      for (const result of scrapeResult.results) {
        if (result.success) {
          this.cacheService.set(result.username, result);
        }
      }

      // Combine cached + fresh results
      const allResults = [...cachedResults, ...scrapeResult.results];

      return this.buildResponse(allResults);
    } finally {
      // Always release the slot
      this.concurrencyService.release();
    }
  }

  private buildResponse(results: any[]): ScrapeResponseDto {
    return {
      success: results.some(r => r.success),
      totalProfiles: results.length,
      successfulProfiles: results.filter(r => r.success).length,
      failedProfiles: results.filter(r => !r.success).length,
      results: results.map((result) => ({
        success: result.success,
        username: result.username,
        postsCount: result.posts?.length || 0,
        posts: (result.posts || []).map((post: any) => ({
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
}
