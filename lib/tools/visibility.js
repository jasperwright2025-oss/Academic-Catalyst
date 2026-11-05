import { stripCites } from "@/lib/tools/clean";
// What free users may see of a tool's result. The full result stays in the database and is used
// for the full proposal; free users get a limited preview from the server, so the rest never
// reaches their browser. Paid plans see everything.

const firstSentences = (text, n) => {
  const parts = String(text || "").match(/[^.!?]+[.!?]+(\s|$)/g) || [String(text || "")];
  return parts.slice(0, n).join("").trim();
};

export function limitLiterature(output) {
  if (!output || output.limited) return output;
  const papers = output.papers || [];
  const matrix = output.matrix || [];
  const gaps = output.gaps || [];
  return {
    limited: true,
    overview: output.overview || "",
    themes: (output.themes || []).map((t) => ({
      theme: t.theme,
      synthesis: firstSentences(t.synthesis, 1),
      papers: t.papers || [],
    })),
    matrix: matrix.slice(0, 2),
    gaps: gaps.slice(0, 1),
    // Only what is needed to show in-text citations; no references, links or abstracts.
    papers: papers.map((p) => ({ key: p.key, citation: p.citation })),
    hidden: {
      matrix_rows: Math.max(0, matrix.length - 2),
      gaps: Math.max(0, gaps.length - 1),
      references: papers.length,
    },
    next_step: output.next_step || "",
  };
}

export function limitMethodology(output) {
  if (!output || output.limited) return output;
  const instruments = output.instruments || [];
  const analysis = output.analysis || [];
  return {
    limited: true,
    sample_size: output.sample_size || null,
    philosophy: firstSentences(output.philosophy, 1),
    approach_and_design: output.approach_and_design || "",
    study_area: firstSentences(output.study_area, 1),
    population: firstSentences(output.population, 1),
    sampling: firstSentences(output.sampling, 1),
    instruments: instruments.map((x) => ({ instrument: x.instrument, for_objectives: x.for_objectives })),
    analysis: analysis.slice(0, 1).map((a) => ({ objective: a.objective, method: a.method })),
    hidden: {
      sample_breakdown: (output.sample_breakdown || []).length,
      analysis_rows: Math.max(0, analysis.length - 1),
      ethics: (output.ethics || []).length,
      limitations: (output.limitations || []).length,
      validity: Boolean(output.validity_reliability),
      procedure: Boolean(output.procedure),
    },
  };
}

// Applies the free-plan limits to one saved run.
export function limitRun(run, unlimited) {
  if (!run) return run;
  // Older results were saved with web search markers still in them.
  run = { ...run, output: stripCites(run.output) };
  if (unlimited) return run;
  if (run.tool === "literature_review" || run.output?.papers) {
    return { ...run, output: limitLiterature(run.output) };
  }
  if (run.tool === "methodology") return { ...run, output: limitMethodology(run.output) };
  return run;
}
