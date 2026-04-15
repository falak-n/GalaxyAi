import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextMiddleware } from "next/server";

const isProtected = createRouteMatcher([
  "/workflow(.*)",
  "/api/workflows(.*)",
  "/api/runs(.*)",
  "/api/transloadit(.*)",
]);

const clerkMw = clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

/** Both keys required — publishable-only breaks `auth.protect()` and causes 500s. */
const useClerk =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) &&
  Boolean(process.env.CLERK_SECRET_KEY?.trim());

const blockedWithoutClerk: NextMiddleware = (req) => {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Clerk is required. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY." },
      { status: 503 },
    );
  }
  return NextResponse.redirect(new URL("/sign-in", req.url));
};

export const proxy = useClerk ? clerkMw : blockedWithoutClerk;

export const config = {
  matcher: [
    "/workflow(.*)",
    "/api/workflows(.*)",
    "/api/runs(.*)",
    "/api/transloadit(.*)",
  ],
};
