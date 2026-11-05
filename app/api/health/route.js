import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const REQUIRED_SETTINGS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
];

/**
 * GET /api/health
 * For uptime monitors: 200 with status "ok" or "degraded" while the site works, 503 when it does not.
 * Reports only yes/no checks and counts, never settings or customer data.
 */
export async function GET() {
  const started = Date.now();
  const checks = {};

  const missing = REQUIRED_SETTINGS.filter((key) => !process.env[key]);
  checks.settings = missing.length ? `missing ${missing.length}` : "ok";

  let databaseOk = false;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("subscriptions").select("id", { head: true, count: "exact" }).limit(1);
    databaseOk = !error;
    checks.database = error ? "error" : "ok";

    if (databaseOk) {
      const now = Date.now();
      const { count: stuck } = await admin
        .from("generation_jobs")
        .select("id", { head: true, count: "exact" })
        .in("status", ["queued", "running"])
        .lt("updated_at", new Date(now - 15 * 60 * 1000).toISOString());
      const { count: failed } = await admin
        .from("generation_jobs")
        .select("id", { head: true, count: "exact" })
        .eq("status", "failed")
        .gte("updated_at", new Date(now - 60 * 60 * 1000).toISOString());
      checks.stuck_documents = stuck ?? 0;
      checks.failed_documents_last_hour = failed ?? 0;
    }
  } catch {
    checks.database = "error";
  }

  const down = !databaseOk || missing.length > 0;
  const degraded = !down && (checks.stuck_documents > 0 || checks.failed_documents_last_hour > 2);
  const status = down ? "down" : degraded ? "degraded" : "ok";

  return NextResponse.json(
    { status, checks, checked_in_ms: Date.now() - started, time: new Date().toISOString() },
    { status: down ? 503 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
