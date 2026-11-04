import { BackendError, adminFetch, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, requireImage } from "@/lib/server/security";
import { uploadFile } from "@/lib/server/storage";
import { notifyAdmin } from "@/lib/server/mailer";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return json({ error: "Please sign in." }, 401);
    const rows = await userFetch<Array<{ id: string; status: string; rejection_reason: string | null; submitted_at: string }>>(
      `rest/v1/verification_submissions?user_id=eq.${auth.user.id}&select=id,status,rejection_reason,submitted_at&order=submitted_at.desc&limit=1`, auth.session,
    );
    const submission = rows[0] ?? null;
    return json({ submission, verificationStatus: submission?.status ?? auth.profile.verification_status });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Please sign in to submit seller verification.", 401);
    if (auth.profile.verification_status === "approved") throw new BackendError("Your seller account is already verified.", 409);
    if (auth.profile.verification_status === "pending") throw new BackendError("Your seller verification is already waiting for review.", 409);
    const form = await request.formData();
    const studentId = form.get("studentId");
    const selfie = form.get("selfie");
    if (!(studentId instanceof File) || !(selfie instanceof File)) throw new BackendError("Upload both your FUTA student ID and a clear selfie.");
    await requireImage(studentId); await requireImage(selfie);
    const ext = (file: File) => file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const idPath = `${auth.user.id}/${crypto.randomUUID()}-student-id.${ext(studentId)}`;
    const selfiePath = `${auth.user.id}/${crypto.randomUUID()}-selfie.${ext(selfie)}`;
    await uploadFile("verification-documents", idPath, studentId);
    await uploadFile("verification-documents", selfiePath, selfie);
    const submissions = await adminFetch<Array<{ id: string }>>("rest/v1/verification_submissions?select=id", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ user_id: auth.user.id, student_id_path: idPath, selfie_path: selfiePath, status: "pending", rejection_reason: null }),
    });
    await adminFetch(`rest/v1/profiles?id=eq.${auth.user.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ verification_status: "pending" }),
    });
    await notifyAdmin("D_clutr seller verification submitted", `A FUTA seller verification is ready for review. Student profile ID: ${auth.user.id}. Sign in to the admin dashboard to review the private student ID and selfie.`, `verification-submitted:${submissions[0]?.id}`);
    return json({ ok: true, message: "Your verification is submitted for admin review." }, 201);
  } catch (error) { return errorResponse(error); }
}
