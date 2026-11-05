import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOOL_KEYS, toolUsage } from "@/lib/tools/limits";
import { runTool, ToolOutputError } from "@/lib/tools/run";
import { WebSearchUnavailableError } from "@/lib/generation/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LIVE_TOOLS = ["topic_validator", "smart_objectives"];
const clip = (v, n) => String(v ?? "").trim().slice(0, n);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function toolFrom(params) {
  const tool = TOOL_KEYS[params.tool];
  return LIVE_TOOLS.includes(tool) ? tool : null;
}

/**
 * GET /api/tools/:tool  ->  { usage, runs }  this month's free uses and the user's recent results.
 */
export async function GET(request, { params }) {
  const tool = toolFrom(await params);
  if (!tool) return NextResponse.json({ error: "NOT_FOUND", message: "This tool is not available yet." }, { status: 404 });
  const { supabase, user } = await signedInUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized. Login required." }, { status: 401 });

  const usage = await toolUsage(createAdminClient(), user.id, tool);
  const { data: runs } = await supabase
    .from("tool_runs")
    .select("id, project_id, input, output, created_at")
    .eq("user_id", user.id)
    .eq("tool", tool)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ usage, runs: runs || [] });
}

/**
 * POST /api/tools/:tool  { topic, level, institution, notes, approach, timeframe, project_id }
 * Runs the tool, saves the result to the user's project (creating one if needed) and returns it.
 */
export async function POST(request, { params }) {
  const startedAt = Date.now();
  const tool = toolFrom(await params);
  if (!tool) return NextResponse.json({ error: "NOT_FOUND", message: "This tool is not available yet." }, { status: 404 });

  const { supabase, user } = await signedInUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized. Login required." }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Invalid request." }, { status: 400 });
  }

  const input = {
    topic: clip(body.topic, 600),
    level: clip(body.level, 60),
    institution: clip(body.institution, 200),
    notes: clip(body.notes, 2000),
    approach: clip(body.approach, 60),
    timeframe: clip(body.timeframe, 100),
  };
  if (input.topic.length < 10) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "Please describe your topic in at least a few words." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const usage = await toolUsage(admin, user.id, tool);
  if (!usage.unlimited && usage.remaining <= 0) {
    return NextResponse.json(
      {
        error: "LIMIT_REACHED",
        message: "You have used this month's free uses of this tool. They reset on the 1st, or choose a plan for unlimited use.",
        usage,
      },
      { status: 402 }
    );
  }

  // The project this work belongs to: the one chosen, or a new one named after the topic.
  let projectId = UUID.test(String(body.project_id || "")) ? body.project_id : null;
  if (projectId) {
    const { data: owned } = await supabase.from("projects").select("id").eq("id", projectId).eq("user_id", user.id).maybeSingle();
    if (!owned) projectId = null;
  }
  if (!projectId) {
    const { data: created, error: projErr } = await supabase
      .from("projects")
      .insert({ user_id: user.id, title: input.topic.slice(0, 160), topic: input.topic, level: input.level || null, institution: input.institution || null })
      .select("id")
      .single();
    if (projErr) console.error("Project create error:", projErr);
    projectId = created?.id ?? null;
  }

  let output;
  try {
    ({ output } = await runTool(tool, input, { deadlineMs: startedAt + 270 * 1000 }));
  } catch (err) {
    if (err instanceof WebSearchUnavailableError) {
      return NextResponse.json(
        { error: "SEARCH_UNAVAILABLE", message: "The study search is unavailable right now. Nothing was counted. Please try again shortly." },
        { status: 503 }
      );
    }
    console.error("Tool run error:", tool, err?.status, err?.message);
    return NextResponse.json(
      {
        error: err instanceof ToolOutputError ? "NO_RESULT" : "SERVER_FAULT",
        message: "The tool could not finish this time. Nothing was counted. Please try again.",
      },
      { status: 502 }
    );
  }

  const { data: run, error: runErr } = await admin
    .from("tool_runs")
    .insert({ user_id: user.id, project_id: projectId, tool, input, output })
    .select("id, project_id, input, output, created_at")
    .single();
  if (runErr) console.error("Tool run save error:", runErr);

  if (projectId) {
    await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);
  }

  return NextResponse.json({
    run: run || { project_id: projectId, input, output, created_at: new Date().toISOString() },
    usage: await toolUsage(admin, user.id, tool),
  });
}
