import { NextResponse, after } from "next/server";
import { runNextStage, kickJob } from "@/lib/generation/runner";

// One stage runs per request. The stage itself stops itself before this limit.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/jobs/run  { job_id }
 * Answers straight away, then runs the next stage of the job in the background.
 * It needs no login: it can only advance a job that already exists and was paid for, and the
 * job's lock stops the same stage from running twice.
 */
export async function POST(request) {
  let jobId = "";
  try {
    const body = await request.json();
    jobId = String(body?.job_id || "");
  } catch {
    // fall through to the check below
  }
  if (!UUID.test(jobId)) {
    return NextResponse.json({ error: "BAD_REQUEST", message: "job_id is required." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  after(async () => {
    try {
      const outcome = await runNextStage(jobId, origin);
      if (outcome === "next") await kickJob(origin, jobId);
    } catch (err) {
      console.error("Job run error:", jobId, err?.message || err);
    }
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
