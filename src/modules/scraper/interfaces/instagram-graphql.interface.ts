/**
 * Estructura exacta del GraphQL de Instagram
 * Basada en la respuesta real de xdt_api__v1__feed__user_timeline_graphql_connection
 */

export interface InstagramVideoVersion {
  width: number;
  height: number;
  url: string;
  type: number; // 101, 102, 103
}

export interface InstagramImageCandidate {
  url: string;
  height: number;
  width: number;
}

export interface InstagramCaption {
  has_translation: boolean | null;
  created_at: number;
  pk: string;
  text: string;
}

export interface InstagramUser {
  pk: string;
  profile_pic_url: string;
  username: string;
  is_private: boolean;
  is_verified: boolean;
  full_name: string;
  id: string;
}

export interface InstagramClipsMetadata {
  audio_type: string;
  music_info: any | null;
  original_sound_info: {
    original_audio_title: string;
    audio_asset_id: string;
    ig_artist: {
      username: string;
      id: string;
    };
  } | null;
  is_shared_to_fb: boolean;
}

export interface InstagramNode {
  code: string;
  pk: string;
  id: string;
  caption: InstagramCaption | null;
  taken_at: number;

  // Media specific fields
  video_versions?: InstagramVideoVersion[];
  is_dash_eligible?: number;
  video_dash_manifest?: string;
  image_versions2?: {
    candidates: InstagramImageCandidate[];
  };

  // Post metadata
  product_type: string; // "feed", "clips", "igtv"
  media_type: number; // 1 = image, 2 = video, 8 = carousel
  original_height: number;
  original_width: number;

  // Engagement
  like_count: number;
  comment_count: number;
  has_liked: boolean;

  // User info
  user: InstagramUser;

  // Carousel specific
  carousel_media_count?: number | null;
  carousel_media?: Array<{
    id: string;
    media_type: number;
    image_versions2?: {
      candidates: InstagramImageCandidate[];
    };
    video_versions?: InstagramVideoVersion[];
    original_width: number;
    original_height: number;
  }> | null;

  // Clips specific
  clips_metadata?: InstagramClipsMetadata | null;
  has_audio?: boolean | null;

  // Additional metadata
  accessibility_caption?: string | null;
  organic_tracking_token: string;
  link?: string | null;
}

export interface InstagramEdge {
  node: InstagramNode;
  cursor: string;
}

export interface InstagramTimelineConnection {
  edges: InstagramEdge[];
}

export interface InstagramProfileTimeline {
  num_results: number;
  items: InstagramNode[];
}

export interface InstagramGraphQLData {
  xdt_api__v1__feed__user_timeline_graphql_connection?: InstagramTimelineConnection;
  xdt_api__v1__profile_timeline?: InstagramProfileTimeline;
}

export interface InstagramGraphQLResponse {
  data: InstagramGraphQLData;
}

/**
 * Cleaned post format for API response
 */
export interface CleanedInstagramPost {
  id: string;
  shortcode: string;
  text: string;
  createdAt: number; // Unix timestamp
  type: 'feed' | 'clips' | 'carousel';
  username: string;
  media: Array<{
    url: string;
    type: 'image' | 'video';
    width: number;
    height: number;
  }>;
  likes: number;
  comments: number;
  permalink: string;
  originalData?: {
    productType: string;
    mediaType: number;
    hasAudio: boolean;
  };
}
