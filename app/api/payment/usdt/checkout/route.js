import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTS } from "@/lib/payments/catalog";
import {
  USDT_PROVIDER,
  ORDER_WINDOW_MS,
  getReceiveAddress,
  makeOrderRef,
  orderCreatedMs,
  pickUniqueAmount,
} from "@/lib/payments/usdt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OPEN_ORDERS = 3;

/**
 * POST /api/payment/usdt/checkout   body: { "product_key": "proposal_single" }
 * Creates an order with its own exact USDT amount and returns what the customer must send.
 */
export async function POST(request) {
  try {
    // ---------- 1. Authenticate ----------
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized. Login required." }, { status: 401 });
    }

    // ---------- 2. Product and receiving address ----------
    let productKey;
    try {
      productKey = (await request.json())?.product_key;
    } catch {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Request body must be valid JSON." }, { status: 400 });
    }

    const product = PRODUCTS[productKey];
    if (!product) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Unknown product_key." }, { status: 400 });
    }

    const address = getReceiveAddress();
    if (!address) {
      console.error("USDT_TRC20_ADDRESS is missing or is not a valid TRON address.");
      return NextResponse.json({ error: "CONFIG_ERROR", message: "USDT payments are not configured yet." }, { status: 500 });
    }

    const admin = createAdminClient();

    // ---------- 3. Limit open orders per customer ----------
    const recentFrom = `usdt-${Date.now() - ORDER_WINDOW_MS}`;
    const { data: open, error: openErr } = await admin
      .from("transactions")
      .select("tx_ref")
      .eq("user_id", user.id)
      .eq("provider", USDT_PROVIDER)
      .eq("status", "pending")
      .gte("tx_ref", recentFrom);

    if (openErr) throw openErr;
    if ((open?.length || 0) >= MAX_OPEN_ORDERS) {
      return NextResponse.json(
        { error: "TOO_MANY_OPEN_ORDERS", message: "You already have unpaid USDT orders open. Please finish or wait for them to expire." },
        { status: 429 }
      );
    }

    // ---------- 4. Create the order with its own exact amount ----------
    const amount = await pickUniqueAmount(admin, product.amount);
    const txRef = makeOrderRef();

    const { error: insertErr } = await admin.from("transactions").insert({
      user_id: user.id,
      tx_ref: txRef,
      product_key: productKey,
      amount,
      currency: "USDT",
      status: "pending",
      provider: USDT_PROVIDER,
      customer_email: (user.email || "").toLowerCase(),
    });

    if (insertErr) {
      console.error("USDT order insert error:", insertErr);
      return NextResponse.json({ error: "DATABASE_ERROR", message: "Could not start the payment." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tx_ref: txRef,
      address,
      network: "TRON (TRC20)",
      token: "USDT",
      amount: amount.toFixed(3),
      expires_at: new Date(orderCreatedMs(txRef) + ORDER_WINDOW_MS).toISOString(),
    });
  } catch (error) {
    console.error("USDT checkout error:", error);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not start the payment." }, { status: 500 });
  }
}
