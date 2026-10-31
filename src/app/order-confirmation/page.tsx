import Link from "next/link";
import { Check } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export default function OrderConfirmationPage() {
  return <PageShell><section className="order-success"><span className="success-icon"><Check size={27} /></span><span className="eyebrow" style={{ justifyContent: "center", marginTop: 25 }}>PAYMENT STATUS</span><h1>Checking your payment.</h1><p>Paystack sends payment confirmation to D_clutr securely. Check your order conversation for the confirmed payment status before arranging delivery.</p><Link className="button button-dark" href="/checkout">View orders <span aria-hidden="true">→</span></Link></section></PageShell>;
}
