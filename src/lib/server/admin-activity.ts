import "server-only";
import { adminFetch, type AuthContext } from "@/lib/server/backend";

type AdminActivity = {
  action: string;
  subject?: { id: string; name: string; email?: string } | null;
  details?: string | null;
};

export async function logAdminActivity(admin: AuthContext, activity: AdminActivity) {
  await adminFetch("rest/v1/admin_activity_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_id: admin.user.id,
      actor_name: admin.profile.display_name,
      actor_email: admin.user.email,
      action: activity.action,
      subject_user_id: activity.subject?.id ?? null,
      subject_name: activity.subject?.name ?? null,
      subject_email: activity.subject?.email || null,
      details: activity.details?.slice(0, 500) ?? null,
    }),
  });
}
