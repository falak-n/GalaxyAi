import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const uid = await getUserId();
  if (uid) redirect("/workflow");
  redirect("/sign-in");
}
