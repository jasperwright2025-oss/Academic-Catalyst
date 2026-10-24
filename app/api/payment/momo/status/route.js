import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MOMO_PROVIDER_LIST, isMomoRef } from "@/lib/payments/momo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/payment/momo/status?tx_ref=momo-...  ->  { state: pending | awaiting_review | paid | rejected | failed }
export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized. Login required." }, { status: 401 });
    }

    const txRef = request.nextUrl.searchParams.get("tx_ref");
    if (!isMomoRef(txRef)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "A valid tx_ref is required." }, { status: 400 });
    }

    const { data: row, error } = await createAdminClient()
      .from("transactions")
      .select("status")
      .eq("tx_ref", txRef)
      .eq("user_id", user.id)
      .in("provider", MOMO_PROVIDER_LIST)
      .maybeSingle();

    if (error) throw error;
    if (!row) return NextResponse.json({ error: "NOT_FOUND", message: "Order not found." }, { status: 404 });

    const map = { successful: "paid", awaiting_review: "awaiting_review", pending: "pending", rejected: "rejected" };
    return NextResponse.json({ success: true, state: map[row.status] || "failed" });
  } catch (error) {
    console.error("Mobile money status error:", error);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not check the payment." }, { status: 500 });
  }
}
