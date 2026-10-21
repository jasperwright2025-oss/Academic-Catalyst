import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTS, getPlanId } from "@/lib/payments/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLW_BASE = "https://api.flutterwave.com/v3";

/**
 * Shared by POST (returns JSON) and GET (redirects).
 * Returns { status, body }.
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
      return {
        status: 401,
        body: { error: "UNAUTHORIZED", message: "Unauthorized. Login required." },
      };
    }

    // ---------- 2. Resolve the product (price comes from the server catalog) ----------
    const product = PRODUCTS[productKey];
    if (!product) {
      return {
        status: 400,
        body: {
          error: "BAD_REQUEST",
          message: `product_key must be one of: ${Object.keys(PRODUCTS).join(", ")}.`,
        },
      };
    }

    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      console.error("FLUTTERWAVE_SECRET_KEY is not set.");
      return {
        status: 500,
        body: { error: "CONFIG_ERROR", message: "Payments are not configured." },
      };
    }

    let planId;
    if (product.type === "subscription") {
      planId = getPlanId(product);
      if (!planId) {
        console.error(`Missing env var ${product.planIdEnv} for ${productKey}.`);
        return {
          status: 500,
          body: { error: "CONFIG_ERROR", message: "This plan is not configured yet." },
        };
      }
    }

    // ---------- 3. Record a pending transaction ----------
    const txRef = `ac-${randomUUID()}`;
    const customerEmail = (user.email || "").toLowerCase();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const admin = createAdminClient();

    const { error: insertErr } = await admin.from("transactions").insert({
      user_id: user.id,
      tx_ref: txRef,
      product_key: productKey,
      amount: product.amount,
      currency: product.currency,
      status: "pending",
      customer_email: customerEmail,
    });

    if (insertErr) {
      console.error("Transaction insert error:", insertErr);
      return {
        status: 500,
        body: { error: "DATABASE_ERROR", message: "Could not start the payment." },
      };
    }

    // ---------- 4. Ask Flutterwave for a hosted checkout link ----------
    const payload = {
      tx_ref: txRef,
      amount: product.amount,
      currency: product.currency,
      redirect_url: `${siteUrl}/dashboard?payment=callback`,
      customer: {
        email: user.email,
        name: user.user_metadata?.full_name || user.email,
      },
      customizations: {
        title: "Academic Catalyst",
        description: product.label,
      },
      meta: { user_id: user.id, product_key: productKey },
    };

    if (product.type === "subscription") {
      payload.payment_plan = planId;
      payload.payment_options = "card"; // recurring charges need a card
    }

    const flwRes = await fetch(`${FLW_BASE}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const flwJson = await flwRes.json().catch(() => null);

    if (!flwRes.ok || flwJson?.status !== "success" || !flwJson?.data?.link) {
      console.error("Flutterwave checkout error:", flwRes.status, flwJson);
      await admin
        .from("transactions")
        .update({ status: "failed" })
        .eq("tx_ref", txRef);
      return {
        status: 502,
        body: {
          error: "PAYMENT_PROVIDER_ERROR",
          message: "Could not create the payment link. Please try again.",
        },
      };
    }

    return {
      status: 200,
      body: { success: true, checkout_url: flwJson.data.link, tx_ref: txRef },
    };
  } catch (error) {
    console.error("Checkout error:", error);
    return {
      status: 500,
      body: { error: "SERVER_FAULT", message: "Checkout failed unexpectedly." },
    };
  }
}

// POST /api/payment/checkout   body: { "product_key": "proposal_single" }
// Returns JSON { checkout_url } so the frontend can do window.location.href = checkout_url
export async function POST(request) {
  let productKey;
  try {
    const body = await request.json();
    productKey = body?.product_key;
  } catch {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { status, body } = await startCheckout(productKey);
  return NextResponse.json(body, { status });
}

// GET /api/payment/checkout?product=proposal_single
// Redirects straight to Flutterwave, so a plain <a href> works as a buy button.
export async function GET(request) {
  const productKey = request.nextUrl.searchParams.get("product");
  const { status, body } = await startCheckout(productKey);

  if (status === 200) {
    return NextResponse.redirect(body.checkout_url, 303);
  }
  return NextResponse.json(body, { status });
}
