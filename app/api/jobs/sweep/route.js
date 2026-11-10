import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { kickJob, ACTIVE_STATUSES } from "@/lib/generation/runner";
import { sendEmail } from "@/lib/email";
import { adminEmails } from "@/lib/admin";

export const dynamic = "force-dynamic";

// A job that has not moved for this long, with no request holding it, is restarted.
const STALL_SECONDS = 60;
// A job that has not moved for this long triggers one alert email to the operator.
const ALERT_MINUTES = 10;

/**
 * GET /api/jobs/sweep
 * Restarts stalled background jobs. Meant for a Vercel Cron schedule (every minute on Pro).
 * When CRON_SECRET is set in Vercel, only requests carrying it (Vercel Cron sends it) are accepted.
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = Date.now();
  const { data: jobs, error } = await createAdminClient()
    .from("generation_jobs")
    .select("id, locked_until, updated_at")
    .in("status", ACTIVE_STATUSES)
    .lt("updated_at", new Date(now - STALL_SECONDS * 1000).toISOString())
    .gte("created_at", new Date(now - 6 * 60 * 60 * 1000).toISOString())
    .limit(20);

  if (error) {
    console.error("Sweep lookup error:", error);
    return NextResponse.json({ error: "DATABASE_ERROR" }, { status: 500 });
  }

  const stalled = (jobs || []).filter((job) => !job.locked_until || new Date(job.locked_until).getTime() < now);
  // Cron calls arrive on the deployment's own *.vercel.app address, which Vercel Authentication
  // protects (401). Hand jobs over through the public site address instead.
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "") || new URL(request.url).origin;
  after(() => Promise.all(stalled.map((job) => kickJob(origin, job.id))));

  const alerted = await alertLongStalls(now);
  return NextResponse.json({ restarted: stalled.length, alerted });
}

// Emails the operator once about each job that has not moved for ALERT_MINUTES.
// The email carries only the job id, type and stage: no student details.
async function alertLongStalls(now) {
  const to = process.env.ALERT_EMAIL || adminEmails()[0];
  if (!to) return 0;
  const admin = createAdminClient();
  const { data: jobs, error } = await admin
    .from("generation_jobs")
    .select("id, action_type, stage_index, stage_count, stage_label, attempts, updated_at")
    .in("status", ACTIVE_STATUSES)
    .is("stall_alerted_at", null)
    .lt("updated_at", new Date(now - ALERT_MINUTES * 60 * 1000).toISOString())
    .gte("created_at", new Date(now - 24 * 60 * 60 * 1000).toISOString())
    .limit(10);
  if (error) {
    console.error("Stall alert lookup error:", error);
    return 0;
  }
  let sent = 0;
  for (const job of jobs || []) {
    // Claim the alert first, so two sweeps never email about the same job.
    const { data: claimed } = await admin
      .from("generation_jobs")
      .update({ stall_alerted_at: new Date(now).toISOString() })
      .eq("id", job.id)
      .is("stall_alerted_at", null)
      .select("id");
    if (!claimed?.length) continue;
    const minutes = Math.round((now - new Date(job.updated_at).getTime()) / 60000);
    const ok = await sendEmail({
      to,
      subject: `[Academic Catalyst] Job stuck for ${minutes} minutes`,
      text: [
        `A generation job has not moved for ${minutes} minutes. The sweep keeps trying to restart it every minute.`,
        "",
        `Job: ${job.id}`,
        `Type: ${job.action_type}`,
        `Step: ${job.stage_index + 1} of ${job.stage_count} (${job.stage_label})`,
        `Attempts on this step: ${job.attempts ?? 0}`,
        `Last update: ${job.updated_at}`,
        "",
        "Check the Vercel logs for this job id. The student has not been charged until the document is saved.",
      ].join("\n"),
    });
    if (ok) sent++;
    else console.error("Stall alert email not sent:", job.id);
  }
  return sent;
}
