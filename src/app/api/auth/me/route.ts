import { errorResponse, getAuthContext, json } from "@/lib/server/backend";

export async function GET() {
  try {
    const auth = await getAuthContext();
    // Anonymous visitors are a normal state for the site header; return a successful empty session.
    if (!auth) return json({ user: null });
    return json({ user: { id: auth.user.id, email: auth.user.email, profile: auth.profile } });
  } catch (error) { return errorResponse(error); }
}
