import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_STATUSES } from "@/lib/generation/runner";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/active
 * The signed-in user's document that is still being written, if any, so the dashboard can show
 * its progress again after a page refresh. Returns { job: null } when nothing is running.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized. Login required." }, { status: 401 });
    }

    const { data: job, error } = await createAdminClient()
      .from("generation_jobs")
      .select("id, action_type, status, stage_index, stage_count, stage_label, created_at")
      .eq("user_id", user.id)
      .in("status", ACTIVE_STATUSES)
      .gte("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Active job lookup error:", error);
      return NextResponse.json({ job: null });
    }
    return NextResponse.json({ job: job ? { ...job, job_id: job.id } : null });
  } catch (err) {
    console.error("Active job error:", err);
    return NextResponse.json({ job: null });
  }
}
