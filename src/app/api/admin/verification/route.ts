import { BackendError, adminFetch, errorResponse, json, requireAdmin } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { signedStorageUrl } from "@/lib/server/storage";
import { notifyUser } from "@/lib/server/mailer";

export async function GET() {
  try {
    await requireAdmin();
    const submissions = await adminFetch<Array<{ id: string; user_id: string; student_id_path: string; selfie_path: string; submitted_at: string }>>("rest/v1/verification_submissions?status=eq.pending&select=id,user_id,student_id_path,selfie_path,submitted_at&order=submitted_at.asc");
    const queue = await Promise.all(submissions.map(async (submission) => {
      const profiles = await adminFetch<Array<{ display_name: string; email: string }>>(`rest/v1/profiles?id=eq.${submission.user_id}&select=display_name,email`);
      return { id: submission.id, userId: submission.user_id, submittedAt: submission.submitted_at, displayName: profiles[0]?.display_name ?? "Student", email: profiles[0]?.email, studentIdUrl: await signedStorageUrl("verification-documents", submission.student_id_path), selfieUrl: await signedStorageUrl("verification-documents", submission.selfie_path) };
    }));
    return json({ submissions: queue });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { id, decision, reason } = await request.json() as { id?: string; decision?: string; reason?: string };
    if (!id || !["approve", "reject"].includes(decision ?? "")) throw new BackendError("Choose a verification submission and approve or reject it.");
    assertUuid(id);
    if (decision === "reject" && (!reason || reason.trim().length < 10 || reason.trim().length > 1000)) throw new BackendError("Give the student a clear reason (10–1000 characters) so they can try again.");
    const rows = await adminFetch<Array<{ user_id: string }>>(`rest/v1/verification_submissions?id=eq.${id}&status=eq.pending&select=user_id`);
    const submission = rows[0];
    if (!submission) throw new BackendError("This verification is no longer pending.", 404);
    const status = decision === "approve" ? "approved" : "rejected";
    await adminFetch(`rest/v1/verification_submissions?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status, rejection_reason: decision === "reject" ? reason?.trim() : null, reviewed_by: admin.user.id, reviewed_at: new Date().toISOString() }) });
    await adminFetch(`rest/v1/profiles?id=eq.${submission.user_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ verification_status: status }) });
    await adminFetch("rest/v1/notifications", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: submission.user_id, kind: "seller_verification", title: decision === "approve" ? "Seller profile verified" : "Verification needs another try", body: decision === "approve" ? "Your FUTA seller verification was approved. You can now post listings." : reason?.trim() }) });
    await notifyUser(submission.user_id, decision === "approve" ? "Your D_clutr seller profile is verified" : "Your D_clutr verification needs another try", decision === "approve" ? "Your FUTA student seller verification was approved. You can now post listings." : `Your verification was not approved yet. Please review this feedback and resubmit: ${reason?.trim()}`, `verification-review:${id}:${status}`);
    return json({ ok: true, message: decision === "approve" ? "Seller verification approved." : "Feedback sent; the student can resubmit." });
  } catch (error) { return errorResponse(error); }
}
