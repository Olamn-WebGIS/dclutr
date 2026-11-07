import { BackendError, adminFetch, errorResponse, getAuthContext, json } from "@/lib/server/backend";
import { assertSameOrigin } from "@/lib/server/security";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_CATEGORIES = new Set(["Campus essentials", "Furniture", "Home appliances"]);

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to manage your email preferences.", 401);
    const rows = await adminFetch<Array<{ is_subscribed: boolean; lifecycle_emails_enabled: boolean; saved_categories: string[]; category_alerts_enabled: boolean; price_alerts_enabled: boolean }>>(`rest/v1/email_marketing_preferences?user_id=eq.${auth.user.id}&select=is_subscribed,lifecycle_emails_enabled,saved_categories,category_alerts_enabled,price_alerts_enabled`);
    return json({ subscribed: rows[0]?.is_subscribed ?? false, lifecycleReminders: rows[0]?.lifecycle_emails_enabled ?? false, categories: rows[0]?.saved_categories ?? [], categoryAlerts: rows[0]?.category_alerts_enabled ?? false, priceAlerts: rows[0]?.price_alerts_enabled ?? false });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to manage your email preferences.", 401);
    const body = await request.json() as { subscribed?: boolean; lifecycleReminders?: boolean; categories?: string[]; categoryAlerts?: boolean; priceAlerts?: boolean };
    if (typeof body.subscribed !== "boolean") throw new BackendError("Choose whether to receive marketplace emails.", 400);
    if (body.lifecycleReminders !== undefined && typeof body.lifecycleReminders !== "boolean") throw new BackendError("Choose whether to receive weekly marketplace reminders.", 400);
    if (body.categories !== undefined && (!Array.isArray(body.categories) || body.categories.some((category) => typeof category !== "string" || !ALLOWED_CATEGORIES.has(category)))) {
      throw new BackendError("Choose valid D_clutr item categories.", 400);
    }
    if (body.categoryAlerts !== undefined && typeof body.categoryAlerts !== "boolean") throw new BackendError("Choose whether to receive saved-category alerts.", 400);
    if (body.priceAlerts !== undefined && typeof body.priceAlerts !== "boolean") throw new BackendError("Choose whether to receive lower-price alerts.", 400);
    const categories = body.categories ?? [];
    const lifecycleReminders = body.lifecycleReminders ?? false;
    const categoryAlerts = body.categoryAlerts ?? false;
    const priceAlerts = body.priceAlerts ?? false;
    if (categoryAlerts && (!body.subscribed || categories.length === 0)) throw new BackendError("Opt in to marketplace emails and select at least one category to enable new-item alerts.", 400);
    if (priceAlerts && !body.subscribed) throw new BackendError("Opt in to marketplace emails before enabling lower-price alerts.", 400);

    const now = new Date();
    if (body.subscribed || body.categories !== undefined || body.categoryAlerts !== undefined || body.priceAlerts !== undefined || body.lifecycleReminders !== undefined) {
      const profiles = await adminFetch<Array<{ created_at: string }>>(`rest/v1/profiles?id=eq.${auth.user.id}&select=created_at&limit=1`);
      const createdAt = profiles[0]?.created_at;
      if (!createdAt) throw new BackendError("We couldn’t find your account date.", 404);
      const accountAgeWeeks = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / WEEK_MS));
      const currentPreferences = await adminFetch<Array<{ is_subscribed: boolean; consented_at: string | null; saved_categories: string[]; category_alerts_enabled: boolean; category_alerts_since: string | null; price_alerts_enabled: boolean }>>(`rest/v1/email_marketing_preferences?user_id=eq.${auth.user.id}&select=is_subscribed,consented_at,saved_categories,category_alerts_enabled,category_alerts_since,price_alerts_enabled`);
      const current = currentPreferences[0];
      const categoriesChanged = current?.saved_categories?.slice().sort().join("|") !== categories.slice().sort().join("|");
      const categoryAlertsSince = categoryAlerts && (!current?.category_alerts_enabled || categoriesChanged)
        ? now.toISOString()
        : categoryAlerts ? current?.category_alerts_since ?? now.toISOString() : null;
      await adminFetch("rest/v1/email_marketing_preferences?on_conflict=user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          user_id: auth.user.id,
          is_subscribed: body.subscribed,
          ...(body.subscribed ? { consented_at: current?.is_subscribed ? current.consented_at ?? now.toISOString() : now.toISOString(), unsubscribed_at: null } : { unsubscribed_at: now.toISOString() }),
          saved_categories: categories,
          lifecycle_emails_enabled: body.subscribed && lifecycleReminders,
          category_alerts_enabled: body.subscribed && categoryAlerts,
          category_alerts_since: categoryAlertsSince,
          price_alerts_enabled: body.subscribed && priceAlerts,
          price_alerts_since: body.subscribed && priceAlerts && !current?.price_alerts_enabled ? now.toISOString() : body.subscribed && priceAlerts ? undefined : null,
          ...(body.subscribed ? { last_lifecycle_week: accountAgeWeeks } : {}),
          updated_at: now.toISOString(),
        }),
      });
    }

    return json({ subscribed: body.subscribed });
  } catch (error) { return errorResponse(error); }
}
