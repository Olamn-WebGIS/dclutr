import Link from "next/link";

export default function NotFound() {
  return <section className="order-success"><span className="eyebrow" style={{ justifyContent: "center" }}>A LITTLE DETOUR</span><h1>We can’t find this page.</h1><p>Let’s get you back to D_clutr to browse items.</p><Link className="button button-dark" href="/market">Browse D_clutr items</Link></section>;
}
