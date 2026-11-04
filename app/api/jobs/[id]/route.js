import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { kickJob, ACTIVE_STATUSES } from "@/lib/generation/runner";

export const dynamic = "force-dynamic";

// If a running job has not moved for this long and nobody holds it, it is restarted.
const STALL_SECONDS = 25;

/**
 * GET /api/jobs/:id
 * Progress of one of the signed-in user's documents. When the job is done it returns the same
 * result the old generate route returned (a locked preview, or the full document).
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized. Login required." }, { status: 401 });
    }

    // The jobs table is not readable by users directly (it holds the full locked text while it is
    // being written), so it is read with the service role and filtered to this user.
    const admin = createAdminClient();
    const { data: job, error } = await admin
      .from("generation_jobs")
      .select("id, action_type, status, preview_mode, stage_index, stage_count, stage_label, result, error, locked_until, updated_at, created_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Job lookup error:", error);
      return NextResponse.json({ error: "DATABASE_ERROR", message: "Could not check your document." }, { status: 500 });
    }
    if (!job) return NextResponse.json({ error: "NOT_FOUND", message: "Document job not found." }, { status: 404 });

    // Restart a stalled job (for example, if a hand-over between stages was missed).
    if (ACTIVE_STATUSES.includes(job.status)) {
      const lockFree = !job.locked_until || new Date(job.locked_until).getTime() < Date.now();
      const idleSeconds = (Date.now() - new Date(job.updated_at).getTime()) / 1000;
      if (lockFree && idleSeconds > STALL_SECONDS) {
        const origin = new URL(request.url).origin;
        after(() => kickJob(origin, job.id));
      }
    }

    const response = {
      job_id: job.id,
      action_type: job.action_type,
      status: job.status,
      preview_mode: job.preview_mode,
      stage_index: job.stage_index,
      stage_count: job.stage_count,
      stage_label: job.stage_label,
      created_at: job.created_at,
    };

    if (job.status === "failed") response.error = job.error || "Generation failed. You have not been charged.";

    if (job.status === "done" && job.result) {
      response.result = { ...job.result };
      // Full documents: send the text, read from the user's own documents (RLS applies).
      if (!job.result.locked && job.result.document_id) {
        const { data: doc } = await supabase
          .from("documents")
          .select("generated_content")
          .eq("id", job.result.document_id)
          .eq("user_id", user.id)
          .maybeSingle();
        response.result.payload = doc?.generated_content ?? "";
      }
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("Job status error:", err);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not check your document." }, { status: 500 });
  }
}
