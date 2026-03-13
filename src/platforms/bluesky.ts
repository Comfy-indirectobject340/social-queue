import { AtpAgent, CredentialSession, RichText } from "@atproto/api";
import type { Config } from "../config.js";
import type { PublishResult } from "../types.js";
import { toPlaintext } from "../markdown.js";

export async function publishToBluesky(
  content: string,
  config: NonNullable<Config["bluesky"]>,
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

  const response = await agent.post({
    text: rt.text,
    facets: rt.facets,
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
