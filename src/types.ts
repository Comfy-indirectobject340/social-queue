export type Platform = "bluesky" | "mastodon" | "linkedin";

export interface ImageAttachment {
  filePath: string; // absolute path on disk
  filename: string; // original filename
  alt: string; // alt text (empty string if not provided)
  mimeType: string; // image/jpeg, image/png, image/gif, image/webp
}

export interface Post {
  filename: string;
  content: string;
  platforms: Platform[];
  scheduledAt?: Date;
  raw: string;
  images: ImageAttachment[];
  postDir?: string; // set when post is in a subdirectory
}

export interface PublishResult {
  platform: Platform;
  success: boolean;
  url?: string;
  error?: string;
}
