import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTS } from "@/lib/payments/catalog";
import {
  MOMO_PROVIDERS,
  MOMO_PROVIDER_LIST,
  MOMO_WINDOW_MS,
  momoConfig,
  ugxPerUsd,
  ugxAmount,
  makeMomoRef,
} from "@/lib/payments/momo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OPEN_ORDERS = 3;

/**
 * POST /api/payment/momo/checkout   body: { "product_key": "proposal_single", "network": "mtn" | "airtel" }
 * Creates an order and returns where to send the money and the exact amount in shillings.
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

    const product = PRODUCTS[body?.product_key];
    const network = body?.network;
    if (!product || !MOMO_PROVIDERS[network]) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Unknown product or network." }, { status: 400 });
    }

    const config = momoConfig(network);
    const rate = ugxPerUsd();
    if (!config || !rate) {
      console.error("Mobile money is not configured (number or UGX_PER_USD missing):", network);
      return NextResponse.json(
        { error: "CONFIG_ERROR", message: "This mobile money option is not available yet. Please choose another way to pay." },
        { status: 500 }
      );
    }

    const admin = createAdminClient();

    // Limit unpaid orders per customer.
    const recentFrom = `momo-${Date.now() - MOMO_WINDOW_MS}`;
    const { data: open, error: openErr } = await admin
      .from("transactions")
      .select("tx_ref")
      .eq("user_id", user.id)
      .in("provider", MOMO_PROVIDER_LIST)
      .eq("status", "pending")
      .gte("tx_ref", recentFrom);

    if (openErr) throw openErr;
    if ((open?.length || 0) >= MAX_OPEN_ORDERS) {
      return NextResponse.json(
        { error: "TOO_MANY_OPEN_ORDERS", message: "You already have unpaid mobile money orders open. Please complete one of them first." },
        { status: 429 }
      );
    }

    const amountUgx = ugxAmount(product.amount, rate);
    const txRef = makeMomoRef();

    const { error: insertErr } = await admin.from("transactions").insert({
      user_id: user.id,
      tx_ref: txRef,
      product_key: body.product_key,
      amount: amountUgx,
      currency: "UGX",
      status: "pending",
      provider: MOMO_PROVIDERS[network],
      customer_email: (user.email || "").toLowerCase(),
    });

    if (insertErr) {
      console.error("Mobile money order insert error:", insertErr);
      return NextResponse.json({ error: "DATABASE_ERROR", message: "Could not start the payment." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tx_ref: txRef,
      network,
      number: config.number,
      name: config.name,
      amount_ugx: amountUgx,
      reference: txRef.slice(-8).toUpperCase(),
    });
  } catch (error) {
    console.error("Mobile money checkout error:", error);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not start the payment." }, { status: 500 });
  }
}
