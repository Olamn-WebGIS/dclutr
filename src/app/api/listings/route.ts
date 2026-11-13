import { BackendError, adminFetch, errorResponse, getAuthContext, json } from "@/lib/server/backend";
import { assertSameOrigin, requireImage } from "@/lib/server/security";
import { uploadFile } from "@/lib/server/storage";
import { encryptPrivateValue } from "@/lib/server/secrets";
import { notifyUser } from "@/lib/server/mailer";
import { purgeExpiredListings } from "@/lib/server/listing-cleanup";
import { recordMarketplaceEventSafely } from "@/lib/server/marketplace-analytics";
import { isPhoneOrLaptopListing, prohibitedListingMessage } from "@/lib/listing-restrictions";

const listingSelect = "id,seller_id,title,description,category,condition,price_ngn,negotiable,meetup_area,photo_paths,status,created_at,expires_at,seller:profiles!listings_seller_id_fkey(display_name,verification_status)";

export async function GET(request: Request) {
  try {
    await purgeExpiredListings();
    const search = new URL(request.url).searchParams;
    const limit = parseBoundedInteger(search.get("limit"), 100, 1, 100, "limit");
    const offset = parseBoundedInteger(search.get("offset"), 0, 0, 10000, "offset");
    const filters = ["status=in.(active,sold)", `select=${encodeURIComponent(listingSelect)}`];
    const category = search.get("category");
    const term = search.get("q")?.trim().slice(0, 60).replace(/[(),.*%_]/g, " ");
    const sort = search.get("sort");
    if (sort === "low") filters.push("order=price_ngn.asc,id.asc");
    else if (sort === "high") filters.push("order=price_ngn.desc,id.desc");
    else filters.push("order=created_at.desc,id.desc");
    if (category && category !== "Everything") filters.push(`category=eq.${encodeURIComponent(category)}`);
    if (term) filters.push(`or=${encodeURIComponent(`(title.ilike.*${term}*,description.ilike.*${term}*,category.ilike.*${term}*,meetup_area.ilike.*${term}*)`)}`);
    filters.push(`limit=${limit + 1}`, `offset=${offset}`);
    const rows = await adminFetch<Array<Record<string, unknown> & { id: string; seller: { display_name: string; verification_status: string }; photo_paths: string[] }>>(`rest/v1/listings?${filters.join("&")}`);
    const auth = await getAuthContext();
    if (auth) await recordMarketplaceEventSafely({ userId: auth.user.id, event: "market_visit" });
    return json({ hasMore: rows.length > limit, listings: rows.slice(0, limit).map((row) => ({
      ...row,
      name: row.title,
      price: row.price_ngn,
      originalPrice: row.price_ngn,
      sellerId: row.seller_id,
      negotiable: row.negotiable,
      description: row.description,
      location: row.meetup_area,
      sellerName: row.seller?.display_name || "FUTA student",
      seller: row.seller?.display_name || "FUTA student",
      sellerVerified: row.seller?.verification_status === "approved",
      initials: (row.seller?.display_name || "FUTA student").split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase(),
      color: "sage",
      icon: "◉",
      imageUrl: row.photo_paths?.[0] ? publicImageUrl(row.photo_paths[0]) : null,
    })) });
  } catch (error) { return errorResponse(error); }
}

function parseBoundedInteger(value: string | null, fallback: number, min: number, max: number, name: string) {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new BackendError(`The ${name} value is invalid.`, 400);
  }
  return parsed;
}

