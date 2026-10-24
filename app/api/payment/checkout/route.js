import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTS } from "@/lib/payments/catalog";
import { submitOrder, pesapalDate } from "@/lib/payments/pesapal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts a card or mobile money payment with Pesapal.
 * Shared by POST (returns JSON) and GET (redirects). Returns { status, body }.
 */
async function startCheckout(productKey) {
  try {
    // ---------- 1. Authenticate ----------
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { status: 401, body: { error: "UNAUTHORIZED", message: "Unauthorized. Login required." } };
    }

    // ---------- 2. Resolve the product (price comes from the server catalog) ----------
    const product = PRODUCTS[productKey];
    if (!product) {
      return {
        status: 400,
        body: { error: "BAD_REQUEST", message: `product_key must be one of: ${Object.keys(PRODUCTS).join(", ")}.` },
      };
    }

    if (!process.env.PESAPAL_CONSUMER_KEY || !process.env.PESAPAL_CONSUMER_SECRET || !process.env.PESAPAL_IPN_ID) {
      console.error("Pesapal is not fully configured (key, secret or IPN id missing).");
      return { status: 500, body: { error: "CONFIG_ERROR", message: "Payments are not configured yet." } };
    }

    // ---------- 3. Record a pending transaction ----------
    const txRef = `ac-${randomUUID()}`; // letters, digits and dashes only, under 50 characters
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
    const admin = createAdminClient();

    const { error: insertErr } = await admin.from("transactions").insert({
      user_id: user.id,
      tx_ref: txRef,
      product_key: productKey,
      amount: product.amount,
      currency: product.currency,
      status: "pending",
      provider: "pesapal",
      customer_email: (user.email || "").toLowerCase(),
    });

    if (insertErr) {
      console.error("Transaction insert error:", insertErr);
      return { status: 500, body: { error: "DATABASE_ERROR", message: "Could not start the payment." } };
    }

    // ---------- 4. Ask Pesapal for a hosted payment page ----------
    const fullName = (user.user_metadata?.full_name || "").trim();
    const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);

    const order = {
      id: txRef,
      currency: product.currency,
      amount: product.amount,
      description: product.label.slice(0, 100),
      callback_url: `${siteUrl}/dashboard`,
      cancellation_url: `${siteUrl}/dashboard?payment=cancelled`,
      notification_id: process.env.PESAPAL_IPN_ID,
      billing_address: {
        email_address: user.email,
        first_name: firstName || "",
        last_name: rest.join(" "),
      },
    };

    // Subscriptions: card payers can choose automatic monthly renewal on the Pesapal page.
    if (product.type === "subscription") {
      const start = new Date();
      const end = new Date(start);
      end.setUTCFullYear(end.getUTCFullYear() + 1);
      order.account_number = txRef; // lets the renewal notification be matched to this purchase
      order.subscription_details = {
        start_date: pesapalDate(start),
        end_date: pesapalDate(end),
        frequency: "MONTHLY",
      };
    }

    const result = await submitOrder(order);

    if (!result?.redirect_url || !result?.order_tracking_id) {
      console.error("Pesapal order error:", result);
      await admin.from("transactions").update({ status: "failed" }).eq("tx_ref", txRef);
      return {
        status: 502,
        body: { error: "PAYMENT_PROVIDER_ERROR", message: "Could not create the payment page. Please try again." },
      };
    }

    await admin
      .from("transactions")
      .update({ provider_reference: result.order_tracking_id })
      .eq("tx_ref", txRef);

    return { status: 200, body: { success: true, checkout_url: result.redirect_url, tx_ref: txRef } };
  } catch (error) {
    console.error("Checkout error:", error);
    return { status: 500, body: { error: "SERVER_FAULT", message: "Checkout failed unexpectedly." } };
  }
}

// POST /api/payment/checkout   body: { "product_key": "proposal_single" }
export async function POST(request) {
  let productKey;
  try {
    const body = await request.json();
    productKey = body?.product_key;
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const { status, body } = await startCheckout(productKey);
  return NextResponse.json(body, { status });
}

// GET /api/payment/checkout?product=proposal_single  (redirects straight to Pesapal)
export async function GET(request) {
  const { status, body } = await startCheckout(request.nextUrl.searchParams.get("product"));
  if (status === 200) return NextResponse.redirect(body.checkout_url, 303);
  return NextResponse.json(body, { status });
}
