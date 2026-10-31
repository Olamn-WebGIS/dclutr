import { BackendError } from "@/lib/server/backend";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) throw new BackendError("Request origin is not allowed.", 403);
}

export async function requireImage(file: File, maxBytes = 5 * 1024 * 1024) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type) || file.size <= 0 || file.size > maxBytes) {
    throw new BackendError("Upload a JPG, PNG, or WebP image up to 5 MB.", 400);
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const isWebp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if ((file.type === "image/jpeg" && !isJpeg) || (file.type === "image/png" && !isPng) || (file.type === "image/webp" && !isWebp)) {
    throw new BackendError("The uploaded file content does not match its image type.", 400);
  }
}

export function assertUuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BackendError("Invalid resource identifier.", 400);
  }
}
