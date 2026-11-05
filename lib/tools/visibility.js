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

// Applies the free-plan limits to one saved run.
export function limitRun(run, unlimited) {
  if (!run || unlimited) return run;
  if (run.tool === "literature_review" || run.output?.papers) {
    return { ...run, output: limitLiterature(run.output) };
  }
  return run;
}
