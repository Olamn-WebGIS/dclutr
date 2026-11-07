import { BackendError, errorResponse, getAuthContext, json } from "@/lib/server/backend";
import { assertSameOrigin } from "@/lib/server/security";
import { checkRateLimit } from "@/lib/server/password-auth";
import { savePriceAlertInterestsSafely } from "@/lib/server/price-alerts";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to save price-alert interests.", 401);
    if (!await checkRateLimit(`price-alert-interest:${auth.user.id}`, request, 30, 900)) {
      throw new BackendError("You’re searching quickly. Wait a few minutes before trying again.", 429);
    }
    const body = await request.json() as { query?: string; listingIds?: string[] };
    const query = body.query?.trim().replace(/\s+/g, " ");
    if (!query || query.length < 2 || query.length > 100 || !Array.isArray(body.listingIds) || body.listingIds.length > 100 || body.listingIds.some((id) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
      throw new BackendError("Enter a search and choose up to 100 valid results.", 400);
    }
    return json(await savePriceAlertInterestsSafely(auth.user.id, query, body.listingIds));
  } catch (error) { return errorResponse(error); }
}
