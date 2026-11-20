"use client";

import type { ReactNode } from "react";
import { useReveal } from "@/components/use-reveal";

/** Client wrapper that animates every `.reveal` descendant on scroll. */
export function RevealSection({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
