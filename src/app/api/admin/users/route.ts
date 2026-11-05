import { adminFetch, errorResponse, json, requireAdmin } from "@/lib/server/backend";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80).replace(/[(),.*]/g, " ");
    const filters = ["role=eq.student", "select=id,display_name,email,verification_status,created_at,account_banned,posting_restricted,account_deleted", "order=created_at.desc", "limit=100"];
    if (query) filters.push(`or=${encodeURIComponent(`(display_name.ilike.*${query}*,email.ilike.*${query}*)`)}`);
    const users = await adminFetch<Array<Record<string, unknown>>>(`rest/v1/profiles?${filters.join("&")}`);
    return json({ users });
  } catch (error) { return errorResponse(error); }
}