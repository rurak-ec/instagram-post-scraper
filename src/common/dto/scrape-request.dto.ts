import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, ArrayMinSize, ArrayMaxSize, ValidateIf, IsObject } from 'class-validator';

export class ScrapeRequestDto {
  @ApiProperty({
    description: 'Instagram username to scrape (without @ symbol). Use this for single profile scraping.',
    example: 'natgeo',
    required: false,
  })
  @ValidateIf(o => !o.usernames || o.usernames.length === 0)
  @IsString()
  @IsNotEmpty()
  username?: string;

  @ApiProperty({
    description: 'Array of Instagram usernames to scrape (without @ symbol). Maximum 5 usernames per request. Use this for batch scraping.',
    example: ['natgeo', 'nasa', 'bbcearth'],
    type: [String],
    required: false,
    maxItems: 5,
    minItems: 1,
  })
  @ValidateIf(o => !o.username)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  usernames?: string[];

  @ApiPropertyOptional({
    description: 'Filter posts created after this Unix timestamp (applies to single profile or as default for batch)',
    example: 1765158474,
  })
  @IsOptional()
  @IsInt()
  createdAt?: number;

  @ApiPropertyOptional({
    description: 'Per-profile createdAt filter for batch mode. Object mapping username to Unix timestamp. Takes precedence over global createdAt.',
    example: { 'natgeo': 1765158474, 'nasa': 1765000000 },
  })
  @IsOptional()
  @IsObject()
  createdAtMap?: Record<string, number>;
}
