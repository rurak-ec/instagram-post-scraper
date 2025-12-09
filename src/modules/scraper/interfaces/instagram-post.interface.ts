/**
 * Raw Instagram GraphQL node structure
 */
export interface RawIgNode {
  __typename?: string;
  id: string;
  shortcode?: string;
  edge_media_to_caption?: {
    edges: Array<{
      node: {
        text: string;
      };
    }>;
  };
  taken_at_timestamp?: number;
  media_type?: number; // 1 = foto, 2 = video, 8 = carousel
  product_type?: string;
  code?: string;
  caption?: {
    text?: string;
  };
  user?: {
    username?: string;
  };
  thumbnail_src?: string;
  display_url?: string;
  video_url?: string;
  edge_media_to_like?: {
    count: number;
  };
  edge_media_to_comment?: {
    count: number;
  };
  edge_sidecar_to_children?: {
    edges: Array<{
      node: {
        __typename: string;
        id: string;
        display_url: string;
        video_url?: string;
        dimensions?: {
          width: number;
          height: number;
        };
      };
    }>;
  };
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Cleaned Instagram post structure
 */
export interface CleanIgPost {
  id: string;
  text: string;
  createdAt: number; // Unix timestamp in seconds
  type: 'feed' | 'carousel_container' | 'clips';
  username: string;
  media: Array<{
    url: string;
    type: 'image' | 'video';
    width?: number;
    height?: number;
  }>;
  likes: number;
  comments: number;
  permalink?: string;
}

/**
 * GraphQL response structure from Instagram
 */
export interface InstagramGraphQLResponse {
  data?: {
    xdt_api__v1__feed__user_timeline_graphql_connection?: {
      edges?: Array<{
        node: RawIgNode;
      }>;
    };
  };
}
