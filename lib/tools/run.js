import { runClaude, extractTag } from "@/lib/generation/claude";
import { TOOL_SPECS } from "@/lib/tools/prompts";

export class ToolOutputError extends Error {}

// Runs one tool and returns its parsed JSON result.
export async function runTool(tool, input, { deadlineMs }) {
  const spec = TOOL_SPECS[tool];
  if (!spec) throw new Error(`Unknown tool: ${tool}`);

  const ai = await runClaude({
    systemPrompt: spec.system,
    userPrompt: spec.user(input),
    maxTokens: spec.maxTokens,
    searchLimit: spec.searchLimit,
    deadlineMs,
    effort: process.env.TOOL_EFFORT || "medium",
  });

  const raw = extractTag(ai.text, "result_json");
  if (!raw) {
    console.error("Tool returned no JSON:", JSON.stringify({ tool, stop: ai.stopReason, turns: ai.turns }));
    throw new ToolOutputError("NO_RESULT");
  }
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return { output: JSON.parse(cleaned), usage: ai.usage };
  } catch {
    console.error("Tool JSON parse failed:", tool, cleaned.slice(0, 300));
    throw new ToolOutputError("BAD_RESULT");
  }
}
