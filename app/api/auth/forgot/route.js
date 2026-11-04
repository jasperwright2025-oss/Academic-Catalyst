import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/forgot  { email }
 * Sends a password reset link. Always answers the same way, so the page never reveals
 * whether an email address has an account.
 */
export async function POST(request) {
  let email = "";
  try {
    const body = await request.json();
    email = String(body?.email || "").trim().toLowerCase();
  } catch {
    // handled below
  }
  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Please enter a valid email address." }, { status: 400 });
  }

  try {
    const origin = new URL(request.url).origin;
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/api/auth/callback?next=/reset-password`,
    });
    if (error) console.error("Password reset email error:", error.status, error.message);
  } catch (err) {
    console.error("Password reset route error:", err);
  }

  return NextResponse.json({
    success: true,
    message: "If an account exists for that email address, a reset link is on its way. Check your spam folder too.",
  });
}
