import { BackendError, adminFetch, errorResponse, json, requireAdmin } from "@/lib/server/backend";
import { assertUuid } from "@/lib/server/security";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; conversationId: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id, conversationId } = await params;
    assertUuid(id);
    assertUuid(conversationId);
    const conversations = await adminFetch<Array<{ id: string; listing_title_snapshot: string; buyer_id: string; seller_id: string }>>(`rest/v1/conversations?id=eq.${conversationId}&select=id,listing_title_snapshot,buyer_id,seller_id`);
    const conversation = conversations[0];
    if (!conversation || ![conversation.buyer_id, conversation.seller_id].includes(id)) throw new BackendError("Conversation not found for this student.", 404);
    const messages = await adminFetch<Array<{ id: string; sender_id: string; body: string; created_at: string }>>(`rest/v1/messages?conversation_id=eq.${conversationId}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,sender_id,body,created_at&order=created_at.asc&limit=500`);
    const senderIds = [...new Set(messages.map((message) => message.sender_id))];
    const profiles = senderIds.length ? await adminFetch<Array<{ id: string; display_name: string }>>(`rest/v1/profiles?id=in.(${senderIds.join(",")})&select=id,display_name`) : [];
    const names = new Map(profiles.map((profile) => [profile.id, profile.display_name]));
    await adminFetch("rest/v1/admin_account_audit", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ admin_id: admin.user.id, subject_user_id: id, action: "read_conversation", details: `Conversation ${conversationId}` }) });
    return json({ conversation, messages: messages.map((message) => ({ ...message, sender_name: names.get(message.sender_id) ?? "Deleted student" })) });
  } catch (error) { return errorResponse(error); }
}