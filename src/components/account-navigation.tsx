"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Account = { profile: { role: string } };

export function AccountNavigation() {
  const [account, setAccount] = useState<Account | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    const refresh = () => { fetch("/api/auth/me").then(async (response) => response.ok ? response.json() : null).then((data) => setAccount(data?.user ?? null)).catch(() => setAccount(null)); };
    refresh();
    window.addEventListener("dclutr:auth-change", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("dclutr:auth-change", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  if (!account) return <Link className="nav-signin" href="/auth">Log in</Link>;
  return <><Link className={`nav-signin nav-account-link${pathname === "/profile" || pathname.startsWith("/profile/") ? " is-active" : ""}`} href="/profile" aria-label="My account" aria-current={pathname === "/profile" || pathname.startsWith("/profile/") ? "page" : undefined}><span className="nav-account-label">My account</span><UserRound className="nav-account-icon" size={18} strokeWidth={1.7} /></Link>{account.profile.role === "admin" && <Link className="nav-sell" href="/admin">Admin</Link>}</>;
}
