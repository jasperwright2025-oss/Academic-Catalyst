import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects  ->  the user's projects, newest first, each with the latest result of each tool.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized. Login required." }, { status: 401 });

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, topic, level, institution, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("Projects list error:", error);
    return NextResponse.json({ error: "DATABASE_ERROR", message: "Could not load your projects." }, { status: 500 });
  }

  const ids = (projects || []).map((p) => p.id);
  let runs = [];
  if (ids.length) {
    const { data } = await supabase
      .from("tool_runs")
      .select("id, project_id, tool, output, created_at")
      .in("project_id", ids)
      .order("created_at", { ascending: false });
    runs = data || [];
  }

  const withSteps = (projects || []).map((p) => {
    const latest = {};
    for (const r of runs) if (r.project_id === p.id && !latest[r.tool]) latest[r.tool] = r;
    return { ...p, latest };
  });

  return NextResponse.json({ projects: withSteps });
}
