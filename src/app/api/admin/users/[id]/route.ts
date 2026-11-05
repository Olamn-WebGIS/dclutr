import { BackendError, adminFetch, errorResponse, json, requireAdmin, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { deleteStorageObject } from "@/lib/server/storage";

type ModerationAction = "ban" | "unban" | "restrict_posting" | "allow_posting";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    assertUuid(id);
    const profiles = await adminFetch<Array<Record<string, unknown>>>(`rest/v1/profiles?id=eq.${id}&role=eq.student&select=id,display_name,email,verification_status,created_at,account_banned,account_banned_at,posting_restricted,posting_restricted_at,account_deleted,account_deleted_at,account_moderation_note`);
    const profile = profiles[0];
    if (!profile) throw new BackendError("Student account not found.", 404);
    const [listings, conversations] = await Promise.all([
      adminFetch<Array<Record<string, unknown>>>(`rest/v1/listings?seller_id=eq.${id}&select=id,title,category,condition,price_ngn,status,created_at&order=created_at.desc&limit=100`),
      adminFetch<Array<{ id: string; listing_id: string | null; listing_title_snapshot: string; buyer_id: string; seller_id: string; created_at: string; last_message_at: string }>>(`rest/v1/conversations?or=${encodeURIComponent(`(buyer_id.eq.${id},seller_id.eq.${id})`)}&select=id,listing_id,listing_title_snapshot,buyer_id,seller_id,created_at,last_message_at&order=last_message_at.desc&limit=100`),
    ]);
    const otherIds = [...new Set(conversations.map((conversation) => conversation.buyer_id === id ? conversation.seller_id : conversation.buyer_id))];
    const others = otherIds.length ? await adminFetch<Array<{ id: string; display_name: string }>>(`rest/v1/profiles?id=in.(${otherIds.join(",")})&select=id,display_name`) : [];
    const names = new Map(others.map((other) => [other.id, other.display_name]));
    return json({
      profile,
      listings,
      conversations: conversations.map((conversation) => ({
        ...conversation,
        other_user_id: conversation.buyer_id === id ? conversation.seller_id : conversation.buyer_id,
        other_name: names.get(conversation.buyer_id === id ? conversation.seller_id : conversation.buyer_id) ?? "Student",
      })),
    });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { id } = await params;
    assertUuid(id);
    if (id === admin.user.id) throw new BackendError("You can’t moderate your own admin account.", 409);
    const body = await request.json() as { action?: ModerationAction; note?: string };
    if (!["ban", "unban", "restrict_posting", "allow_posting"].includes(body.action ?? "")) throw new BackendError("Choose a valid account action.");
    const profiles = await adminFetch<Array<{ id: string; role: string; account_deleted: boolean }>>(`rest/v1/profiles?id=eq.${id}&select=id,role,account_deleted`);
    const profile = profiles[0];
    if (!profile || profile.role !== "student") throw new BackendError("Student account not found.", 404);
    if (profile.account_deleted) throw new BackendError("This account has already been deleted.", 409);
    const action = body.action as ModerationAction;
    if ((body.note?.length ?? 0) > 500) throw new BackendError("The moderation note must be 500 characters or fewer.");
    const now = new Date().toISOString();
    const changes = action === "ban" ? { account_banned: true, account_banned_at: now }
      : action === "unban" ? { account_banned: false, account_banned_at: null }
      : action === "restrict_posting" ? { posting_restricted: true, posting_restricted_at: now }
      : { posting_restricted: false, posting_restricted_at: null };
    await adminFetch(`rest/v1/profiles?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...changes, account_moderation_note: body.note?.trim() || null }) });
    await adminFetch("rest/v1/admin_account_audit", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ admin_id: admin.user.id, subject_user_id: id, action, details: body.note?.trim() || null }) });
    return json({ ok: true, message: action === "ban" ? "Account banned." : action === "unban" ? "Account unbanned." : action === "restrict_posting" ? "Posting restricted." : "Posting access restored." });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { id } = await params;
    assertUuid(id);
    if (id === admin.user.id) throw new BackendError("You can’t delete your own admin account.", 409);
    const body = await request.json() as { confirmEmail?: string };
    const profiles = await adminFetch<Array<{ id: string; email: string; role: string }>>(`rest/v1/profiles?id=eq.${id}&select=id,email,role`);
    const profile = profiles[0];
    if (!profile || profile.role !== "student") throw new BackendError("Student account not found.", 404);
    if (body.confirmEmail?.trim().toLowerCase() !== profile.email.toLowerCase()) throw new BackendError("Type the student’s email address exactly to confirm account removal.", 400);

    const [listings, verifications] = await Promise.all([
      fetchAllRows<{ photo_paths: string[] }>(`rest/v1/listings?seller_id=eq.${id}&select=photo_paths&order=id.asc`),
      fetchAllRows<{ student_id_path: string; selfie_path: string }>(`rest/v1/verification_submissions?user_id=eq.${id}&select=student_id_path,selfie_path&order=id.asc`),
    ]);
    const storageObjects = new Set([
      ...listings.flatMap((listing) => (listing.photo_paths ?? []).map((path) => `listing-images:${path}`)),
      ...verifications.flatMap((submission) => [
        `verification-documents:${submission.student_id_path}`,
        `verification-documents:${submission.selfie_path}`,
      ]),
    ]);
    for (const object of storageObjects) {
      const separator = object.indexOf(":");
      await deleteStorageObject(object.slice(0, separator), object.slice(separator + 1));
    }

    await userFetch("rest/v1/rpc/admin_delete_student_account", admin.session, { method: "POST", body: JSON.stringify({ p_target_user_id: id, p_actor_id: admin.user.id }) });
    return json({ ok: true, message: "The account and all linked database records, including chats, orders, disputes, and moderation history, were permanently deleted." });
  } catch (error) { return errorResponse(error); }
}

async function fetchAllRows<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const page = await adminFetch<T[]>(`${path}&limit=${pageSize}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}