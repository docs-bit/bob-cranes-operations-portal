import { createReadStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Express } from "express";

/**
 * Local-disk file storage for self-hosted deployments.
 * Files live under `<cwd>/uploads` (gitignored) and are served read-only
 * at `/files/:key`. Keys are server-generated (`<timestamp>-<rand>.<ext>`)
 * so stored paths can never traverse directories.
 */

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

const TYPE_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export const ALLOWED_UPLOAD_TYPES = Object.keys(EXT_BY_TYPE);
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function isAllowedUploadType(contentType: string): boolean {
  return contentType in EXT_BY_TYPE;
}

export function isSafeStorageKey(key: string): boolean {
  return /^[A-Za-z0-9_-]+\.(pdf|jpe?g|png)$/.test(key);
}

export async function saveUploadedFile(input: {
  fileName: string;
  contentType: string;
  bytes: Buffer;
}): Promise<{ key: string; url: string; size: number }> {
  if (!isAllowedUploadType(input.contentType))
    throw new Error("Only PDF, JPEG, and PNG files can be stored.");
  if (input.bytes.length < 1 || input.bytes.length > MAX_UPLOAD_BYTES)
    throw new Error("Each file must be between 1 byte and 25 MB.");
  await mkdir(UPLOAD_DIR, { recursive: true });
  const key = `${Date.now()}-${randomUUID().slice(0, 8)}${EXT_BY_TYPE[input.contentType]}`;
  await writeFile(path.join(UPLOAD_DIR, key), input.bytes);
  return { key, url: `/files/${key}`, size: input.bytes.length };
}

export function registerLocalFiles(app: Express): void {
  app.get("/files/:key", (req, res) => {
    const key = req.params.key ?? "";
    if (!isSafeStorageKey(key)) {
      res.status(400).send("Invalid file reference.");
      return;
    }
    const filePath = path.join(UPLOAD_DIR, key);
    if (!existsSync(filePath)) {
      res.status(404).send("File not found.");
      return;
    }
    const ext = path.extname(key).toLowerCase();
    res.setHeader(
      "Content-Type",
      TYPE_BY_EXT[ext] ?? "application/octet-stream"
    );
    res.setHeader("Content-Disposition", `inline; filename="${key}"`);
    res.setHeader("Cache-Control", "private, max-age=900");
    createReadStream(filePath).pipe(res);
  });
}
