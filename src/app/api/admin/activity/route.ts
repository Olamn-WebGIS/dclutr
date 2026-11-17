import { adminFetch, errorResponse, json, requireAdmin } from "@/lib/server/backend";

const ACTIVITY_VIEWER_EMAIL = "admin@dclutr.com.ng";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.user.email.toLowerCase() !== ACTIVITY_VIEWER_EMAIL) {
      return json({ error: "Not found." }, 404);
    }

    const activities = await adminFetch<Array<{
      id: number;
      actor_name: string;
      actor_email: string;
      action: string;
      subject_name: string | null;
      subject_email: string | null;
      details: string | null;
      created_at: string;
    }>>("rest/v1/admin_activity_log?select=id,actor_name,actor_email,action,subject_name,subject_email,details,created_at&order=created_at.desc&limit=100");
    return json({ activities });
  } catch (error) { return errorResponse(error); }
}
