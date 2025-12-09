import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MediaItem {
  @ApiProperty({ description: 'Media URL' })
  url: string;

  @ApiProperty({ description: 'Media type', enum: ['image', 'video'] })
  type: 'image' | 'video';

  @ApiPropertyOptional({ description: 'Width in pixels' })
  width?: number;

  @ApiPropertyOptional({ description: 'Height in pixels' })
  height?: number;
}

export class OriginalDataDto {
  @ApiProperty({ description: 'Instagram product type' })
  productType: string;

  @ApiProperty({ description: 'Instagram media type number' })
  mediaType: number;

  @ApiProperty({ description: 'Whether the post has audio' })
  hasAudio: boolean;
}

export class InstagramPost {
  @ApiProperty({ description: 'Unique post ID' })
  id: string;

  @ApiProperty({ description: 'Post shortcode (used in URLs)' })
  shortcode: string;

  @ApiProperty({ description: 'Post caption/text' })
  text: string;

  @ApiProperty({ description: 'Post creation timestamp (Unix timestamp in seconds)' })
  createdAt: number;

  @ApiProperty({ description: 'Post type', enum: ['feed', 'carousel', 'clips'] })
  type: 'feed' | 'carousel' | 'clips';

  @ApiProperty({ description: 'Instagram username of the poster' })
  username: string;

  @ApiProperty({ description: 'Media items (images/videos)', type: [MediaItem] })
  media: MediaItem[];

  @ApiProperty({ description: 'Number of likes' })
  likes: number;

  @ApiProperty({ description: 'Number of comments' })
  comments: number;

  @ApiProperty({ description: 'Permalink to the post' })
  permalink: string;

  @ApiPropertyOptional({ description: 'Original Instagram data for reference', type: OriginalDataDto })
  originalData?: OriginalDataDto;
}

export class ProfileScrapeResult {
  @ApiProperty({ description: 'Success status for this profile' })
  success: boolean;

  @ApiProperty({ description: 'Instagram username that was scraped' })
  username: string;

  @ApiProperty({ description: 'Number of posts retrieved' })
  postsCount: number;

  @ApiProperty({ description: 'Array of Instagram posts', type: [InstagramPost] })
  posts: InstagramPost[];

  @ApiProperty({ description: 'Account used for scraping (username only)' })
  scrapedWith: string;

  @ApiProperty({ description: 'Timestamp when scraping was performed (Unix timestamp)' })
  scrapedAt: number;

  @ApiPropertyOptional({ description: 'Error message if scraping failed' })
  error?: string;
}

export class ScrapeResponseDto {
  @ApiProperty({ description: 'Overall success status' })
  success: boolean;

  @ApiProperty({ description: 'Total number of profiles processed' })
  totalProfiles: number;

  @ApiProperty({ description: 'Number of profiles successfully scraped' })
  successfulProfiles: number;

  @ApiProperty({ description: 'Number of profiles that failed' })
  failedProfiles: number;

  @ApiProperty({ description: 'Results for each profile', type: [ProfileScrapeResult] })
  results: ProfileScrapeResult[];

  @ApiPropertyOptional({ description: 'General error message if entire batch failed' })
  error?: string;
}
