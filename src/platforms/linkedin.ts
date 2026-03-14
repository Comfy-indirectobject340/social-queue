import type { Config } from "../config.js";
import type { ImageAttachment, PublishResult } from "../types.js";
import { toPlaintext } from "../markdown.js";
import { readImageFile } from "../images.js";

async function uploadLinkedInImage(
  image: ImageAttachment,
  personUrn: string,
  accessToken: string,
): Promise<string> {
  // Step 1: Initialize upload
  const initResponse = await fetch(
    "https://api.linkedin.com/rest/images?action=initializeUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202602",
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: personUrn,
        },
      }),
    },
  );

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    throw new Error(
      `LinkedIn image init failed (${initResponse.status}): ${errorText}`,
    );
  }

  const initData = (await initResponse.json()) as {
    value: { uploadUrl: string; image: string };
  };
  const { uploadUrl, image: imageUrn } = initData.value;

  // Step 2: Upload binary
  const data = await readImageFile(image);
  const blob = new Blob([data], { type: image.mimeType });
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": image.mimeType,
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(
      `LinkedIn image upload failed (${uploadResponse.status}): ${errorText}`,
    );
  }

  return imageUrn;
}

export async function publishToLinkedIn(
  content: string,
  config: NonNullable<Config["linkedin"]>,
  images: ImageAttachment[],
): Promise<PublishResult> {
  const text = toPlaintext(content);
  const personUrn = `urn:li:person:${config.personId}`;

  // Upload images if any
  const imageUrns: string[] = [];
  for (const image of images) {
    const urn = await uploadLinkedInImage(
      image,
      personUrn,
      config.accessToken,
    );
    imageUrns.push(urn);
  }

  const body: Record<string, unknown> = {
    author: personUrn,
    commentary: text,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
    },
    lifecycleState: "PUBLISHED",
  };

  // Add image content if we have uploads
  if (imageUrns.length === 1) {
    body.content = {
      media: {
        id: imageUrns[0],
      },
    };
  } else if (imageUrns.length > 1) {
    body.content = {
      multiImage: {
        images: imageUrns.map((id) => ({ id })),
      },
    };
  }

  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": "202602",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LinkedIn API error (${response.status}): ${errorText}`,
    );
  }

  // LinkedIn returns the post ID in the x-restli-id header
  const postId = response.headers.get("x-restli-id");
  const url = postId
    ? `https://www.linkedin.com/feed/update/${postId}`
    : undefined;

  return {
    platform: "linkedin",
    success: true,
    url,
  };
}
