"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

export function Providers({ children }: { children: ReactNode }) {
  if (!pk) return children;
  return <ClerkProvider publishableKey={pk}>{children}</ClerkProvider>;
}
