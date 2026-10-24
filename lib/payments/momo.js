import crypto from "crypto";

/**
 * Mobile money (MTN and Airtel) with manual confirmation.
 * The customer sends the exact UGX amount to your number, then enters the transaction ID from the
 * confirmation SMS. You check it against your own MTN or Airtel statement and approve it on
 * /admin/payments. Later this can be replaced by the MTN and Airtel APIs without changing the screens.
 */

export const MOMO_PROVIDERS = { mtn: "momo-mtn", airtel: "momo-airtel" };
export const MOMO_PROVIDER_LIST = Object.values(MOMO_PROVIDERS);
export const MOMO_WINDOW_MS = 24 * 60 * 60 * 1000; // an order can be paid and submitted within a day

// The number customers pay to, from Vercel variables: MOMO_MTN_NUMBER, MOMO_MTN_NAME, MOMO_AIRTEL_NUMBER, MOMO_AIRTEL_NAME
export function momoConfig(network) {
  const prefix = network === "mtn" ? "MOMO_MTN" : network === "airtel" ? "MOMO_AIRTEL" : null;
  if (!prefix) return null;
  const number = (process.env[`${prefix}_NUMBER`] || "").trim();
  const name = (process.env[`${prefix}_NAME`] || "").trim();
  return number ? { number, name } : null;
}

// Shillings per US dollar, set by you in UGX_PER_USD. Prices are in dollars, so this converts them.
export function ugxPerUsd() {
  const rate = Number(process.env.UGX_PER_USD);
  return rate > 0 ? rate : null;
}

// Rounded UP to the nearest 1,000 shillings so the amount is easy to send.
export const ugxAmount = (usd, rate) => Math.ceil((usd * rate) / 1000) * 1000;

// Order references carry their creation time: momo-<milliseconds>-<random>
export const makeMomoRef = () => `momo-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

export function momoCreatedMs(txRef) {
  const match = /^momo-(\d{13})-/.exec(String(txRef));
  return match ? Number(match[1]) : null;
}

export const isMomoRef = (value) => /^momo-\d{13}-[0-9a-f]{8}$/.test(String(value));

// Transaction IDs from the confirmation SMS: letters, digits, dots, dashes, 6 to 40 characters.
export function cleanTransactionId(value) {
  const text = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9._-]{5,39}$/.test(text) ? text : null;
}
