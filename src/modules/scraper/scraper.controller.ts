import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InstagramScraperService } from './instagram-scraper.service';
import { ScrapeRequestDto } from '@common/dto/scrape-request.dto';
import { ScrapeResponseDto } from '@common/dto/scrape-response.dto';

@ApiTags('instagram-post-scraper')
@Controller('instagram-post-scraper')
export class ScraperController {
  constructor(private readonly scraperService: InstagramScraperService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scrape Instagram posts from one or multiple profiles',
    description:
      'Extracts posts from Instagram profiles using GraphQL interception with automated account rotation.\n\n' +
      '**Single Profile Mode**: Provide `username` field for scraping a single profile.\n\n' +
      '**Batch Mode**: Provide `usernames` array (max 5) for batch scraping. In batch mode, a single bot processes all profiles sequentially before switching to another bot, simulating human behavior.\n\n' +
      'Returns structured post data ready for consumption.',
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
      const batchResult = await this.scraperService.scrapeProfiles(
        scrapeRequest.usernames!,
        undefined, // Use default limit
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

    // Single mode: single username
    const result = await this.scraperService.scrapeProfile(
      scrapeRequest.username!,
      undefined, // Use default limit
      scrapeRequest.createdAt,
    );

    return {
      success: result.success,
      totalProfiles: 1,
      successfulProfiles: result.success ? 1 : 0,
      failedProfiles: result.success ? 0 : 1,
      results: [{
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
      }],
    };
  }
}
