import Link from "next/link";
import { Leaf, Recycle, UsersRound } from "lucide-react";
import { PageHead, PageShell } from "@/components/page-shell";

export default function AboutPage() {
  return <PageShell><PageHead eyebrow="A SMALL IDEA WITH A LOT OF HEART" title="Good things deserve another go." description="Find affordable pre-loved essentials and pass useful things on to other FUTA students." /><section className="content-card"><h2>Made for campus life.</h2><p>Find study materials, room essentials, and everyday items from other FUTA students around campus and Akure.</p><p>Buy and sell secondhand with less stress. Save where you can, give useful things a new home, and meet up somewhere public and busy.</p><div className="verify-steps"><div className="verify-step"><Recycle size={20} /><b>Keep useful things moving</b><p>sell on items another student can use.</p></div><div className="verify-step"><UsersRound size={20} /><b>Trade with other students</b><p>Meet people from the FUTA community.</p></div><div className="verify-step"><Leaf size={20} /><b>Choose a lighter way</b><p>Shop thoughtfully, one item at a time.</p></div></div><Link className="button button-dark" href="/market">Browse D_clutr items</Link></section></PageShell>;
}
