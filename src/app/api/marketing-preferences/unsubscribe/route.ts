import { adminFetch, errorResponse, json } from "@/lib/server/backend";
import { isValidUnsubscribeSignature } from "@/lib/server/marketing";

function unsubscribePage(userId: string, signature: string) {
  const action = `/api/marketing-preferences/unsubscribe?user=${encodeURIComponent(userId)}&signature=${encodeURIComponent(signature)}`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences · D_clutr</title><body style="margin:0;padding:40px 16px;background:#f8f7f1;color:#203b2e;font:16px Arial,sans-serif"><main style="max-width:520px;margin:10vh auto;padding:32px;background:#fffefa;border:1px solid #e6e7dc"><h1 style="font:normal 30px Georgia,serif">Email preferences</h1><p>Stop receiving D_clutr marketplace reminder emails?</p><form method="post" action="${action}"><button style="padding:12px 18px;background:#244b39;color:white;border:0;border-radius:4px;font-size:15px;cursor:pointer">Unsubscribe from reminders</button></form></main></body></html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user") || "";
  const signature = url.searchParams.get("signature") || "";
  try {
    if (!isValidUnsubscribeSignature(userId, signature)) return new Response("This unsubscribe link is invalid.", { status: 400 });
    return new Response(unsubscribePage(userId, signature), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user") || "";
  const signature = url.searchParams.get("signature") || "";
  try {
    if (!isValidUnsubscribeSignature(userId, signature)) return json({ error: "This unsubscribe link is invalid." }, 400);
    await adminFetch(`rest/v1/email_marketing_preferences?user_id=eq.${userId}&is_subscribed=eq.true`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ is_subscribed: false, lifecycle_emails_enabled: false, category_alerts_enabled: false, price_alerts_enabled: false, unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });
    return new Response("<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>Email preferences · D_clutr</title><body style=\"margin:0;padding:40px 16px;background:#f8f7f1;color:#203b2e;font:16px Arial,sans-serif\"><main style=\"max-width:520px;margin:10vh auto;padding:32px;background:#fffefa;border:1px solid #e6e7dc\"><h1 style=\"font:normal 30px Georgia,serif\">You’re unsubscribed.</h1><p>You won’t receive D_clutr marketplace reminder emails. Account and order emails may still be sent.</p></main></body></html>", { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
