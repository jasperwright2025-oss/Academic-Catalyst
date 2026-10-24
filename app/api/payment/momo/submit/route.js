import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MOMO_PROVIDER_LIST, MOMO_WINDOW_MS, isMomoRef, momoCreatedMs, cleanTransactionId } from "@/lib/payments/momo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payment/momo/submit   body: { "tx_ref": "momo-...", "transaction_id": "..." }
 * The customer says they have paid and gives the transaction ID from the SMS.
 * The order then waits for the owner to approve it. No credits are given here.
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized. Login required." }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Request body must be valid JSON." }, { status: 400 });
    }

    const txRef = body?.tx_ref;
    const transactionId = cleanTransactionId(body?.transaction_id);
    if (!isMomoRef(txRef)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Invalid order reference." }, { status: 400 });
    }
    if (!transactionId) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Please enter the transaction ID exactly as shown in your confirmation message (6 to 40 letters or digits)." },
        { status: 400 }
      );
    }
    if (Date.now() > momoCreatedMs(txRef) + MOMO_WINDOW_MS) {
      return NextResponse.json({ error: "EXPIRED", message: "This order has expired. Please start a new one." }, { status: 410 });
    }

    const { data: updated, error } = await createAdminClient()
      .from("transactions")
      .update({ status: "awaiting_review", provider_reference: transactionId })
      .eq("tx_ref", txRef)
      .eq("user_id", user.id)
      .in("provider", MOMO_PROVIDER_LIST)
      .eq("status", "pending")
      .select("tx_ref");

    if (error) {
      // A transaction ID can only ever be used for one order.
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "DUPLICATE", message: "This transaction ID has already been submitted." },
          { status: 409 }
        );
      }
      throw error;
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "This order was not found, or it was already submitted." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, state: "awaiting_review" });
  } catch (error) {
    console.error("Mobile money submit error:", error);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not submit the transaction ID." }, { status: 500 });
  }
}
