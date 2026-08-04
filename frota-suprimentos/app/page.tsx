import { redirect } from "next/navigation";

import { getCurrentProfile, ROLE_HOME } from "@/lib/auth/profile";

export default async function RootPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  redirect(ROLE_HOME[profile.role]);
}
