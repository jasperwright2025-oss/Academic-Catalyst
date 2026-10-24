import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTS } from "@/lib/payments/catalog";
import { applyGrants } from "@/lib/payments/grants";
import { verifyWebhook, queryOrder } from "@/lib/payments/binance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Binance expects this exact reply, otherwise it sends the notification again (up to 6 times).
const OK = () => NextResponse.json({ returnCode: "SUCCESS", returnMessage: null });
const RETRY = () => NextResponse.json({ returnCode: "FAIL", returnMessage: "retry" }, { status: 500 });

export async function POST(request) {
  // Raw text first: the signature covers the exact bytes received.
  const rawBody = await request.text();

  let signatureOk = false;
  try {
    signatureOk = await verifyWebhook(request.headers, rawBody);
  } catch (error) {
    console.error("Binance webhook signature check could not run:", error);
    return RETRY();
  }
  if (!signatureOk) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let event;
  let data;
  try {
    event = JSON.parse(rawBody);
    data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  // Only order notifications matter here.
  if (event?.bizType !== "PAY" || !data?.merchantTradeNo) return OK();
  const merchantTradeNo = String(data.merchantTradeNo);

  try {
    const admin = createAdminClient();

    // Unpaid, closed or expired order: record it and stop.
    if (event.bizStatus !== "PAY_SUCCESS") {
      await admin
        .from("transactions")
        .update({ status: "failed" })
        .eq("tx_ref", merchantTradeNo)
        .eq("provider", "binance")
        .eq("status", "pending");
      return OK();
    }

    // ---------- 1. Never rely on the notification alone: ask Binance for the order ----------
    const order = await queryOrder(merchantTradeNo);
    if (String(order?.status).toUpperCase() !== "PAID") {
      console.warn("Binance order not paid when queried:", merchantTradeNo, order?.status);
      return RETRY();
    }

    // ---------- 2. Match it to the order we created ----------
    const { data: row, error: lookupErr } = await admin
      .from("transactions")
      .select("tx_ref, user_id, product_key, amount, currency, status")
      .eq("tx_ref", merchantTradeNo)
      .eq("provider", "binance")
      .maybeSingle();

    if (lookupErr) throw lookupErr;
    if (!row) {
      console.warn("Binance payment with no matching order, review manually:", merchantTradeNo);
      return OK();
    }
    if (row.status === "successful") return OK();

    const paidAmount = Number(data.totalFee);
    if (String(data.currency).toUpperCase() !== row.currency || !(paidAmount + 0.000001 >= Number(row.amount))) {
      console.error("Binance payment mismatch, flagged for review:", merchantTradeNo, data.totalFee, data.currency);
      await admin.from("transactions").update({ status: "flagged" }).eq("tx_ref", merchantTradeNo);
      return OK();
    }

    const product = PRODUCTS[row.product_key];
    if (!product) {
      console.error("Unknown product on transaction:", row.product_key, merchantTradeNo);
      return OK();
    }

    // ---------- 3. Claim it so repeated notifications cannot grant credits twice ----------
    const { data: claimed, error: claimErr } = await admin
      .from("transactions")
      .update({ status: "successful", paid_at: new Date().toISOString() })
      .eq("tx_ref", merchantTradeNo)
      .in("status", ["pending", "failed"])
      .select("tx_ref");

    if (claimErr) throw claimErr;
    if (!claimed || claimed.length === 0) return OK();

    // ---------- 4. Grant the credits ----------
    const granted = await applyGrants(admin, row.user_id, product);
    if (!granted) {
      await admin.from("transactions").update({ status: "pending" }).eq("tx_ref", merchantTradeNo);
      return RETRY();
    }

    return OK();
  } catch (error) {
    console.error("Binance webhook error:", error);
    return RETRY();
  }
}
