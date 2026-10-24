import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fulfilPesapalOrder } from "@/lib/payments/pesapal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pesapal IPN (instant payment notification). It carries no payment status and no signature, so we
 * never trust it: we ask Pesapal for the real status of the order and only then grant credits.
 * Register this URL with Pesapal as a GET or POST IPN; both work here.
 */
async function handle(request) {
  let params = {};
  try {
    if (request.method === "GET") {
      params = Object.fromEntries(request.nextUrl.searchParams);
    } else {
      params = await request.json();
    }
  } catch {
    return NextResponse.json({ status: 500, message: "Unreadable notification." }, { status: 200 });
  }

  const orderTrackingId = params.OrderTrackingId;
  const notificationType = params.OrderNotificationType;
  const merchantReference = params.OrderMerchantReference;

  // Pesapal expects its own fields echoed back, with status 200 (done) or 500 (try again).
  const reply = (status) =>
    NextResponse.json({
      orderNotificationType: notificationType,
      orderTrackingId,
      orderMerchantReference: merchantReference,
      status,
    });

  if (!orderTrackingId || !/^[A-Za-z0-9-]{10,64}$/.test(orderTrackingId)) {
    return reply(500);
  }

  try {
    const result = await fulfilPesapalOrder(createAdminClient(), orderTrackingId, {
      notificationType,
      merchantReference,
    });
    console.log("Pesapal IPN processed:", orderTrackingId, result.state);
    return reply(200);
  } catch (error) {
    console.error("Pesapal IPN error:", error);
    return reply(500);
  }
}

export const GET = handle;
export const POST = handle;
