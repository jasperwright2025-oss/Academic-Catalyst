import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const SUPPORT_INBOX = process.env.SUPPORT_INBOX || "wattisimon@gmail.com";
const TOPICS = { search: "Literature search", tools: "A planning tool", document: "A document or preview", payment: "A payment", account: "My account", other: "Something else" };
const DAILY_LIMIT = 5;
const clip = (v, n) => String(v ?? "").trim().slice(0, n);

/**
 * POST /api/support  { topic, message, page, error_text }
 * Saves a help request and emails a copy to the support inbox.
 */
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "Please sign in to send a help request." }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Invalid request." }, { status: 400 });
  }
  const topic = Object.hasOwn(TOPICS, body.topic) ? body.topic : "other";
  const message = clip(body.message, 3000);
  if (message.length < 10) {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Please describe the problem in a sentence or two." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("support_requests")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", user.id)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "You have sent several requests today. We will reply to those first." },
      { status: 429 }
    );
  }

  const row = {
    user_id: user.id,
    email: user.email,
    topic,
    message,
    page: clip(body.page, 300),
    error_text: clip(body.error_text, 1000),
  };
  const { data: saved, error } = await admin.from("support_requests").insert(row).select("id, created_at").single();
  if (error) {
    console.error("Support request save error:", error);
    return NextResponse.json({ error: "DATABASE_ERROR", message: "Your request could not be sent. Please email us instead." }, { status: 500 });
  }

  const emailed = await sendEmail({
    to: SUPPORT_INBOX,
    replyTo: user.email,
    subject: `[Academic Catalyst support] ${TOPICS[topic]}: ${message.slice(0, 60)}`,
    text: [
      `From: ${user.email}`,
      `Topic: ${TOPICS[topic]}`,
      `Page: ${row.page || "not given"}`,
      row.error_text ? `Error shown: ${row.error_text}` : "",
      `Request ID: ${saved.id}`,
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  if (emailed) await admin.from("support_requests").update({ emailed: true }).eq("id", saved.id);

  return NextResponse.json({ success: true, id: saved.id });
}
