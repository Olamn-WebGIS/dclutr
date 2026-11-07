import Link from "next/link";
import { HeaderActions } from "@/components/header-actions";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link className="brand" href="/">D_clutr<span className="brand-dot">.</span></Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/market">Browse D_clutr items</Link>
          <Link href="/market?category=Campus%20essentials">Campus essentials</Link>
          <Link href="/market?category=Furniture">Furniture</Link>
          <Link href="/market?category=Home%20appliances">Home appliances</Link>
        </nav>
        <HeaderActions />
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
          <p>Find pre-loved essentials and pass useful things on to other FUTA students.</p>
        </div>
        <div className="footer-col">
          <strong>Explore</strong>
          <Link href="/market">Browse D_clutr items</Link>
          <Link href="/sell">Post an item</Link>
          <Link href="/about">Our story</Link>
        </div>
        <div className="footer-col">
          <strong>Your account</strong>
          <Link href="/profile">Profile</Link>
          <Link href="/email-preferences">Email preferences</Link>
          <Link href="/favorites">Saved items</Link>
          <Link href="/offers">Offers</Link>
          <Link href="/chat">Messages</Link>
          <Link href="/disputes">Disputes</Link>
        </div>
        <div className="footer-col">
          <strong>Here to help</strong>
          <Link href="/help">Help & FAQs</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href="mailto:notification@dclutr.com.ng">Email support</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 D_clutr. Made for a second life.</span>
        <span>Useful items. Lighter footprint.</span>
      </div>
    </footer>
  );
}
