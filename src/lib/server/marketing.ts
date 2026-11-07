import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { BackendError, requireEnv } from "@/lib/server/backend";
import { recordMarketplaceEventSafely } from "@/lib/server/marketplace-analytics";

function unsubscribeSignature(userId: string) {
  const secret = requireEnv("SESSION_SECRET");
  if (Buffer.byteLength(secret) < 32) throw new BackendError("SESSION_SECRET must be at least 32 characters.", 503);
  return createHmac("sha256", secret).update(`email-marketing-unsubscribe:${userId}`).digest("base64url");
}

export function createUnsubscribeUrl(userId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) throw new BackendError("Set NEXT_PUBLIC_APP_URL to send marketing emails.", 503);
  const url = new URL("/api/marketing-preferences/unsubscribe", baseUrl);
  url.searchParams.set("user", userId);
  url.searchParams.set("signature", unsubscribeSignature(userId));
  return url.toString();
}

export function isValidUnsubscribeSignature(userId: string, signature: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return false;
  const expected = Buffer.from(unsubscribeSignature(userId));
  const supplied = Buffer.from(signature);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function clickSignature(userId: string, campaign: string, destination: string) {
  return createHmac("sha256", requireEnv("SESSION_SECRET"))
    .update(`email-click:${userId}:${campaign}:${destination}`)
    .digest("base64url");
}

export function createEmailClickUrl(userId: string, campaign: string, destination: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl || !isInternalDestination(destination, baseUrl)) throw new BackendError("A valid app URL and internal email destination are required.", 503);
  const url = new URL("/api/email-click", baseUrl);
  url.searchParams.set("user", userId);
  url.searchParams.set("campaign", campaign);
  url.searchParams.set("destination", destination);
  url.searchParams.set("signature", clickSignature(userId, campaign, destination));
  return url.toString();
}

function isInternalDestination(destination: string, baseUrl: string) {
  if (!destination.startsWith("/") || destination.startsWith("//") || destination.includes("\\") || /[\u0000-\u001f]/.test(destination)) return false;
  try { return new URL(destination, baseUrl).origin === new URL(baseUrl).origin; }
  catch { return false; }
}

export function isValidClickSignature(userId: string, campaign: string, destination: string, signature: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return false;
  if (!/^[a-z-]{1,40}$/.test(campaign) || !process.env.NEXT_PUBLIC_APP_URL || !isInternalDestination(destination, process.env.NEXT_PUBLIC_APP_URL)) return false;
  const expected = Buffer.from(clickSignature(userId, campaign, destination));
  const supplied = Buffer.from(signature);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function recordEmailClick(userId: string, campaign: string) {
  await recordMarketplaceEventSafely({ userId, event: "email_click", campaign });
}
