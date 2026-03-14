import generator from "megalodon";
import type { Config } from "../config.js";
import type { ImageAttachment, PublishResult } from "../types.js";
import { toPlaintext } from "../markdown.js";
import { readImageFile } from "../images.js";

export async function publishToMastodon(
  content: string,
  config: NonNullable<Config["mastodon"]>,
  images: ImageAttachment[],
): Promise<PublishResult> {
  const client = generator("mastodon", config.url, config.accessToken);

  const text = toPlaintext(content);

  // Upload images if any
  const mediaIds: string[] = [];
  for (const image of images) {
    const data = await readImageFile(image);
    const blob = new Blob([data], { type: image.mimeType });
    const file = new File([blob], image.filename, { type: image.mimeType });
    const attachment = await client.uploadMedia(file, {
      description: image.alt,
    });
    mediaIds.push(attachment.data.id);
  }

  const response = await client.postStatus(text, {
    media_ids: mediaIds.length > 0 ? mediaIds : undefined,
  });

  const url = "url" in response.data ? response.data.url : undefined;

  return {
    platform: "mastodon",
    success: true,
    url: url ?? undefined,
  };
}
