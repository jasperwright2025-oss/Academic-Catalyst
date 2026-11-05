// Objectives saved by the SMART Objectives Builder, as plain numbered text.
export function objectivesText(output) {
  if (!output?.objectives?.length) return "";
  const lines = output.general_objective ? [`General objective: ${output.general_objective}`] : [];
  output.objectives.forEach((o, i) => lines.push(`${i + 1}. ${o.objective}`));
  return lines.join("\n");
}

// The methodology plan, as compact text for the proposal writer.
export function methodologyText(output) {
  if (!output) return "";
  const lines = [];
  if (output.approach_and_design) lines.push(`Design: ${output.approach_and_design}`);
  if (output.population) lines.push(`Population: ${output.population}`);
  if (output.sample_size?.recommended) {
    lines.push(`Sample size: ${output.sample_size.recommended.n} (${output.sample_size.recommended.name}); calculation: ${output.sample_size.methods.map((m) => m.working).join(" | ")}`);
  }
  if (output.sampling) lines.push(`Sampling: ${output.sampling}`);
  (output.sample_breakdown || []).forEach((g) => lines.push(`- ${g.group}: ${g.number} (${g.selection})`));
  (output.instruments || []).forEach((x) => lines.push(`Instrument: ${x.instrument} (objectives ${x.for_objectives}): ${x.description}`));
  (output.analysis || []).forEach((a) => lines.push(`Analysis for "${a.objective}": ${a.method}; ${a.software}`));
  if (output.validity_reliability) lines.push(`Validity and reliability: ${output.validity_reliability}`);
  return lines.join("\n");
}

// Everything the planning tools produced for a project, for the full proposal.
export async function planningWork(supabase, userId, projectId) {
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, topic, level, institution")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!project) return null;

  const latest = {};
  const { data: runs } = await supabase
    .from("tool_runs")
    .select("tool, output, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  for (const r of runs || []) if (!latest[r.tool]) latest[r.tool] = r.output;

  const parts = [`Chosen title or topic: ${project.topic || project.title}`];
  if (latest.topic_validator?.red_flags?.length) parts.push(`Points raised by the topic check: ${latest.topic_validator.red_flags.join(" ")}`);
  const objectives = objectivesText(latest.smart_objectives);
  if (objectives) parts.push(`Objectives:\n${objectives}`);
  (latest.smart_objectives?.objectives || []).forEach((o, i) => {
    parts.push(`Research question ${i + 1}: ${o.research_question}${o.hypothesis ? ` | Hypothesis: ${o.hypothesis}` : ""}`);
  });
  const lit = latest.literature_review;
  if (lit?.papers?.length) {
    parts.push(
      `Studies the researcher selected (verified database records; cite them where relevant, with these exact details):\n${lit.papers.map((p) => `- ${p.reference}`).join("\n")}`
    );
    if (lit.overview) parts.push(`The researcher's evidence summary: ${lit.overview}`);
    if (lit.gaps?.length) parts.push(`Gaps identified: ${lit.gaps.join(" ")}`);
  }
  const method = methodologyText(latest.methodology);
  if (method) parts.push(`Methodology plan:\n${method}`);

  return { project, text: parts.join("\n\n"), hasObjectives: Boolean(objectives), hasMethodology: Boolean(method), hasLiterature: Boolean(lit?.papers?.length) };
}
