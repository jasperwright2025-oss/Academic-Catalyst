import { NextResponse, after } from "next/server";
import { runNextStage, kickJob } from "@/lib/generation/runner";

// One stage runs per request. The stage itself stops itself before this limit.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Work stops before maxDuration so the hand-over to the next request always happens.
const REQUEST_BUDGET_SECONDS = 270;
// A stage usually takes 60 to 120 seconds; do not start one with less time than this left.
const MIN_SECONDS_FOR_ANOTHER_STAGE = 150;

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
  // Runs as many stages as fit in this request, then hands over to a fresh request.
  // Fewer hand-overs means Vercel's loop protection is not triggered on long documents.
  const startedAt = Date.now();
  const requestDeadline = startedAt + REQUEST_BUDGET_SECONDS * 1000;
  after(async () => {
    try {
      for (;;) {
        const outcome = await runNextStage(jobId, origin, { deadlineMs: requestDeadline });
        if (outcome !== "next") break;
        const secondsLeft = (requestDeadline - Date.now()) / 1000;
        if (secondsLeft < MIN_SECONDS_FOR_ANOTHER_STAGE) {
          await kickJob(origin, jobId);
          break;
        }
      }
    } catch (err) {
      console.error("Job run error:", jobId, err?.message || err);
    }
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
