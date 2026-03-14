import generator from "megalodon";
import type { Config } from "../config.js";
import type { PublishResult } from "../types.js";
import { toPlaintext } from "../markdown.js";

export async function publishToMastodon(
  content: string,
  config: NonNullable<Config["mastodon"]>,
): Promise<PublishResult> {
  const client = generator("mastodon", config.url, config.accessToken);

  const text = toPlaintext(content);
  const response = await client.postStatus(text);

  const url = "url" in response.data ? response.data.url : undefined;

  return {
    platform: "mastodon",
    success: true,
    url: url ?? undefined,
  };
}
