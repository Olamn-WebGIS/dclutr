import { BackendError, errorResponse } from "@/lib/server/backend";
import { assertSameOrigin } from "@/lib/server/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    throw new BackendError("Reposting is disabled. Expired listings are removed and must be relisted from scratch.", 410);
  } catch (error) { return errorResponse(error); }
}
