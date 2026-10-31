# D_clutr

D_clutr is a student-to-student marketplace for the Federal University of Technology, Akure (FUTA). It is built with Next.js App Router, TypeScript, Tailwind CSS v4, and Supabase Postgres/Storage. **User signup and login are D_clutr-managed; Supabase Auth is not used.** Passwords are stored only as salted scrypt hashes.

## Required setup before real accounts or money

This workspace does not contain your Supabase, Paystack, or Zoho credentials. Never paste secrets into chat or commit `.env.local`.

1. Create a new Supabase project. Review and run [the initial marketplace migration](supabase/migrations/202610310001_initial_marketplace.sql) once on that empty project. It creates D_clutr accounts, profiles, marketplace/order tables, private document storage, RLS, rate-limit functions, seven-day listing expiry, and 30-day message deletion. The migration is for a fresh database, not an upgrade to an existing deployment.
2. Copy `.env.example` to `.env.local` and set:
   - Supabase project URL and **service-role key**. The app uses that key only in server routes; do not expose it as `NEXT_PUBLIC_*`.
   - A random `SESSION_SECRET` (at least 32 bytes) to sign HttpOnly D_clutr login cookies.
   - A separate random 32-byte `ACCOUNT_ENCRYPTION_KEY` for seller bank information and queued email bodies.
   - Paystack **test** secret key and local/production `NEXT_PUBLIC_APP_URL`.
   - When you have Zoho Mail details, configure `SMTP_HOST`, port `465`, SMTP username, Zoho app password, `SMTP_FROM`, and `ADMIN_NOTIFICATION_EMAIL`. Do not use your regular Zoho password. Until configured, email notices remain queued and are not delivered.
   - `CRON_SECRET` for scheduled processing.
3. Create your first user through D_clutr signup. Promote only your own profile to admin in Supabase SQL Editor after checking its email:

   `update public.profiles set role = 'admin' where lower(email) = lower('YOUR_ADMIN_EMAIL');`

   There is no default admin or public admin-signup path.
4. Start with Paystack test credentials and configure the signed webhook at `https://YOUR_DOMAIN/api/payments/webhook` for `charge.success`. A redirect from Paystack is not proof of payment; the signed webhook is the source of truth.
5. Enable Supabase `pg_cron` and confirm the scheduled jobs for seven-day listing expiry, 30-day message deletion, and outbox cleanup. Configure an external scheduler to call `GET /api/cron/email-outbox` with `Authorization: Bearer $CRON_SECRET` every few minutes. Add Nigerian public holidays to `public.business_holidays` for payout-day calculations.
6. Run `npm install`, `npm run typecheck`, then `npm run dev`. ESLint is already configured; if setting it up in a fresh project, install it with `npm install --save-dev eslint eslint-config-next @eslint/eslintrc`. Configure HTTPS, monitoring, backups, SMTP, Paystack, and cron before inviting students.

## Implemented workflows

- D_clutr signup stores a random-salted scrypt password hash in Supabase; sign-in uses a signed, HttpOnly, SameSite cookie. Login attempts are rate limited. Forgot password emails a single-use, 30-minute reset link. **Passwords are never retrievable or emailed.**
- Sellers upload a FUTA ID and selfie to a private storage bucket. Only the seller and admins can view short-lived signed previews. Admins approve or reject verification; rejection feedback is emailed and appears on the seller page.
- Approved sellers list 1–5 photos, condition (**Like New**, **Good Condition**, **Fairly Used**, **Used**), a price in NGN, meetup area, and optional negotiability. Unsold items expire after seven days. Expired listings are removed; sellers must create a fresh listing manually to relist an item.
- The seller enters payout bank details during their first listing if not already saved. Details are AES-256-GCM encrypted in the database, shown to the seller in their profile after their first listing, and disclosed to admins only for a payout that is due. Set and back up the encryption key securely; losing it makes these details unrecoverable.
- Buyers can send offers on negotiable listings. Seller acceptance starts a private conversation; both sides accept the exchange terms before checkout.
- **Buyer fee: 2%** of the agreed item price, added to the Paystack amount. **Seller fee: 5%** of the item price, deducted from the seller payout. The order and admin dashboard show item price, both fees, buyer total, and seller net. Paystack's own processing charges may also affect the merchant's settlement.
- Paystack collects the buyer total to your merchant account. Only a verified webhook marks the order paid. After dispatch, the buyer generates a six-digit delivery code and gives it to the seller after inspecting the delivered item. The seller confirms the code in chat.
- One business day after confirmed delivery, the payout appears in the admin queue. Seller payouts are manual: send the transfer using your approved process, then record its reference. The app does not collect seller payment credentials in Paystack or initiate automatic transfers.
- Participants can open disputes; the admin reviews and emails both parties. Refunds are currently processed manually through the payment provider.
- Emails are queued in an encrypted outbox for signups, password resets, offers, messages, order/fee/payment changes, delivery, payout, disputes, verification, listing publication, and listing expiry. Zoho delivery requires SMTP credentials and the scheduled outbox job.
- Chat accepts text only. The server blocks links, social handles, contact/phone numbers, bank details, and obvious off-platform transaction attempts. Messages are deleted after 30 days by the scheduled database job.

## Important safety and launch limitations

The chat filter is rule-based and cannot catch every attempt to evade it. Provide reporting/moderation and test it before launch. The admin screen reveals a seller's full bank destination only after a payout is due; protect admin accounts with strong unique passwords and restrict access.

This is **not a licensed escrow service**. Funds are collected to your configured merchant account and held/released manually. Confirm the fee model, holding/release process, refunds, and marketplace arrangement with Paystack and qualified Nigerian legal/accounting advisers before using live keys. Publish an approved privacy/retention policy for student IDs/selfies and financial details before collecting real data. The migration does not yet automatically purge verification documents; define that process before launch.

## Commands

- `npm run dev` — local development server
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm run start` — serve production build
