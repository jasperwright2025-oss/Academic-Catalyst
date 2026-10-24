import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fulfilPesapalOrder } from "@/lib/payments/pesapal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payment/verify?orderTrackingId=...
 * Called by the dashboard when a customer returns from the Pesapal page, so credits appear straight
 * away even if the notification is slow. It only works on the signed-in customer's own orders.
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

    const orderTrackingId = request.nextUrl.searchParams.get("orderTrackingId");
    if (!orderTrackingId || !/^[A-Za-z0-9-]{10,64}$/.test(orderTrackingId)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "A valid orderTrackingId is required." }, { status: 400 });
    }

    const result = await fulfilPesapalOrder(createAdminClient(), orderTrackingId, {
      notificationType: "CALLBACKURL",
      expectedUserId: user.id,
    });

    return NextResponse.json({ success: true, state: result.state });
  } catch (error) {
    console.error("Payment verify error:", error);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not check the payment yet." }, { status: 500 });
  }
}
