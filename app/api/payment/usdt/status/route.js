import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fulfilUsdtOrder } from "@/lib/payments/usdt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payment/usdt/status?tx_ref=usdt-...
 * Checks the blockchain for this order's payment. When it has arrived, the credits are granted
 * and the answer is { state: "paid" }. Only the customer's own orders can be checked.
 */
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
    if (!txRef || !/^usdt-\d{13}-[0-9a-f]{8}$/.test(txRef)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "A valid tx_ref is required." }, { status: 400 });
    }

    const result = await fulfilUsdtOrder(createAdminClient(), txRef, user.id);
    return NextResponse.json({ success: true, state: result.state });
  } catch (error) {
    console.error("USDT status error:", error);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not check the payment yet." }, { status: 500 });
  }
}
