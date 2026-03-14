import fs from "node:fs/promises";
import path from "node:path";
import type { ImageAttachment } from "./types.js";

const MAX_IMAGES = 4;

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export function getMimeType(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] ?? null;
}

export async function parseImages(
  data: unknown,
  postDir: string,
): Promise<ImageAttachment[]> {
  if (!Array.isArray(data)) return [];

  if (data.length > MAX_IMAGES) {
    throw new Error(`Too many images (${data.length}), maximum is ${MAX_IMAGES}`);
  }

  const attachments: ImageAttachment[] = [];

  for (const entry of data) {
    if (typeof entry !== "object" || entry === null || !("path" in entry)) {
      console.log(`[images] skipping invalid image entry: ${JSON.stringify(entry)}`);
      continue;
    }

    const imgPath = String(entry.path);
    const alt = "alt" in entry && typeof entry.alt === "string" ? entry.alt : "";
    const filePath = path.resolve(postDir, imgPath);
    const filename = path.basename(imgPath);

    const mimeType = getMimeType(filename);
    if (!mimeType) {
      throw new Error(
        `Unsupported image type for "${filename}". Supported: .jpg, .jpeg, .png, .gif, .webp`,
      );
    }

    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`Image file not found: ${filePath}`);
    }

    attachments.push({ filePath, filename, alt, mimeType });
  }

  return attachments;
}

export async function readImageFile(
  attachment: ImageAttachment,
): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = await fs.readFile(attachment.filePath);
  // Convert Node Buffer to a standard Uint8Array backed by an ArrayBuffer
  // (required for Blob/File/fetch compatibility in strict TypeScript)
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) as Uint8Array<ArrayBuffer>;
}
