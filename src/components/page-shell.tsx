import type { ReactNode } from "react";

export function PageHead({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <div className="page-head"><span className="eyebrow">{eyebrow ?? "D_CLUTR MARKETPLACE"}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>;
}

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="wrap">{children}</div>;
}
