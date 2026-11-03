import Link from "next/link";
import { Check } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export default function OrderConfirmationPage() {
  return <PageShell><section className="order-success"><span className="success-icon"><Check size={27} /></span><span className="eyebrow" style={{ justifyContent: "center", marginTop: 25 }}>YOUR ORDER</span><h1>We’re checking your payment.</h1><p>We’ll update your order chat as soon as we confirm your payment. Please wait for that confirmation before arranging handover.</p><Link className="button button-dark" href="/checkout">See your orders <span aria-hidden="true">→</span></Link></section></PageShell>;
}
