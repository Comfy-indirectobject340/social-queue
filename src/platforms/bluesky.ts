import { AtpAgent, CredentialSession, RichText } from "@atproto/api";
import type { Config } from "../config.js";
import type { ImageAttachment, PublishResult } from "../types.js";
import { toPlaintext } from "../markdown.js";
import { readImageFile } from "../images.js";

const BLUESKY_IMAGE_MAX_SIZE = 1_000_000; // 1MB

export async function publishToBluesky(
  content: string,
  config: NonNullable<Config["bluesky"]>,
  images: ImageAttachment[],
): Promise<PublishResult> {
  const session = new CredentialSession(new URL(config.service));
  const agent = new AtpAgent(session);

  await agent.login({
    identifier: config.identifier,
    password: config.password,
  });

  const text = toPlaintext(content);

  if (text.length > 300) {
    throw new Error(
      `Post exceeds Bluesky 300-char limit (${text.length} chars)`,
    );
  }

  // Detect links, hashtags, and mentions as rich text facets
  const rt = new RichText({ text });
  await rt.detectFacets(agent);

  // Upload images if any
  let embed: { $type: string; images: { image: unknown; alt: string }[] } | undefined;
  if (images.length > 0) {
    const uploaded: { blobRef: unknown; alt: string }[] = [];

    for (const image of images) {
      const data = await readImageFile(image);

      if (data.byteLength > BLUESKY_IMAGE_MAX_SIZE) {
        throw new Error(
          `Image "${image.filename}" exceeds Bluesky 1MB limit (${(data.byteLength / 1_000_000).toFixed(2)}MB)`,
        );
      }

      const response = await agent.uploadBlob(data, {
        encoding: image.mimeType,
      });

      uploaded.push({ blobRef: response.data.blob, alt: image.alt });
    }

    embed = {
      $type: "app.bsky.embed.images",
      images: uploaded.map(({ blobRef, alt }) => ({
        image: blobRef,
        alt,
      })),
    };
  }

  const response = await agent.post({
    text: rt.text,
    facets: rt.facets,
    ...(embed ? { embed } : {}),
  });

  // Build the post URL from the agent's DID and the rkey
  const uri = response.uri; // at://did:plc:xxx/app.bsky.feed.post/rkey
  const parts = uri.split("/");
  const rkey = parts[parts.length - 1];
  const did = session.did;
  const url = `https://bsky.app/profile/${did}/post/${rkey}`;

  return {
    platform: "bluesky",
    success: true,
    url,
  };
}
