import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function IndexPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const role = (sessionClaims?.metadata as any)?.role || (sessionClaims as any)?.role || "student";

  if (role === "admin") {
    redirect("/admin/dashboard");
  } else if (role === "scanner") {
    redirect("/scanner");
  } else {
    redirect("/student/home");
  }
}
