import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { kickJob, ACTIVE_STATUSES } from "@/lib/generation/runner";

export const dynamic = "force-dynamic";

// A job that has not moved for this long, with no request holding it, is restarted.
const STALL_SECONDS = 60;

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

  return NextResponse.json({ restarted: stalled.length });
}
