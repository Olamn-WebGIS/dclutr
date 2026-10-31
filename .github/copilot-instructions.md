# D_clutr marketplace

- This is a Next.js App Router application using TypeScript, React, Tailwind CSS v4, and npm.
- D_clutr is for students of the Federal University of Technology, Akure (FUTA); use Akure context and Nigerian naira (NGN).
- Keep the visual system calm and editorial: warm off-white surfaces, sage accents, deep forest-green actions, and accessible contrast.
- Prefer reusable components and semantic HTML. Ensure interactive controls work on touch and keyboard.
- D_clutr manages passwords itself with salted scrypt hashes and signed HttpOnly sessions; do not use Supabase Auth or ever email a password. Password recovery sends a one-time reset link.
- Supabase is the database/storage contract. Keep service-role, Paystack, SMTP, session-signing, and encryption secrets server-only; never add them to client components or `NEXT_PUBLIC_*` variables.
- Seller verification documents are private; expose them only to the owner and authorized admins using short-lived signed URLs.
- Seller bank details and sensitive email content are encrypted at rest; expose bank details to admins only when a payout is due.
- Payment status must come from the verified Paystack webhook. Display the 2% buyer fee and 5% seller fee. Seller payouts are manual; do not represent this as licensed escrow or automatic transfers.
- Chat is text-only, enforce contact/off-platform filters server-side, and expire messages after 30 days.
- Treat listing data as live only when returned by the backend; do not seed fake offers.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` when practical after changes.