function publicImageUrl(path: string) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  return base ? `${base}/storage/v1/object/public/listing-images/${path.split("/").map(encodeURIComponent).join("/")}` : null;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in before creating a listing.", 401);
    if (auth.profile.posting_restricted) throw new BackendError("This account is restricted from posting listings. Contact D_clutr support for assistance.", 403);
    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const category = String(form.get("category") ?? "");
    const condition = String(form.get("condition") ?? "");
    const price = Number(form.get("price"));
    const hostelName = String(form.get("hostelName") ?? "").trim();
    const itemAddress = String(form.get("itemAddress") ?? "").trim();
    const meetupAreaValue = String(form.get("meetupArea") ?? "").trim();
    const meetupArea = [hostelName, itemAddress, meetupAreaValue].filter(Boolean).join(" • ");
    const negotiable = form.get("negotiable") === "true";
    if (isPhoneOrLaptopListing(title, description)) throw new BackendError(prohibitedListingMessage, 400);
    const payoutProfiles = await adminFetch<Array<{ user_id: string }>>(`rest/v1/seller_payout_profiles?user_id=eq.${auth.user.id}&select=user_id`);
    const allowedCategories = new Set(["Campus essentials", "Furniture", "Home appliances", "Others"]);
    const allowedConditions = new Set(["Like New", "Good Condition", "Fairly Used", "Used"]);
    const allowedMeetupLocations = new Set(["Main Campus", "North Gate", "South Gate", "West Gate"]);
    const files = form.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (title.length < 3 || title.length > 100 || description.length < 10 || description.length > 3000 || !allowedCategories.has(category) || !allowedConditions.has(condition) || !Number.isSafeInteger(price) || price < 100 || hostelName.length < 2 || hostelName.length > 80 || !allowedMeetupLocations.has(itemAddress) || !meetupArea || meetupArea.length > 200 || files.length < 1 || files.length > 5) {
      throw new BackendError("Add a valid title, description, price, hostel name, pickup location, and 1–5 photos.");
    }
    let payoutDetails: { bankName: string; accountName: string; accountNumber: string } | null = null;
    if (!payoutProfiles.length) {
      const bankName = String(form.get("bankName") ?? "").trim();
      const accountName = String(form.get("accountName") ?? "").trim().replace(/\s+/g, " ");
      const accountNumber = String(form.get("accountNumber") ?? "").replace(/\s/g, "");
      if (bankName.length < 2 || bankName.length > 100 || accountName.length < 3 || accountName.length > 120 || !/^\d{10}$/.test(accountNumber)) throw new BackendError("For your first listing, add a bank name, account name, and valid 10-digit Nigerian account number for payouts.");
      payoutDetails = { bankName, accountName, accountNumber };
    }
    for (const file of files) await requireImage(file);
    const photoPaths = [];
    for (const file of files) {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
      await uploadFile("listing-images", path, file, true);
      photoPaths.push(path);
    }
    const rows = await adminFetch<Array<{ id: string; expires_at: string }>>("rest/v1/listings?select=id,expires_at", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ seller_id: auth.user.id, title, description, category, condition, price_ngn: price, negotiable, meetup_area: meetupArea, photo_paths: photoPaths }),
    });
    if (payoutDetails) await adminFetch("rest/v1/seller_payout_profiles?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: auth.user.id, encrypted_details: encryptPrivateValue(JSON.stringify(payoutDetails)), account_last4: payoutDetails.accountNumber.slice(-4) }) });
    if (payoutDetails) await notifyUser(auth.user.id, "Payout details saved on D_clutr", `Your first listing was published and an encrypted seller payout account ending in ${payoutDetails.accountNumber.slice(-4)} was saved. You can review or update it from your profile.`, `payout-account-created:${auth.user.id}`);
    if (rows[0]) {
      await recordMarketplaceEventSafely({ userId: auth.user.id, event: "listing_created", entityId: rows[0].id });
      await notifyUser(auth.user.id, "Your D_clutr listing is live", `“${title}” is now live in the FUTA marketplace. It expires in seven days if unsold. When it expires, it is removed and you can create a fresh listing from your profile.`, `listing-created:${rows[0].id}`);
    }
    return json({ ok: true, listing: rows[0], message: "Your listing is live for seven days." }, 201);
  } catch (error) { return errorResponse(error); }
}
