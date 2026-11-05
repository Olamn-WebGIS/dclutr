import Link from "next/link";
import { ArrowDownRight, ArrowRight, Leaf, Recycle, ShieldCheck, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { LiveProductFeed } from "@/components/live-product-feed";
import { getAuthContext } from "@/lib/server/backend";

export default async function HomePage() {
  if (await getAuthContext()) redirect("/market");
  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={14} /> MADE FOR FUTA, AKURE</span>
          <h1>D_clutr items,<br /><em>second chapters.</em></h1>
          <p>Made for FUTA students in Akure, D_clutr helps you sell on useful things, find affordable used essentials, and connect with students nearby.</p>
          <div className="hero-actions"><Link className="button button-dark" href="/market">Browse D_clutr items <ArrowRight size={17} /></Link><Link className="text-link" href="/sell">Have something you no longer need? <ArrowDownRight size={15} /></Link></div>
          <div className="hero-proof"><div className="avatar-stack"><span>F</span><span>U</span><span>T</span><span>A</span></div><span><strong>Made for FUTA students</strong> · useful items, close by</span></div>
        </div>
        <div className="hero-art" aria-label="A curated collection of pre-loved home goods">
          <div className="art-sun" /><div className="art-vase">♧</div><div className="art-lamp"><i /></div><div className="art-book">GOOD<br />THINGS</div><span className="art-sticker">made for<br />a second life <Leaf size={17} /></span><span className="art-caption">FIND YOUR NEXT FAVOURITE</span>
        </div>
      </section>

      <section className="trust-strip"><div><Recycle size={19} /><span>Keep useful things in use</span></div><div><ShieldCheck size={19} /><span>Student-to-student exchanges</span></div><div><Leaf size={19} /><span>Find it near campus</span></div></section>

      <section className="section wrap">
        <div className="section-heading"><div><span className="eyebrow">RECENTLY POSTED</span><h2>Items worth <em>keeping.</em></h2></div><Link href="/market" className="text-link">See all D_clutr items <ArrowRight size={16} /></Link></div>
        <LiveProductFeed />
      </section>

      <section className="sell-banner wrap"><div><span className="eyebrow">READY FOR A NEW OWNER?</span><h2>Done with it?<br /><em>Pass it on.</em></h2><p>Give books, room essentials, and everyday items a new home with another FUTA student.</p><Link className="button button-light" href="/sell">Post an item <ArrowRight size={16} /></Link></div><div className="sell-doodle" aria-hidden="true"><div className="doodle-circle">♻</div><span>your preloved<br />era starts here</span></div></section>
      <section className="section wrap values-section"><span className="eyebrow">A MARKETPLACE WITH A LITTLE MORE MEANING</span><h2>Better things find<br /><em>better homes.</em></h2><p>We believe the best things aren’t always brand new. They’re the ones with a story, a little character, and plenty of life left in them.</p><Link className="text-link" href="/about">Get to know us <ArrowRight size={16} /></Link></section>
    </>
  );
}
