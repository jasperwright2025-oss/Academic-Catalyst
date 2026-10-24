import crypto from "crypto";

// Binance Pay merchant API. Create the API key and secret in the Binance Merchant Admin Portal.
const BASE = "https://bpay.binanceapi.com";

function makeNonce() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  const bytes = crypto.randomBytes(32);
  for (let i = 0; i < 32; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// Request signature: HMAC-SHA512 of "timestamp \n nonce \n body \n", upper-case hex.
export function signRequest({ timestamp, nonce, body, secret }) {
  return crypto
    .createHmac("sha512", secret)
    .update(`${timestamp}\n${nonce}\n${body}\n`)
    .digest("hex")
    .toUpperCase();
}

async function binanceRequest(path, payload) {
  const apiKey = process.env.BINANCE_PAY_API_KEY;
  const secret = process.env.BINANCE_PAY_SECRET_KEY;
  if (!apiKey || !secret) throw new Error("Missing BINANCE_PAY_API_KEY or BINANCE_PAY_SECRET_KEY.");

  const body = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const nonce = makeNonce();

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "BinancePay-Timestamp": timestamp,
      "BinancePay-Nonce": nonce,
      "BinancePay-Certificate-SN": apiKey,
      "BinancePay-Signature": signRequest({ timestamp, nonce, body, secret }),
    },
    body,
  });
  const json = await res.json().catch(() => null);

  if (!res.ok || json?.status !== "SUCCESS") {
    console.error("Binance Pay request failed:", path, res.status, json);
    throw Object.assign(new Error("BINANCE_PAY_ERROR"), { details: json });
  }
  return json.data;
}

export const createOrder = (order) => binanceRequest("/binancepay/openapi/v2/order", order);
export const queryOrder = (merchantTradeNo) =>
  binanceRequest("/binancepay/openapi/v2/order/query", { merchantTradeNo });

// ---------- Webhook signature check (RSA, public key issued by Binance Pay) ----------
let certCache = { certs: [], fetchedAt: 0 };

async function getCertificates(force = false) {
  if (!force && certCache.certs.length && Date.now() - certCache.fetchedAt < 60 * 60 * 1000) {
    return certCache.certs;
  }
  const data = await binanceRequest("/binancepay/openapi/certificates", {});
  const certs = Array.isArray(data) ? data : data ? [data] : [];
  certCache = { certs, fetchedAt: Date.now() };
  return certs;
}

function toPem(publicKey) {
  if (publicKey.includes("BEGIN")) return publicKey;
  const lines = publicKey.replace(/\s+/g, "").match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----`;
}

export function verifySignatureWithKey({ timestamp, nonce, body, signature, publicKey }) {
  try {
    return crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${timestamp}\n${nonce}\n${body}\n`),
      toPem(publicKey),
      Buffer.from(signature, "base64")
    );
  } catch {
    return false;
  }
}

export async function verifyWebhook(headers, rawBody) {
  const timestamp = headers.get("binancepay-timestamp");
  const nonce = headers.get("binancepay-nonce");
  const signature = headers.get("binancepay-signature");
  const serial = headers.get("binancepay-certificate-sn");
  if (!timestamp || !nonce || !signature) return false;

  const check = (cert) =>
    verifySignatureWithKey({ timestamp, nonce, body: rawBody, signature, publicKey: cert.certPublic });

  for (const force of [false, true]) {
    const certs = await getCertificates(force);
    const matching = certs.filter((c) => String(c.certSerial) === String(serial));
    // Try the certificate named in the header first, then any other (covers a rotated key).
    const ordered = [...matching, ...certs.filter((c) => !matching.includes(c))];
    if (ordered.some(check)) return true;
  }
  return false;
}
