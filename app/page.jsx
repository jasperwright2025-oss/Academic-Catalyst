import { redirect } from "next/navigation";

// The site root has no page of its own yet, so send visitors to the dashboard.
// Middleware sends signed-out visitors on to /login.
export default function Home() {
  redirect("/dashboard");
}
