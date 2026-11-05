"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function HomeFooter({ children }: { children: ReactNode }) {
  return usePathname() === "/" ? children : null;
}