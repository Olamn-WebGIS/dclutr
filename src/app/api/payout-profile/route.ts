import { BackendError, adminFetch, errorResponse, getAuthContext, json } from "@/lib/server/backend";
import { assertSameOrigin } from "@/lib/server/security";
import { decryptPrivateValue, encryptPrivateValue } from "@/lib/server/secrets";
import { notifyUser } from "@/lib/server/mailer";

type PayoutDetails = { bankName: string; accountName: string; accountNumber: string };
function validate(details: PayoutDetails) {
  const bankName = details.bankName.trim(); const accountName = details.accountName.trim().replace(/\s+/g, " "); const accountNumber = details.accountNumber.replace(/\s/g, "");
  if (bankName.length < 2 || bankName.length > 100 || accountName.length < 3 || accountName.length > 120 || !/^\d{10}$/.test(accountNumber)) throw new BackendError("Enter the bank name, account name, and a valid 10-digit Nigerian account number.");
  return { bankName, accountName, accountNumber };
}

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to view payout details.", 401);
    const listings = await adminFetch<Array<{ id: string }>>(`rest/v1/listings?seller_id=eq.${auth.user.id}&select=id&limit=1`);
    if (!listings.length) return json({ hasPayoutProfile: false });
    const rows = await adminFetch<Array<{ encrypted_details: string; account_last4: string }>>(`rest/v1/seller_payout_profiles?user_id=eq.${auth.user.id}&select=encrypted_details,account_last4`);
    if (!rows[0]) return json({ hasPayoutProfile: false });
    const details = JSON.parse(decryptPrivateValue(rows[0].encrypted_details)) as PayoutDetails;
    return json({ hasPayoutProfile: true, ...details });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to update payout details.", 401);
    const listings = await adminFetch<Array<{ id: string }>>(`rest/v1/listings?seller_id=eq.${auth.user.id}&select=id&limit=1`);
    if (!listings.length) throw new BackendError("Payout details become editable in your profile after your first listing is posted.", 403);
    const details = validate(await request.json() as PayoutDetails);
    await adminFetch("rest/v1/seller_payout_profiles?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: auth.user.id, encrypted_details: encryptPrivateValue(JSON.stringify(details)), account_last4: details.accountNumber.slice(-4), updated_at: new Date().toISOString() }) });
    await notifyUser(auth.user.id, "Your D_clutr payout account changed", `Your seller payout account was updated. The account number on file ends in ${details.accountNumber.slice(-4)}. Contact the D_clutr administrator immediately if you did not make this change.`, `payout-account-updated:${auth.user.id}:${Date.now()}`);
    return json({ ok: true, message: "Payout details were saved encrypted. Only you and authorized payout admins can access them." });
  } catch (error) { return errorResponse(error); }
}

