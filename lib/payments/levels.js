// Academic levels for level-based pricing (10 Nov 2026).
// A postgraduate diploma is priced and written at the master's level.

export const LEVELS = ["undergraduate", "masters", "phd"];
export const DEFAULT_LEVEL = "masters";

export const LEVEL_LABELS = {
  undergraduate: "Undergraduate",
  masters: "Postgraduate diploma or master's",
  phd: "PhD",
};

export const SHORT_LEVEL_LABELS = {
  undergraduate: "Undergraduate",
  masters: "Master's",
  phd: "PhD",
};

export function normaliseLevel(value) {
  return LEVELS.includes(value) ? value : DEFAULT_LEVEL;
}

// Document kinds, keyed by the generation action.
export const KIND_FOR_ACTION = {
  generate_proposal: "proposal",
  compile_dissertation: "dissertation",
  simulate_data: "simulation",
};

// Most words allowed in the main body for each level. The data pack has no word cap.
export const WORD_ALLOWANCE = {
  proposal: { undergraduate: 4000, masters: 8000, phd: 12000 },
  dissertation: { undergraduate: 12000, masters: 18000, phd: 25000 },
};

// Depth expected at each level. It shapes the writing so each tier fits its own programme.
const DEPTH = {
  undergraduate:
    "Write at undergraduate (bachelor's) level: one main theory or a simple conceptual framework, a focused literature review of about 20 to 30 well-chosen sources, a clear and practical design, and descriptive statistics with simple tests of association where the data allow.",
  masters:
    "Write at postgraduate diploma or master's level: a theoretical and conceptual framework that is argued, a critical literature review of about 35 to 50 sources, a fully justified design, and inferential analysis suited to the objectives.",
  phd:
    "Write at doctoral (PhD) level: a clearly stated original contribution, a theoretical framework that engages competing theories, an exhaustive critical review of about 60 or more sources, a rigorous design with advanced analysis, and explicit discussion of contribution to theory, method and practice.",
};

const DATA_DEPTH = {
  undergraduate: "Size the practice dataset and analyses for an undergraduate project: a modest sample, descriptive statistics and simple tests.",
  masters: "Size the practice dataset and analyses for a postgraduate diploma or master's study: a realistic sample and inferential tests that match each objective.",
  phd: "Size the practice dataset and analyses for a doctoral study: a large sample, multivariate or advanced models, and robustness checks.",
};

// Extra instructions added to the user prompt for the chosen level.
export function levelInstructions(actionType, level) {
  const lvl = normaliseLevel(level);
  const kind = KIND_FOR_ACTION[actionType];
  if (kind === "simulation") {
    return `\n<academic_level>\n${LEVEL_LABELS[lvl]}. ${DATA_DEPTH[lvl]}\n</academic_level>\n`;
  }
  const cap = WORD_ALLOWANCE[kind]?.[lvl];
  if (!cap) return "";
  return `\n<academic_level>\n${LEVEL_LABELS[lvl]}. ${DEPTH[lvl]}
Length cap for this order: the main body must not exceed ${cap.toLocaleString("en-GB")} words. If the institution's own limit is lower, follow the institution's limit. If it is higher, or no limit is found, use ${cap.toLocaleString("en-GB")} words as the LENGTH BUDGET. The cover page, table of contents, references and appendices are not counted.\n</academic_level>\n`;
}

// PhD orders promise about 60 or more sources, so their research stage may verify more of them,
// and the literature review stage may verify a few more while it writes. Other levels keep the
// standard search budget.
export const PHD_RESEARCH_SEARCHES = 24;
export const PHD_LITERATURE_SEARCHES = 8;

export function stageForLevel(stage, level) {
  if (!stage || normaliseLevel(level) !== "phd") return stage;
  if (stage.kind === "research") {
    return { ...stage, searchLimit: Math.max(stage.searchLimit || 0, PHD_RESEARCH_SEARCHES) };
  }
  if (stage.key === "literature" || stage.key === "chapter2") {
    return { ...stage, searchLimit: Math.max(stage.searchLimit || 0, PHD_LITERATURE_SEARCHES) };
  }
  return stage;
}
