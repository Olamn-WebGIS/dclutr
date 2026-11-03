import { PageShell } from "@/components/page-shell";

export default function PrivacyPage() {
  return (
    <PageShell>
      <article className="legal-copy">
        <span className="eyebrow">YOUR INFORMATION</span>
        <h1>Privacy.</h1>
        <h2>What we collect</h2>
        <p>We collect your name and email, your posts and photos, offers, messages, order and payment references, dispute reports, and account activity. For seller verification, we collect a photo of your FUTA ID and a selfie. We store a protected version of your password, not the password itself. Your bank name, account name, and account number are encrypted before storage. Payments are handled on our secure payment page; D_clutr does not ask for your card PIN, password, or full card details. Zoho Mail sends account and order emails when enabled.</p>
        <h2>Who can see your information</h2>
        <p>You can see your own profile and activity, plus the chats and orders you take part in. Your item photos are public. Only you and authorized D_clutr team members can access your verification documents through temporary private links. Your bank details are visible to you and authorized payout team members only when a payout is due. Trusted providers help us run the marketplace, process payments, and send emails.</p>
        <h2>How long we keep it</h2>
        <p>Chat messages are deleted after 30 days. Password reset links expire after 30 minutes. We don’t currently automatically delete student ID or selfie files or bank details. Email <a className="contact-email" href="mailto:admin@dclutr.com.ng">admin@dclutr.com.ng</a> to ask for access to, correction of, or deletion of your information. We may need to keep some transaction records when required by law.</p>
        <h2>Questions?</h2>
        <p>For privacy questions or requests, email <a className="contact-email" href="mailto:admin@dclutr.com.ng">admin@dclutr.com.ng</a>. For general support, email <a className="contact-email" href="mailto:notification@dclutr.com.ng">notification@dclutr.com.ng</a>.</p>
      </article>
    </PageShell>
  );
}
