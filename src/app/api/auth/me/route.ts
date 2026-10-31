import { errorResponse, getAuthContext, json } from "@/lib/server/backend";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return json({ user: null }, 401);
    return json({ user: { id: auth.user.id, email: auth.user.email, profile: auth.profile } });
  } catch (error) { return errorResponse(error); }
}
