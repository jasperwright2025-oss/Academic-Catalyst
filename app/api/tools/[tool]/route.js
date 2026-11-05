import { isAiLimitError, alertAiLimit, AI_PAUSED_MESSAGE } from "@/lib/generation/aiLimit";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOOL_KEYS, toolUsage } from "@/lib/tools/limits";
import { runTool, ToolOutputError } from "@/lib/tools/run";
import { WebSearchUnavailableError } from "@/lib/generation/claude";
import { sampleSizes } from "@/lib/tools/sampleSize";
import { objectivesText } from "@/lib/tools/projectText";
import { getWorks } from "@/lib/tools/openalex";
import { limitRun } from "@/lib/tools/visibility";
import { apaReference, inTextCitation } from "@/lib/tools/references";



export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LIVE_TOOLS = ["topic_validator", "smart_objectives", "methodology", "literature_review"];
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

  const shown = (runs || []).map((r) => limitRun({ ...r, tool }, usage.unlimited));
  return NextResponse.json({ usage, runs: shown });
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
  if (tool === "methodology") {
    input.population_description = clip(body.population_description, 1000);
    input.objectives = clip(body.objectives, 4000);
    const population = Number(String(body.population ?? "").replace(/[^0-9]/g, ""));
    input.population = population > 0 ? population : null;
    input.confidence = [90, 95, 99].includes(Number(body.confidence)) ? Number(body.confidence) : 95;
    input.margin = [0.03, 0.05, 0.1].includes(Number(body.margin)) ? Number(body.margin) : 0.05;
  }
  if (input.topic.length < (tool === "literature_review" ? 3 : 10)) {
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

  // Literature review: fetch the chosen papers from the database again, so their details cannot be altered.
  let papers = null;
  if (tool === "literature_review") {
    const ids = Array.isArray(body.paper_ids) ? body.paper_ids.map(String) : [];
    if (ids.length < 2) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Please choose at least two studies to summarise." }, { status: 400 });
    }
    try {
      papers = await getWorks(ids.slice(0, 15));
    } catch (err) {
      console.error("Literature fetch error:", err?.status, err?.message);
      return NextResponse.json(
        { error: "SEARCH_UNAVAILABLE", message: "The research database did not respond. Nothing was counted. Please try again." },
        { status: 503 }
      );
    }
    if (papers.length < 2) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Those studies could not be found. Please search again." }, { status: 400 });
    }
    papers = papers.map((p, i) => ({ ...p, key: `P${i + 1}` }));
    input.paper_ids = papers.map((p) => p.id);
    input.papers_text = papers
      .map((p) => `[${p.key}] ${p.title} (${p.year || "n.d."}; ${p.journal || p.type}; cited ${p.cited_by} times)\nAbstract: ${p.abstract || "No abstract available."}`)
      .join("\n\n");
  }

  // Methodology: use the project's saved objectives when none were typed, and calculate the sample size in code.
  let calculation = null;
  if (tool === "methodology") {
    if (!input.objectives && projectId) {
      const { data: prior } = await supabase
        .from("tool_runs")
        .select("output")
        .eq("project_id", projectId)
        .eq("tool", "smart_objectives")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      input.objectives = objectivesText(prior?.output);
    }
    calculation = sampleSizes({ population: input.population, confidence: input.confidence, margin: input.margin });
    input.sample_size_text = [
      `Population (N): ${calculation.inputs.population ?? "large or unknown"}; confidence ${input.confidence}%; margin of error ${input.margin * 100}%; p = 0.5.`,
      ...calculation.methods.map((m) => `${m.name}: n = ${m.n}`),
      `Recommended sample size: ${calculation.recommended.n} (${calculation.recommended.name}).`,
    ].join("\n");
  }

  let output;
  try {
    ({ output } = await runTool(tool, input, { deadlineMs: startedAt + 270 * 1000 }));
    if (calculation) output.sample_size = calculation;
    // References come from the database records, built in code.
    if (papers) {
      output.papers = papers.map((p) => ({ ...p, citation: inTextCitation(p), reference: apaReference(p) }));
    }
  } catch (err) {
    if (err instanceof WebSearchUnavailableError) {
      return NextResponse.json(
        { error: "SEARCH_UNAVAILABLE", message: "The study search is unavailable right now. Nothing was counted. Please try again shortly." },
        { status: 503 }
      );
    }
    if (isAiLimitError(err)) {
      await alertAiLimit(admin, err);
      console.error("Tool run error: AI usage limit reached", tool);
      return NextResponse.json({ error: "AI_PAUSED", message: AI_PAUSED_MESSAGE.replace("You have not been charged", "Nothing was counted") }, { status: 503 });
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
    .insert({ user_id: user.id, project_id: projectId, tool, input: { ...input, papers_text: undefined }, output })
    .select("id, project_id, input, output, created_at")
    .single();
  if (runErr) console.error("Tool run save error:", runErr);

  if (projectId) {
    const changes = { updated_at: new Date().toISOString() };
    // The objectives are built on the title the user settled on, so it becomes the project's topic.
    if (tool === "smart_objectives") Object.assign(changes, { topic: input.topic, title: input.topic.slice(0, 160) });
    await supabase.from("projects").update(changes).eq("id", projectId);
  }

  const usageAfter = await toolUsage(admin, user.id, tool);
  const saved = run || { project_id: projectId, input, output, created_at: new Date().toISOString() };
  return NextResponse.json({
    run: limitRun({ ...saved, tool }, usageAfter.unlimited),
    usage: usageAfter,
  });
}
