import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTS } from "@/lib/payments/catalog";
import { createOrder } from "@/lib/payments/binance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts a crypto payment (USDT) with Binance Pay. One-time purchases only.
 * POST /api/payment/crypto/checkout   body: { "product_key": "proposal_single" }
 * Returns { checkout_url } for the page to open.
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

    // ---------- 2. Resolve the product ----------
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
    if (product.type !== "one_off") {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Crypto is available for one-time purchases only." },
        { status: 400 }
      );
    }
    if (!process.env.BINANCE_PAY_API_KEY || !process.env.BINANCE_PAY_SECRET_KEY) {
      console.error("Binance Pay is not configured.");
      return NextResponse.json({ error: "CONFIG_ERROR", message: "Crypto payments are not configured yet." }, { status: 500 });
    }

    // ---------- 3. Record a pending transaction ----------
    // Binance accepts letters and digits only, up to 32 characters: a UUID without dashes fits exactly.
    const merchantTradeNo = randomUUID().replace(/-/g, "");
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
    const admin = createAdminClient();

    const { error: insertErr } = await admin.from("transactions").insert({
      user_id: user.id,
      tx_ref: merchantTradeNo,
      product_key: productKey,
      amount: product.amount,
      currency: "USDT",
      status: "pending",
      provider: "binance",
      customer_email: (user.email || "").toLowerCase(),
    });

    if (insertErr) {
      console.error("Crypto transaction insert error:", insertErr);
      return NextResponse.json({ error: "DATABASE_ERROR", message: "Could not start the payment." }, { status: 500 });
    }

    // ---------- 4. Ask Binance Pay for a hosted checkout page ----------
    let order;
    try {
      order = await createOrder({
        env: { terminalType: "WEB" },
        merchantTradeNo,
        orderAmount: product.amount, // USDT is pegged 1:1 to the US dollar price
        currency: "USDT",
        goods: {
          goodsType: "02", // virtual goods
          goodsCategory: "D000", // value from Binance's own example
          referenceGoodsId: productKey,
          goodsName: product.label.slice(0, 256),
          goodsDetail: `${product.label} for Academic Catalyst`,
        },
        returnUrl: `${siteUrl}/dashboard?payment=callback`,
        cancelUrl: `${siteUrl}/dashboard?payment=cancelled`,
      });
    } catch {
      await admin.from("transactions").update({ status: "failed" }).eq("tx_ref", merchantTradeNo);
      return NextResponse.json(
        { error: "PAYMENT_PROVIDER_ERROR", message: "Could not create the crypto payment page. Please try again." },
        { status: 502 }
      );
    }

    if (!order?.checkoutUrl) {
      console.error("Binance Pay returned no checkout URL:", order);
      await admin.from("transactions").update({ status: "failed" }).eq("tx_ref", merchantTradeNo);
      return NextResponse.json({ error: "PAYMENT_PROVIDER_ERROR", message: "Could not create the crypto payment page." }, { status: 502 });
    }

    if (order.prepayId) {
      await admin
        .from("transactions")
        .update({ provider_reference: String(order.prepayId) })
        .eq("tx_ref", merchantTradeNo);
    }

    return NextResponse.json({ success: true, checkout_url: order.checkoutUrl, tx_ref: merchantTradeNo });
  } catch (error) {
    console.error("Crypto checkout error:", error);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Checkout failed unexpectedly." }, { status: 500 });
  }
}
