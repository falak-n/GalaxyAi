import { SignIn } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/clerkConfigured";

export default function SignInPage() {
  if (!isClerkConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nf-bg px-6">
        <div className="w-full max-w-md rounded-3xl border border-nf-line bg-nf-card p-6 text-center">
          <h1 className="text-lg font-semibold text-nf-text">Clerk Setup Required</h1>
          <p className="mt-2 text-sm leading-relaxed text-nf-muted">
            Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to use authenticated workflow routes.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-nf-bg">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  );
}
