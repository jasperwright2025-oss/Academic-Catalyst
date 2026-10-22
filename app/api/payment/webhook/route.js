import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTS, findSubscriptionByPlanId } from "@/lib/payments/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLW_BASE = "https://api.flutterwave.com/v3";

// ---------- Signature check ----------
function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

function isValidSignature(request, rawBody) {
  const secret = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (!secret) return false;

  // Classic header: Flutterwave sends your secret hash as-is.
  const verifHash = request.headers.get("verif-hash");
  if (verifHash && safeEqual(verifHash, secret)) return true;

  // Newer header: base64 HMAC-SHA256 of the raw body, keyed with the secret hash.
  const signature = request.headers.get("flutterwave-signature");
  if (signature) {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");
    return safeEqual(signature, expected);
  }

  return false;
}

// ---------- Credit allocation ----------
/**
 * Applies a purchase to public.subscriptions using optimistic locking, so two
 * payments landing at the same moment cannot overwrite each other.
 *  - one_off:      credits are added.
 *  - subscription: same tier -> allotment refills up to the monthly amount (never lowers a balance);
 *                  tier change -> balances are set to the new plan's allotment.
 * Returns true on success.
 */
async function applyGrants(admin, userId, product) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row, error: readErr } = await admin
      .from("subscriptions")
      .select(
        "tier, proposals_remaining, dissertations_remaining, data_simulations_remaining"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (readErr) {
      console.error("Subscription read error:", readErr);
      return false;
    }

    const cur = {
      proposals: row?.proposals_remaining ?? 0,
      dissertations: row?.dissertations_remaining ?? 0,
      simulations: row?.data_simulations_remaining ?? 0,
    };
    const g = product.grants;

    let next;
    if (product.type === "one_off") {
      next = {
        proposals_remaining: cur.proposals + (g.proposals || 0),
        dissertations_remaining: cur.dissertations + (g.dissertations || 0),
        data_simulations_remaining: cur.simulations + (g.simulations || 0),
      };
    } else {
      const sameTier = row?.tier === product.tier;
      next = {
        tier: product.tier,
        proposals_remaining: sameTier
          ? Math.max(cur.proposals, g.proposals)
          : g.proposals,
        dissertations_remaining: sameTier
          ? Math.max(cur.dissertations, g.dissertations)
          : g.dissertations,
        data_simulations_remaining: cur.simulations,
      };
    }

    // No subscriptions row yet: create one.
    if (!row) {
      const { error: insertErr } = await admin
        .from("subscriptions")
        .insert({ user_id: userId, tier: "free", ...next });
      if (!insertErr) return true;
      if (insertErr.code === "23505") continue; // row appeared meanwhile, retry
      console.error("Subscription insert error:", insertErr);
      return false;
    }

    // Update only if the balances are still what we read.
    const { data: updated, error: updateErr } = await admin
      .from("subscriptions")
      .update(next)
      .eq("user_id", userId)
      .eq("proposals_remaining", row.proposals_remaining)
      .eq("dissertations_remaining", row.dissertations_remaining)
      .eq("data_simulations_remaining", row.data_simulations_remaining)
      .select("user_id");

    if (updateErr) {
      console.error("Subscription update error:", updateErr);
      return false;
    }
    if (updated && updated.length === 1) return true;
    // Someone else changed the row first: loop and recompute.
  }
  return false;
}

async function revertClaim(admin, txRef) {
  await admin.from("transactions").update({ status: "pending" }).eq("tx_ref", txRef);
}

