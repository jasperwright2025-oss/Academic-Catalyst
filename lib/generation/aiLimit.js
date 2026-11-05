// When the Anthropic account reaches its spending limit or runs out of credit, every AI request is
// refused until the owner raises the limit. Retrying cannot help, so jobs stop at once, clients see a
// plain message, the owner is emailed, and the health check reports the site as down so the uptime
// monitor raises the alarm.
import { sendEmail } from "@/lib/email";

export const AI_PAUSED_MESSAGE =
  "Writing is paused on our side for a short while. You have not been charged, and we have been alerted. Please try again later today.";

export function isAiLimitError(err) {
  const text = String(err?.error?.error?.message || err?.message || "");
  return [400, 402, 403, 429].includes(err?.status) && /usage limit|credit balance|billing/i.test(text);
}

let lastAlert = 0;

// Emails the owner, at most once every 3 hours per server instance and only if no job failed for the
// same reason in the last 3 hours (so several instances do not all send).
export async function alertAiLimit(admin, err) {
  const now = Date.now();
  if (now - lastAlert < 3 * 60 * 60 * 1000) return;
  lastAlert = now;
  try {
    const { count } = await admin
      .from("generation_jobs")
      .select("id", { head: true, count: "exact" })
      .eq("error", AI_PAUSED_MESSAGE)
      .gte("updated_at", new Date(now - 3 * 60 * 60 * 1000).toISOString());
    if ((count ?? 0) > 0) return;
    await sendEmail({
      to: process.env.SUPPORT_INBOX || "wattisimon@gmail.com",
      subject: "[Academic Catalyst ALERT] AI writing has stopped: Anthropic usage limit reached",
      text:
        "The Anthropic API refused a request because the account's usage limit has been reached or its credit has run out.\n\n" +
        `Anthropic said: ${String(err?.error?.error?.message || err?.message || "").slice(0, 300)}\n\n` +
        "Until this is fixed, no documents or tools can run on academic-catalyst.app. Clients are told that writing is paused and they are not charged.\n\n" +
        "To fix it: sign in at https://console.anthropic.com, open Settings, then Limits, and raise the monthly spend limit (and add credit under Billing if the balance is low).",
    });
  } catch (e) {
    console.error("AI limit alert failed:", e?.message);
  }
}
