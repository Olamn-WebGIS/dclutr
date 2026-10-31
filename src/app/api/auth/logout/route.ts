import { clearSession, errorResponse, json } from "@/lib/server/backend";
import { assertSameOrigin } from "@/lib/server/security";

export async function POST(request: Request) {
  try { assertSameOrigin(request); await clearSession(); return json({ ok: true }); }
  catch (error) { return errorResponse(error); }
}