// ---------- Handler ----------
export async function POST(request) {
  // Raw body first: the signature is computed over the exact bytes received.
  const rawBody = await request.text();

  if (!isValidSignature(request, rawBody)) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  // Only successful-charge events matter here. Acknowledge everything else.
  const payload = event?.data;
  if (event?.event !== "charge.completed" || !payload?.id || !payload?.tx_ref) {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  try {
    const admin = createAdminClient();

    // Failed or abandoned charge: mark our pending row and stop.
    if (payload.status !== "successful") {
      await admin
        .from("transactions")
        .update({ status: "failed" })
        .eq("tx_ref", payload.tx_ref)
        .eq("status", "pending");
      return NextResponse.json({ status: "recorded_failure" }, { status: 200 });
    }

    // ---------- 1. Never trust the webhook body: confirm with Flutterwave ----------
    const verifyRes = await fetch(
      `${FLW_BASE}/transactions/${encodeURIComponent(payload.id)}/verify`,
      { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
    );
    const verifyJson = await verifyRes.json().catch(() => null);

    if (!verifyRes.ok) {
      // Let Flutterwave retry later.
      console.error("Flutterwave verify failed:", verifyRes.status, verifyJson);
      return NextResponse.json({ error: "VERIFY_UNAVAILABLE" }, { status: 502 });
    }

    const tx = verifyJson?.data;
    if (verifyJson?.status !== "success" || tx?.status !== "successful") {
      return NextResponse.json({ status: "not_successful" }, { status: 200 });
    }

    // ---------- 2. Match the payment to a transaction ----------
    const { data: existing, error: lookupErr } = await admin
      .from("transactions")
      .select("tx_ref, user_id, product_key, amount, currency, status")
      .eq("tx_ref", tx.tx_ref)
      .maybeSingle();

    if (lookupErr) {
      console.error("Transaction lookup error:", lookupErr);
      return NextResponse.json({ error: "DATABASE_ERROR" }, { status: 500 });
    }

    let userId;
    let productKey;

    if (existing) {
      // ----- Payment we started through /api/payment/checkout -----
      if (existing.status === "successful") {
        return NextResponse.json({ status: "already_processed" }, { status: 200 });
      }

      if (
        tx.currency !== existing.currency ||
        Number(tx.amount) < Number(existing.amount)
      ) {
        console.error("Payment mismatch, flagged for review:", {
          tx_ref: tx.tx_ref,
          expected: `${existing.amount} ${existing.currency}`,
          received: `${tx.amount} ${tx.currency}`,
        });
        await admin
          .from("transactions")
          .update({ status: "flagged" })
          .eq("tx_ref", tx.tx_ref);
        return NextResponse.json({ status: "flagged" }, { status: 200 });
      }

      // Claim it atomically so retries and duplicate webhooks cannot grant credits twice.
      const { data: claimed, error: claimErr } = await admin
        .from("transactions")
        .update({
          status: "successful",
          flutterwave_transaction_id: String(tx.id),
          paid_at: new Date().toISOString(),
        })
        .eq("tx_ref", tx.tx_ref)
        .in("status", ["pending", "failed"])
        .select("tx_ref");

      if (claimErr) {
        console.error("Transaction claim error:", claimErr);
        return NextResponse.json({ error: "DATABASE_ERROR" }, { status: 500 });
      }
      if (!claimed || claimed.length === 0) {
        return NextResponse.json({ status: "already_processed" }, { status: 200 });
      }

      userId = existing.user_id;
      productKey = existing.product_key;
    } else {
      // ----- Automatic monthly renewal: Flutterwave created the tx_ref, not us -----
      const planId = tx.payment_plan ?? tx.plan ?? payload.payment_plan;
      const match = findSubscriptionByPlanId(planId);
      const email = (tx.customer?.email || "").toLowerCase();

      if (!match || !email) {
        console.warn("Unmatched Flutterwave payment, needs manual review:", {
          tx_ref: tx.tx_ref,
          planId,
          email,
        });
        return NextResponse.json({ status: "unmatched" }, { status: 200 });
      }

      const [renewalKey, renewalProduct] = match;

      const { data: prior } = await admin
        .from("transactions")
        .select("user_id")
        .eq("customer_email", email)
        .eq("product_key", renewalKey)
        .eq("status", "successful")
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!prior) {
        console.warn("Renewal without a prior purchase on record:", tx.tx_ref, email);
        return NextResponse.json({ status: "unmatched" }, { status: 200 });
      }

      if (
        tx.currency !== renewalProduct.currency ||
        Number(tx.amount) < renewalProduct.amount
      ) {
        console.error("Renewal amount mismatch, flagged for review:", tx.tx_ref);
        return NextResponse.json({ status: "flagged" }, { status: 200 });
      }

      const { error: renewalInsertErr } = await admin.from("transactions").insert({
        user_id: prior.user_id,
        tx_ref: tx.tx_ref,
        product_key: renewalKey,
        amount: tx.amount,
        currency: tx.currency,
        status: "successful",
        customer_email: email,
        flutterwave_transaction_id: String(tx.id),
        paid_at: new Date().toISOString(),
      });

      if (renewalInsertErr) {
        // Unique violation on tx_ref means this renewal was already handled.
        if (renewalInsertErr.code === "23505") {
          return NextResponse.json({ status: "already_processed" }, { status: 200 });
        }
        console.error("Renewal insert error:", renewalInsertErr);
        return NextResponse.json({ error: "DATABASE_ERROR" }, { status: 500 });
      }

      userId = prior.user_id;
      productKey = renewalKey;
    }

    // ---------- 3. Grant the credits ----------
    const product = PRODUCTS[productKey];
    if (!product) {
      console.error("Unknown product_key on transaction:", productKey, tx.tx_ref);
      return NextResponse.json({ status: "unknown_product" }, { status: 200 });
    }

    const granted = await applyGrants(admin, userId, product);
    if (!granted) {
      // Undo the claim so Flutterwave's retry can try again.
      await revertClaim(admin, tx.tx_ref);
      return NextResponse.json({ error: "GRANT_FAILED" }, { status: 500 });
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "SERVER_FAULT" }, { status: 500 });
  }
}
