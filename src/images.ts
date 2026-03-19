import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
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

/**
 * Read an image file and auto-resize if it exceeds maxBytes.
 * Returns a Uint8Array suitable for upload APIs.
 */
export async function readImageFile(
  attachment: ImageAttachment,
  maxBytes = 1_000_000,
): Promise<Uint8Array<ArrayBuffer>> {
  const raw = await fs.readFile(attachment.filePath);
  let buffer: Buffer<ArrayBuffer> = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength) as Buffer<ArrayBuffer>;

  if (buffer.byteLength > maxBytes) {
    console.log(
      `[images] ${attachment.filename} is ${(buffer.byteLength / 1_000_000).toFixed(2)}MB, resizing to fit ${(maxBytes / 1_000_000).toFixed(0)}MB limit`,
    );
    const resized = await shrinkToFit(buffer, attachment.mimeType, maxBytes);
    buffer = Buffer.from(resized.buffer, resized.byteOffset, resized.byteLength) as Buffer<ArrayBuffer>;
    console.log(
      `[images] ${attachment.filename} resized to ${(buffer.byteLength / 1_000_000).toFixed(2)}MB`,
    );
  }

  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) as Uint8Array<ArrayBuffer>;
}

async function shrinkToFit(
  input: Buffer,
  mimeType: string,
  maxBytes: number,
): Promise<Buffer> {
  const format = mimeType === "image/png" ? "png" : "jpeg";
  let width = (await sharp(input).metadata()).width ?? 1600;

  // Progressively reduce width until under the limit
  while (width > 200) {
    const output = await sharp(input)
      .resize({ width, withoutEnlargement: true })
      .toFormat(format, format === "jpeg" ? { quality: 80 } : { compressionLevel: 9 })
      .toBuffer();

    if (output.byteLength <= maxBytes) {
      return output;
    }
    width = Math.floor(width * 0.75);
  }

  throw new Error(`Could not shrink image below ${(maxBytes / 1_000_000).toFixed(0)}MB`);
}
