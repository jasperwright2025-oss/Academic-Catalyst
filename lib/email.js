// Sends email through Resend (resend.com) when RESEND_API_KEY is set. Returns true when sent.
// Sender comes from SUPPORT_FROM_EMAIL (academic-catalyst.app is verified in Resend for sending and receiving).
export async function sendEmail({ to, subject, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.SUPPORT_FROM_EMAIL || "Academic Catalyst <support@academic-catalyst.app>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!res.ok) {
      console.error("Email send failed:", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email send error:", err?.message);
    return false;
  }
}
