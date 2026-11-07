// Receives Resend "email.received" webhooks and forwards mail sent to
// @academic-catalyst.app addresses (support@, admin@, ...) to a Gmail inbox.
//
// Environment variables:
//   RESEND_API_KEY         already set (sending-only key); used to send the forward
//   RESEND_INBOUND_API_KEY full-access key; used only to read received emails and attachments
//   RESEND_WEBHOOK_SECRET  the webhook's signing secret from the Resend dashboard (whsec_...)
//   INBOUND_FORWARD_TO     optional; defaults to wattisimon@gmail.com
import crypto from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOMAIN = "academic-catalyst.app";
const DEFAULT_FORWARD_TO = "wattisimon@gmail.com";
const TOLERANCE_SECONDS = 5 * 60;

// Resend signs webhooks with Svix: HMAC-SHA256 over "id.timestamp.body".
function verifySignature(secret, headers, body) {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  return signatures.split(" ").some((entry) => {
    const [version, sig] = entry.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

function addressesOf(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .map((v) => (typeof v === "string" ? v : v?.email || v?.address || ""))
    .map((v) => (v.match(/<([^>]+)>/)?.[1] || v).trim().toLowerCase())
    .filter(Boolean);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function resendFetch(path, init = {}, key = process.env.RESEND_API_KEY) {
  let res;
  try {
    res = await fetch(`https://api.resend.com${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) },
    });
  } catch (err) {
    return { ok: false, status: 0, json: null, text: `network error: ${err?.message}` };
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, json, text };
}

export async function POST(request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const readKey = process.env.RESEND_INBOUND_API_KEY;
  if (!secret || !process.env.RESEND_API_KEY || !readKey) {
    return NextResponse.json({ error: "Inbound forwarding is not configured" }, { status: 503 });
  }

  const body = await request.text();
  if (!verifySignature(secret, request.headers, body)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try { event = JSON.parse(body); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  if (event?.type !== "email.received") return NextResponse.json({ ignored: event?.type || "unknown" });

  const data = event.data || {};
  const emailId = data.email_id || data.id;
  const recipients = addressesOf(data.to);
  const ours = recipients.filter((a) => a.endsWith(`@${DOMAIN}`));
  if (!emailId || ours.length === 0) return NextResponse.json({ ignored: "not for our domain" });

  // Fetch the full message (webhooks carry metadata only).
  const got = await resendFetch(`/emails/receiving/${encodeURIComponent(emailId)}`, {}, readKey);
  if (!got.ok) {
    console.error("Inbound fetch failed:", got.status, got.text.slice(0, 200));
    // 500 makes Resend retry later.
    return NextResponse.json({ error: "Could not read received email" }, { status: 500 });
  }
  const email = got.json || {};

  const fromAddr = addressesOf(email.from || data.from)[0] || "unknown sender";
  const subject = email.subject || data.subject || "(no subject)";
  const sentTo = ours.join(", ");
  const received = email.created_at || data.created_at || new Date().toISOString();

  // Attachments: pass through by URL where Resend provides one.
  let attachments = [];
  const att = await resendFetch(`/emails/receiving/${encodeURIComponent(emailId)}/attachments`, {}, readKey);
  if (att.ok) {
    const items = att.json?.data || [];
    attachments = items
      .filter((a) => a?.download_url && a?.filename)
      .map((a) => ({ filename: a.filename, path: a.download_url }));
  }

  const headerText = `---------- Forwarded message ----------\nFrom: ${fromAddr}\nTo: ${sentTo}\nDate: ${received}\nSubject: ${subject}\n\n`;
  const headerHtml = `<div style="font:13px/1.5 sans-serif;color:#555;border-bottom:1px solid #ddd;padding-bottom:8px;margin-bottom:12px">---------- Forwarded message ----------<br>From: ${escapeHtml(fromAddr)}<br>To: ${escapeHtml(sentTo)}<br>Date: ${escapeHtml(received)}<br>Subject: ${escapeHtml(subject)}</div>`;

  const payload = {
    from: `Academic Catalyst Inbox <${ours[0]}>`,
    to: [process.env.INBOUND_FORWARD_TO || DEFAULT_FORWARD_TO],
    reply_to: fromAddr.includes("@") ? fromAddr : undefined,
    subject: `[${ours[0].split("@")[0]}@] ${subject}`,
    text: headerText + (email.text || "(no plain-text body)"),
    ...(email.html ? { html: headerHtml + email.html } : {}),
    ...(attachments.length ? { attachments } : {}),
  };

  let sent = await resendFetch("/emails", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Idempotency-Key": `inbound-${emailId}` },
  });
  // If attachments caused the failure, send without them rather than lose the message.
  if (!sent.ok && attachments.length) {
    const names = attachments.map((a) => a.filename).join(", ");
    delete payload.attachments;
    payload.text += `\n\n[Attachments not forwarded: ${names}. Open the message in Resend Inboxes.]`;
    sent = await resendFetch("/emails", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Idempotency-Key": `inbound-${emailId}-noatt` },
    });
  }
  if (!sent.ok) {
    console.error("Inbound forward failed:", sent.status, sent.text.slice(0, 200));
    return NextResponse.json({ error: "Forward failed" }, { status: 500 });
  }

  return NextResponse.json({ forwarded: emailId });
}
