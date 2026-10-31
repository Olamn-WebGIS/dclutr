import { timingSafeEqual } from "node:crypto";
import { errorResponse, json, requireEnv } from "@/lib/server/backend";
import { purgeExpiredListings } from "@/lib/server/listing-cleanup";

export async function GET(request: Request) {
  try {
    const expected = requireEnv("CRON_SECRET");
    const authorization = request.headers.get("authorization") || "";
    const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const a = Buffer.from(supplied); const b = Buffer.from(expected);
    if (!supplied || a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: "Unauthorized" }, 401);
    return json(await purgeExpiredListings());
  } catch (error) { return errorResponse(error); }
}
