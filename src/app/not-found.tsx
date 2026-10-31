import Link from "next/link";

export default function NotFound() {
  return <section className="order-success"><span className="eyebrow" style={{ justifyContent: "center" }}>A LITTLE DETOUR</span><h1>That find got away.</h1><p>We can’t find this page, but there are plenty more lovely things to discover.</p><Link className="button button-dark" href="/market">Back to the market</Link></section>;
}
