import { PRODUCTS } from "./catalog.js";
import { applyGrants } from "./grants.js";

// Pesapal API 3.0. Set PESAPAL_ENV=live for real payments; anything else uses the sandbox.
const BASES = {
  live: "https://pay.pesapal.com/v3/api",
  sandbox: "https://cybqa.pesapal.com/pesapalv3/api",
};

const baseUrl = () => (process.env.PESAPAL_ENV === "live" ? BASES.live : BASES.sandbox);

// The access token lasts 5 minutes, so it is reused while it is still valid.
let cachedToken = null;

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const key = process.env.PESAPAL_CONSUMER_KEY;
  const secret = process.env.PESAPAL_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("Missing PESAPAL_CONSUMER_KEY or PESAPAL_CONSUMER_SECRET.");

  const res = await fetch(`${baseUrl()}/Auth/RequestToken`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.token) {
    console.error("Pesapal token error:", res.status, json);
    throw new Error("Pesapal authentication failed.");
  }

  const expires = json.expiryDate ? new Date(json.expiryDate).getTime() : Date.now() + 4 * 60_000;
  cachedToken = { token: json.token, expiresAt: expires };
  return json.token;
}

async function pesapalFetch(path, { method = "GET", body } = {}) {
  const token = await getToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("Pesapal request failed:", path, res.status, json);
    throw new Error(`Pesapal request failed (${res.status}).`);
  }
  return json;
}

export const submitOrder = (order) =>
  pesapalFetch("/Transactions/SubmitOrderRequest", { method: "POST", body: order });

export const getTransactionStatus = (orderTrackingId) =>
  pesapalFetch(`/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`);

// dd-MM-yyyy, as Pesapal expects for subscription dates
export function pesapalDate(date) {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${date.getUTCFullYear()}`;
}

/**
 * Checks a Pesapal order with Pesapal itself (the callback and IPN carry no payment status) and,
 * if it is paid, grants the credits exactly once.
 *
 * Returns { state } where state is one of:
 *   granted | already_processed | not_paid | failed | unmatched | forbidden
 * Throws if Pesapal cannot be reached or the credits could not be saved (so the caller can retry).
 */
export async function fulfilPesapalOrder(admin, orderTrackingId, { notificationType, merchantReference, expectedUserId } = {}) {
  const status = await getTransactionStatus(orderTrackingId);
  const code = Number(status?.status_code); // 0 INVALID, 1 COMPLETED, 2 FAILED, 3 REVERSED
  const isRecurring = notificationType === "RECURRING";

  // ----- Not completed -----
  if (code !== 1) {
    if (code === 2 && status.merchant_reference && !isRecurring) {
      await admin
        .from("transactions")
        .update({ status: "failed" })
        .eq("tx_ref", status.merchant_reference)
        .eq("status", "pending");
      return { state: "failed" };
    }
    if (code === 3) console.warn("Pesapal payment reversed, review manually:", orderTrackingId);
    return { state: "not_paid" };
  }

  const paidAt = new Date().toISOString();

  // ----- Automatic monthly renewal (card subscription) -----
  if (isRecurring) {
    const originalRef =
      status.subscription_transaction_info?.account_reference || merchantReference || status.merchant_reference;

    const { data: original } = await admin
      .from("transactions")
      .select("user_id, product_key, customer_email")
      .eq("tx_ref", originalRef)
      .maybeSingle();

    const product = original ? PRODUCTS[original.product_key] : null;
    if (!original || !product || product.type !== "subscription") {
      console.warn("Unmatched Pesapal renewal, review manually:", orderTrackingId, originalRef);
      return { state: "unmatched" };
    }

    const { error: insertErr } = await admin.from("transactions").insert({
      user_id: original.user_id,
      tx_ref: `pesapal-rec-${orderTrackingId}`,
      product_key: original.product_key,
      amount: status.amount,
      currency: status.currency,
      status: "successful",
      provider: "pesapal",
      provider_reference: orderTrackingId,
      customer_email: original.customer_email,
      paid_at: paidAt,
    });

    if (insertErr) {
      if (insertErr.code === "23505") return { state: "already_processed" };
      throw new Error(`Renewal could not be recorded: ${insertErr.message}`);
    }

    const granted = await applyGrants(admin, original.user_id, product);
    if (!granted) {
      await admin.from("transactions").delete().eq("tx_ref", `pesapal-rec-${orderTrackingId}`);
      throw new Error("Renewal credits could not be saved.");
    }
    return { state: "granted", userId: original.user_id };
  }

  // ----- First payment of an order we created at checkout -----
  const ref = merchantReference || status.merchant_reference;
  const { data: row } = await admin
    .from("transactions")
    .select("tx_ref, user_id, product_key, amount, currency, status, provider_reference")
    .eq("tx_ref", ref)
    .maybeSingle();

  if (!row) {
    console.warn("Pesapal payment with no matching order, review manually:", orderTrackingId, ref);
    return { state: "unmatched" };
  }
  if (expectedUserId && row.user_id !== expectedUserId) return { state: "forbidden" };
  if (row.provider_reference && row.provider_reference !== orderTrackingId) {
    console.warn("Pesapal tracking id does not match our order, review manually:", orderTrackingId, ref);
    return { state: "unmatched" };
  }
  if (row.status === "successful") return { state: "already_processed" };

  // The order amount is fixed by our server when the order is created. If the customer paid in
  // another currency (for example UGX mobile money), Pesapal has already converted it, so the
  // amounts are only compared when both are in the same currency.
  if (status.currency === row.currency && Number(status.amount) + 0.0001 < Number(row.amount)) {
    console.error("Pesapal underpayment, flagged for review:", orderTrackingId, status.amount, row.amount);
    await admin.from("transactions").update({ status: "flagged" }).eq("tx_ref", ref);
    return { state: "unmatched" };
  }

  // Claim the order so duplicate notifications cannot grant credits twice.
  const { data: claimed, error: claimErr } = await admin
    .from("transactions")
    .update({ status: "successful", provider_reference: orderTrackingId, paid_at: paidAt })
    .eq("tx_ref", ref)
    .in("status", ["pending", "failed"])
    .select("tx_ref");

  if (claimErr) throw new Error(`Order could not be claimed: ${claimErr.message}`);
  if (!claimed || claimed.length === 0) return { state: "already_processed" };

  const product = PRODUCTS[row.product_key];
  if (!product) {
    console.error("Unknown product on transaction:", row.product_key, ref);
    return { state: "unmatched" };
  }

  const granted = await applyGrants(admin, row.user_id, product);
  if (!granted) {
    await admin.from("transactions").update({ status: "pending" }).eq("tx_ref", ref);
    throw new Error("Credits could not be saved.");
  }
  return { state: "granted", userId: row.user_id };
}
