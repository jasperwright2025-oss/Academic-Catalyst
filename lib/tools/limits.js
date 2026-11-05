// Free monthly use of the tools. Paid plans have unlimited use.
import { effectiveTier } from "@/lib/payments/plan";

export const FREE_TOOL_USES = 3;

export const TOOL_KEYS = {
  "topic-validator": "topic_validator",
  "smart-objectives": "smart_objectives",
  "literature-review": "literature_review",
  methodology: "methodology",
};

export function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function nextMonthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

// Returns { unlimited, used, limit, remaining, resets_at } for one user and tool.
export async function toolUsage(admin, userId, tool) {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("tier, plan_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  const unlimited = effectiveTier(sub) !== "free";

  const { count } = await admin
    .from("tool_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tool", tool)
    .gte("created_at", monthStart());

  const used = count ?? 0;
  return {
    unlimited,
    used,
    limit: unlimited ? null : FREE_TOOL_USES,
    remaining: unlimited ? null : Math.max(0, FREE_TOOL_USES - used),
    resets_at: nextMonthStart(),
  };
}
