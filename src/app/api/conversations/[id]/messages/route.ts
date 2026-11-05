import { BackendError, adminFetch, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { assertAllowedChatText } from "@/lib/server/chat-moderation";
import { notifyUser } from "@/lib/server/mailer";
import { checkRateLimit } from "@/lib/server/password-auth";

async function participant(id: string, session: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>["session"], userId: string) {
  const rows = await userFetch<Array<{ id: string; buyer_id: string; seller_id: string }>>(`rest/v1/conversations?id=eq.${id}&select=id,buyer_id,seller_id`, session);
  if (!rows[0] || ![rows[0].buyer_id, rows[0].seller_id].includes(userId)) throw new BackendError("Conversation not found.", 404);
  return rows[0];
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to view messages.", 401);
    const { id } = await params;
    assertUuid(id);
    const conversation = await participant(id, auth.session, auth.user.id);
    const readColumn = auth.user.id === conversation.buyer_id ? "buyer_last_read_at" : "seller_last_read_at";
    await adminFetch(`rest/v1/conversations?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ [readColumn]: new Date().toISOString() }),
    });
    const messages = await userFetch<Array<{ id: string; sender_id: string; body: string; created_at: string }>>(`rest/v1/messages?conversation_id=eq.${id}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,sender_id,body,created_at&order=created_at.asc&limit=200`, auth.session);
    return json({ messages: await Promise.all(messages.map(async (message) => {
      const profiles = await adminFetch<Array<{ display_name: string }>>(`rest/v1/profiles?id=eq.${message.sender_id}&select=display_name`);
      return { ...message, senderName: profiles[0]?.display_name ?? "Student", mine: message.sender_id === auth.user.id };
    })) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to send messages.", 401);
    const { id } = await params;
    assertUuid(id);
    const conversation = await participant(id, auth.session, auth.user.id);
    const { body } = await request.json() as { body?: string };
    const orderRows = await userFetch<Array<{ status: string }>>(`rest/v1/orders?conversation_id=eq.${id}&select=status`, auth.session);
    const paymentConfirmed = orderRows[0] && ["paid", "dispatched", "delivered", "completed"].includes(orderRows[0].status);
    const moderatedBody = assertAllowedChatText(body ?? "", paymentConfirmed);
    if (!await checkRateLimit(`chat-send:${auth.user.id}:${id}`, request, 30, 300)) throw new BackendError("You’re sending messages too quickly. Wait a few minutes and try again.", 429);
    const saved = await userFetch<Array<{ id: string }>>("rest/v1/messages?select=id", auth.session, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ conversation_id: id, sender_id: auth.user.id, body: moderatedBody, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }) });
    await adminFetch(`rest/v1/conversations?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_message_at: new Date().toISOString() }) });
    const recipient = conversation.buyer_id === auth.user.id ? conversation.seller_id : conversation.buyer_id;
    if (saved[0] && await checkRateLimit(`chat-email:${recipient}:${id}`, request, 1, 300)) await notifyUser(recipient, "New D_clutr message", "A student sent you a message about your marketplace conversation. Sign in to D_clutr to read and reply.", `message:${saved[0].id}`);
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
