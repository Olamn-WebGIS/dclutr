import { BackendError, errorResponse, getAuthContext, json } from "@/lib/server/backend";
import { assertSameOrigin } from "@/lib/server/security";
import { getPushPublicKey, removePushSubscription, savePushSubscription } from "@/lib/server/push-notifications";

type SubscriptionInput = {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

const allowedPushProviders = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];

function validateSubscription(input: SubscriptionInput) {
  if (typeof input.endpoint !== "string" || input.endpoint.length > 2048) throw new BackendError("Invalid device subscription.");
  let endpoint: URL;
  try { endpoint = new URL(input.endpoint); }
  catch { throw new BackendError("Invalid device subscription."); }
  const isAllowedProvider = allowedPushProviders.some((domain) => endpoint.hostname === domain || endpoint.hostname.endsWith(`.${domain}`));
  if (endpoint.protocol !== "https:" || !isAllowedProvider || typeof input.keys?.p256dh !== "string" || typeof input.keys.auth !== "string"
    || !/^[A-Za-z0-9_-]{20,200}$/.test(input.keys.p256dh) || !/^[A-Za-z0-9_-]{10,100}$/.test(input.keys.auth)) {
    throw new BackendError("Invalid device subscription.");
  }
  return {
    endpoint: endpoint.toString(),
    expirationTime: typeof input.expirationTime === "number" ? input.expirationTime : null,
    keys: { p256dh: input.keys.p256dh, auth: input.keys.auth },
  };
}

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to enable device notifications.", 401);
    return json({ publicKey: getPushPublicKey() });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to enable device notifications.", 401);
    getPushPublicKey();
    const subscription = validateSubscription(await request.json() as SubscriptionInput);
    await savePushSubscription(auth.user.id, subscription);
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to manage device notifications.", 401);
    const body = await request.json() as { endpoint?: unknown };
    if (typeof body.endpoint !== "string") throw new BackendError("Invalid device subscription.");
    let endpoint: URL;
    try { endpoint = new URL(body.endpoint); }
    catch { throw new BackendError("Invalid device subscription."); }
    if (endpoint.protocol !== "https:" || !allowedPushProviders.some((domain) => endpoint.hostname === domain || endpoint.hostname.endsWith(`.${domain}`))) {
      throw new BackendError("Invalid device subscription.");
    }
    await removePushSubscription(auth.user.id, endpoint.toString());
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
