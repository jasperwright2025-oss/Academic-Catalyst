import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/update-password  { password }
 * Sets a new password for the signed-in user. The reset link signs the user in first.
 */
export async function POST(request) {
  try {
    const { password } = await request.json();
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Your new password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "This reset link has expired. Please request a new one." },
        { status: 401 }
      );
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error("Password update error:", error.status, error.message);
      const weak = /weak|pwned|leaked|characters/i.test(error.message || "");
      return NextResponse.json(
        {
          error: "UPDATE_FAILED",
          message: weak
            ? "Please choose a stronger password that you have not used elsewhere."
            : "We could not change your password. Please request a new reset link.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Password update route error:", err);
    return NextResponse.json({ error: "SERVER_FAULT", message: "We could not change your password." }, { status: 500 });
  }
}
