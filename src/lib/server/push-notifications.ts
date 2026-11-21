import "server-only";
import { createHash } from "node:crypto";
import { sendNotification, setVapidDetails } from "web-push";
import { adminFetch, BackendError } from "@/lib/server/backend";
import { decryptPrivateValue, encryptPrivateValue } from "@/lib/server/secrets";

type PushSubscriptionRecord = { endpoint_hash: string; encrypted_subscription: string };
type PushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

function vapidConfig() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new BackendError("Web push is not configured. Set WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, and WEB_PUSH_SUBJECT.", 503);
  }
  return { publicKey, privateKey, subject };
}

export function getPushPublicKey() {
  return vapidConfig().publicKey;
}

export function hashPushEndpoint(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

export async function savePushSubscription(userId: string, subscription: PushSubscription) {
  await adminFetch("rest/v1/push_subscriptions?on_conflict=endpoint_hash", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      endpoint_hash: hashPushEndpoint(subscription.endpoint),
      user_id: userId,
      encrypted_subscription: encryptPrivateValue(JSON.stringify(subscription)),
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await adminFetch(
    `rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&endpoint_hash=eq.${hashPushEndpoint(endpoint)}`,
    { method: "DELETE" },
  );
}

async function deliverPushSubscriptions(
  subscriptions: PushSubscriptionRecord[],
  notification: { title: string; body: string; url: string; tag: string },
  config: ReturnType<typeof vapidConfig>,
) {
  if (!subscriptions.length) return;
  setVapidDetails(config.subject, config.publicKey, config.privateKey);
  for (let index = 0; index < subscriptions.length; index += 25) {
    await Promise.all(subscriptions.slice(index, index + 25).map(async (record) => {
      try {
        const subscription = JSON.parse(decryptPrivateValue(record.encrypted_subscription)) as PushSubscription;
        await sendNotification(subscription, JSON.stringify(notification), { TTL: 60, urgency: "high" });
      } catch (error) {
        const status = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
          ? error.statusCode
          : undefined;
        if (status === 404 || status === 410) {
          try {
            await adminFetch(`rest/v1/push_subscriptions?endpoint_hash=eq.${record.endpoint_hash}`, { method: "DELETE" });
          } catch (cleanupError) {
            console.error("Unable to remove an expired D_clutr device subscription:", cleanupError instanceof Error ? cleanupError.message : "Subscription cleanup failed.");
          }
        } else {
          console.error("Unable to deliver a D_clutr device notification:", error instanceof Error ? error.message : "Push delivery failed.");
        }
      }
    }));
  }
}

export async function sendPushToUser(userId: string, notification: { title: string; body: string; url: string; tag: string }) {
  try {
    const config = vapidConfig();
    const subscriptions = await adminFetch<PushSubscriptionRecord[]>(
      `rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=endpoint_hash,encrypted_subscription`,
    );
    await deliverPushSubscriptions(subscriptions, notification, config);
  } catch (error) {
    console.error("Unable to send D_clutr device notification:", error instanceof Error ? error.message : "Web push delivery failed.");
  }
}

export async function sendPushToAllUsers(
  notification: { title: string; body: string; url: string; tag: string },
  excludeUserId?: string,
) {
  try {
    const config = vapidConfig();
    const pageSize = 500;
    let lastEndpointHash = "";
    for (;;) {
      const excludedUser = excludeUserId ? `&user_id=neq.${encodeURIComponent(excludeUserId)}` : "";
      const subscriptions = await adminFetch<PushSubscriptionRecord[]>(
        `rest/v1/push_subscriptions?select=endpoint_hash,encrypted_subscription&endpoint_hash=gt.${lastEndpointHash}${excludedUser}&order=endpoint_hash.asc&limit=${pageSize}`,
      );
      if (!subscriptions.length) break;
      await deliverPushSubscriptions(subscriptions, notification, config);
      lastEndpointHash = subscriptions[subscriptions.length - 1].endpoint_hash;
      if (subscriptions.length < pageSize) break;
    }
  } catch (error) {
    console.error("Unable to broadcast D_clutr device notifications:", error instanceof Error ? error.message : "Web push broadcast failed.");
  }
}
