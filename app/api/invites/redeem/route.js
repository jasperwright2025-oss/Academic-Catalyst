import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Redeem an invite code from an existing account (added 23 Nov 2026).
 * One invite per account: a code works once, before it expires, and only for an
 * account that has not redeemed an invite before. It adds one proposal credit.
 */
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "Please sign in first." }, { status: 401 });

  let body = {};
  try {
    body = await request.json();
  } catch {
    // fall through
  }
  const code = String(body.code || "").trim().toUpperCase().slice(0, 32);
  if (!code) return NextResponse.json({ error: "INVALID", message: "Please enter your invite code." }, { status: 400 });

  const admin = createAdminClient();

  const { data: already } = await admin.from("invites").select("code").eq("redeemed_by", user.id).limit(1);
  if (already && already.length) {
    return NextResponse.json(
      { error: "ALREADY_USED", message: "This account has already used an invite. Each account can use one." },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();
  const { data: redeemed, error: redeemError } = await admin
    .from("invites")
    .update({ redeemed_by: user.id, redeemed_at: nowIso })
    .eq("code", code)
    .is("redeemed_by", null)
    .gt("expires_at", nowIso)
    .select("code");
  if (redeemError) {
    console.error("Invite redeem error:", redeemError.message);
    return NextResponse.json({ error: "DATABASE_ERROR", message: "Something went wrong. Please try again." }, { status: 500 });
  }
  if (!redeemed || redeemed.length !== 1) {
    return NextResponse.json(
      { error: "INVALID", message: "That code is not valid. It may have been used already or have expired." },
      { status: 400 }
    );
  }

  const { data: sub, error: subError } = await admin
    .from("subscriptions")
    .select("proposals_remaining, credits_version")
    .eq("user_id", user.id)
    .single();
  const { error: creditError } = subError
    ? { error: subError }
    : await admin
        .from("subscriptions")
        .update({
          proposals_remaining: (sub.proposals_remaining || 0) + 1,
          credits_version: (sub.credits_version || 0) + 1,
        })
        .eq("user_id", user.id)
        .eq("credits_version", sub.credits_version || 0);
  if (creditError) {
    console.error("Invite credit error:", creditError.message);
    await admin.from("invites").update({ redeemed_by: null, redeemed_at: null }).eq("code", code);
    return NextResponse.json({ error: "DATABASE_ERROR", message: "Something went wrong. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Invite accepted. One full proposal credit has been added to your account.",
  });
}
