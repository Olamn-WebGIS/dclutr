import { NextResponse } from "next/server";
import { isValidClickSignature, recordEmailClick } from "@/lib/server/marketing";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user") || "";
  const campaign = url.searchParams.get("campaign") || "";
  const destination = url.searchParams.get("destination") || "";
  const signature = url.searchParams.get("signature") || "";
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin : "";
  if (!configuredOrigin || configuredOrigin !== url.origin) return new Response("This email link is invalid.", { status: 400 });
  if (!isValidClickSignature(userId, campaign, destination, signature)) return new Response("This email link is invalid.", { status: 400 });
  await recordEmailClick(userId, campaign);
  return NextResponse.redirect(new URL(destination, url.origin), 303);
}
