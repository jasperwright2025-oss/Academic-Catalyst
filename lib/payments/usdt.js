import crypto from "crypto";
import { PRODUCTS } from "./catalog.js";
import { applyGrants } from "./grants.js";

/**
 * Direct USDT payments on the TRON network (TRC20), checked against the public blockchain.
 * No exchange login or API key is needed: the server only reads public transfer records.
 *
 * Every order gets its own exact amount (for example 80.037 USDT). A transfer is accepted only if it
 * arrives at our address, after the order was created, for exactly that amount. Because every open
 * order has a different amount, one customer cannot claim another customer's payment.
 */

export const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const USDT_PROVIDER = "usdt-trc20";
export const ORDER_WINDOW_MS = 2 * 60 * 60 * 1000; // how long an order waits for its payment
const TRONGRID = "https://api.trongrid.io";

// ---------- Address check (catches typos before any money is sent) ----------
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function isValidTronAddress(address) {
  if (typeof address !== "string" || address.length !== 34) return false;
  let num = 0n;
  for (const ch of address) {
    const index = BASE58.indexOf(ch);
    if (index === -1) return false;
    num = num * 58n + BigInt(index);
  }
  const hex = num.toString(16).padStart(50, "0");
  if (hex.length !== 50) return false;
  const bytes = Buffer.from(hex, "hex");
  if (bytes[0] !== 0x41) return false; // TRON mainnet addresses start with 0x41
  const payload = bytes.subarray(0, 21);
  const checksum = bytes.subarray(21);
  const hash = crypto.createHash("sha256").update(crypto.createHash("sha256").update(payload).digest()).digest();
  return hash.subarray(0, 4).equals(checksum);
}

export function getReceiveAddress() {
  const address = (process.env.USDT_TRC20_ADDRESS || "").trim();
  return isValidTronAddress(address) ? address : null;
}

// ---------- Order references carry their creation time: usdt-<milliseconds>-<random> ----------
export function makeOrderRef() {
  return `usdt-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

export function orderCreatedMs(txRef) {
  const match = /^usdt-(\d{13})-/.exec(String(txRef));
  return match ? Number(match[1]) : null;
}

export const toMicro = (amount) => BigInt(Math.round(Number(amount) * 1e6)); // USDT has 6 decimals

// ---------- A unique amount for every open order ----------
export async function pickUniqueAmount(admin, baseAmount) {
  const recentFrom = `usdt-${Date.now() - ORDER_WINDOW_MS}`; // compares fine because the time is a fixed 13 digits
  for (let attempt = 0; attempt < 25; attempt++) {
    const extra = 1 + crypto.randomInt(999); // 0.001 to 0.999
    const amount = Number((baseAmount + extra / 1000).toFixed(3));

    const { data, error } = await admin
      .from("transactions")
      .select("tx_ref")
      .eq("provider", USDT_PROVIDER)
      .eq("status", "pending")
      .eq("amount", amount)
      .gte("tx_ref", recentFrom)
      .limit(1);

    if (error) throw new Error(`Could not check open orders: ${error.message}`);
    if (!data || data.length === 0) return amount;
  }
  throw new Error("Could not find a free payment amount. Please try again.");
}

// ---------- Reading the blockchain ----------
export async function listIncomingTransfers(address, sinceMs) {
  const params = new URLSearchParams({
    only_confirmed: "true",
    only_to: "true",
    limit: "200",
    contract_address: USDT_TRC20_CONTRACT,
    min_timestamp: String(sinceMs),
    order_by: "block_timestamp,desc",
  });

  const res = await fetch(`${TRONGRID}/v1/accounts/${address}/transactions/trc20?${params}`, {
    headers: {
      Accept: "application/json",
      ...(process.env.TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY } : {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`TronGrid answered ${res.status}`);

  const json = await res.json();
  return (json?.data || []).map((t) => ({
    txid: t.transaction_id,
    to: t.to,
    type: t.type,
    tokenAddress: t.token_info?.address,
    valueMicro: BigInt(t.value),
    timestamp: Number(t.block_timestamp),
  }));
}

export function findMatchingTransfers(transfers, { address, expectedMicro, sinceMs }) {
  return transfers.filter(
    (t) =>
      t.to === address &&
      t.tokenAddress === USDT_TRC20_CONTRACT &&
      (!t.type || t.type === "Transfer") &&
      t.valueMicro === expectedMicro &&
      t.timestamp >= sinceMs
  );
}

/**
 * Looks for the payment of one order and, if it has arrived, grants the credits exactly once.
 * Returns { state }: paid | waiting | expired | failed | not_found.
 */
export async function fulfilUsdtOrder(admin, txRef, userId) {
  const { data: row, error } = await admin
    .from("transactions")
    .select("tx_ref, user_id, product_key, amount, status")
    .eq("tx_ref", txRef)
    .eq("provider", USDT_PROVIDER)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Order lookup failed: ${error.message}`);
  if (!row) return { state: "not_found" };
  if (row.status === "successful") return { state: "paid" };
  if (row.status !== "pending") return { state: row.status === "expired" ? "expired" : "failed" };

  const createdMs = orderCreatedMs(txRef);
  if (!createdMs) return { state: "not_found" };

  if (Date.now() > createdMs + ORDER_WINDOW_MS) {
    await admin.from("transactions").update({ status: "expired" }).eq("tx_ref", txRef).eq("status", "pending");
    return { state: "expired" };
  }

  const address = getReceiveAddress();
  if (!address) throw new Error("USDT_TRC20_ADDRESS is missing or invalid.");

  let transfers;
  try {
    transfers = await listIncomingTransfers(address, createdMs);
  } catch (err) {
    console.error("Blockchain lookup failed:", err.message);
    return { state: "waiting" }; // try again on the next check
  }

  const matches = findMatchingTransfers(transfers, {
    address,
    expectedMicro: toMicro(row.amount),
    sinceMs: createdMs,
  });
  if (matches.length === 0) return { state: "waiting" };

  const product = PRODUCTS[row.product_key];
  if (!product) {
    console.error("Unknown product on USDT order:", row.product_key, txRef);
    return { state: "failed" };
  }

  for (const transfer of matches) {
    // Claim the order with this transfer. A transfer can only ever be used once (unique reference).
    const { data: claimed, error: claimErr } = await admin
      .from("transactions")
      .update({ status: "successful", provider_reference: transfer.txid, paid_at: new Date().toISOString() })
      .eq("tx_ref", txRef)
      .eq("status", "pending")
      .select("tx_ref");

    if (claimErr) {
      if (claimErr.code === "23505") continue; // this transfer already paid another order
      throw new Error(`Order could not be claimed: ${claimErr.message}`);
    }
    if (!claimed || claimed.length === 0) return { state: "paid" }; // someone else just claimed it

    const granted = await applyGrants(admin, row.user_id, product);
    if (!granted) {
      await admin
        .from("transactions")
        .update({ status: "pending", provider_reference: null, paid_at: null })
        .eq("tx_ref", txRef);
      throw new Error("Credits could not be saved.");
    }
    return { state: "paid", txid: transfer.txid };
  }

  return { state: "waiting" };
}
