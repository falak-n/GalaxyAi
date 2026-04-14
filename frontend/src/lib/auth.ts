import { auth } from "@clerk/nextjs/server";
import { isClerkConfigured } from "./clerkConfigured";

export async function getUserId(): Promise<string | null> {
  if (!isClerkConfigured()) return null;
  try {
    const { userId } = await auth();
    return userId;
  } catch {
    return null;
  }
}
