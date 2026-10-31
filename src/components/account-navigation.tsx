"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Account = { profile: { role: string } };

export function AccountNavigation() {
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    const refresh = () => { fetch("/api/auth/me").then(async (response) => response.ok ? response.json() : null).then((data) => setAccount(data?.user ?? null)).catch(() => setAccount(null)); };
    refresh();
    window.addEventListener("dclutr:auth-change", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("dclutr:auth-change", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  if (!account) return <Link className="nav-signin" href="/auth">Log in</Link>;
  return <><Link className="nav-signin" href="/profile">My account</Link>{account.profile.role === "admin" && <Link className="nav-sell" href="/admin">Admin</Link>}</>;
}
