import Link from "next/link";
import { Heart, Menu, MessageCircle, ShoppingBag } from "lucide-react";
import { AccountNavigation } from "@/components/account-navigation";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link className="brand" href="/">D_clutr<span className="brand-dot">.</span></Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/market">Shop all</Link>
          <Link href="/market?category=Campus%20essentials">Campus essentials</Link>
          <Link href="/market?category=Furniture">Furniture</Link>
          <Link href="/market?category=Home%20appliances">Home appliances</Link>
        </nav>
        <div className="nav-actions">
          <Link className="nav-sell" href="/sell">Sell an item</Link>
          <Link className="icon-link" href="/favorites" aria-label="Saved items"><Heart size={18} strokeWidth={1.7} /></Link>
          <Link className="icon-link" href="/chat" aria-label="Messages"><MessageCircle size={18} strokeWidth={1.7} /></Link>
          <Link className="icon-link" href="/checkout" aria-label="Bag"><ShoppingBag size={18} strokeWidth={1.7} /></Link>
          <AccountNavigation />
          <Link className="mobile-nav" href="/market" aria-label="Browse market"><Menu size={19} /></Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="brand" href="/">D_clutr<span className="brand-dot">.</span></Link>
          <p>A student marketplace for pre-loved finds around FUTA, Akure.</p>
        </div>
        <div className="footer-col">
          <strong>Explore</strong>
          <Link href="/market">Shop all</Link>
          <Link href="/sell">Sell with us</Link>
          <Link href="/about">Our story</Link>
        </div>
        <div className="footer-col">
          <strong>Your account</strong>
          <Link href="/profile">Profile</Link>
          <Link href="/favorites">Saved finds</Link>
          <Link href="/offers">Offers</Link>
          <Link href="/chat">Messages</Link>
          <Link href="/disputes">Disputes</Link>
        </div>
        <div className="footer-col">
          <strong>Here to help</strong>
          <Link href="/help">Help & FAQs</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 D_clutr. Made for a second life.</span>
        <span>Small finds. Lighter footprint.</span>
      </div>
    </footer>
  );
}
