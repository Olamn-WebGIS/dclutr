import { PageShell } from "@/components/page-shell";

export default function TermsPage() {
  return (
    <PageShell>
      <article className="legal-copy">
        <span className="eyebrow">THE IMPORTANT BITS</span>
        <h1>D_clutr guidelines.</h1>
        <h2>Listings and accounts</h2>
        <p>Accounts are for FUTA students. Sellers must submit their own student ID and selfie for review. List only items you may lawfully sell, describe condition honestly using Like New, Good Condition, Fairly Used, or Used, and set a fair price. Unsold listings expire after seven days and are removed from the marketplace; a new listing must be created if the seller wants to relist the item.</p>
        <h2>Offers and exchange terms</h2>
        <p>An accepted offer opens a conversation. Both buyer and seller must confirm the item, condition, naira amount, and agreed public meetup before payment becomes available. D_clutr chat is text-only; contact details, bank details, links, and attempts to move a transaction off-platform are blocked. Do not share passwords, reset links, or verification codes.</p>
        <h2>Payments, fees, delivery, and seller payouts</h2>
        <p>The buyer pays the agreed item price plus a 2% buyer platform fee. The seller&apos;s payout is the item price less a 5% seller fee. Paystack&apos;s processing charges may also affect the merchant settlement. Configured Paystack checkout collects payment to the marketplace merchant account; this is not a licensed escrow service. After delivery, the buyer provides the six-digit confirmation code. An admin manually processes the seller payout after one business day, subject to disputes and applicable rules. Refunds are currently handled manually by the admin through the payment provider.</p>
        <h2>Disputes and safety</h2>
        <p>Either participant may open a dispute for an eligible paid order. Admin review may pause the payout. Meet in a busy public place in Akure, consider bringing a friend, inspect an item before confirming delivery, and report suspicious behavior. D_clutr does not guarantee item quality, seller conduct, or a particular sale outcome.</p>
        <h2>Privacy and retention</h2>
        <p>Account, order, support, and verification information is used to operate the service, prevent fraud, and meet legal obligations. Chat messages are automatically deleted after 30 days. Verification documents are private and accessible only to the account owner and authorized admins; the business owner must publish a clear retention period before real launch. Contact the operator for access, correction, or deletion requests subject to legal and transaction records.</p>
        <h2>Contact</h2>
        <p>For platform support, email <a href="mailto:notification@dclutr.com.ng">notification@dclutr.com.ng</a>. For administrative matters, email <a href="mailto:admin@dclutr.com.ng">admin@dclutr.com.ng</a>.</p>
      </article>
    </PageShell>
  );
}
