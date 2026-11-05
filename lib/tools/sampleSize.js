// Sample size calculations, done in code (not by the AI) and returned with the working shown.

const Z = { 90: 1.645, 95: 1.96, 99: 2.576 };
const CHI_SQUARE_1DF = { 90: 2.706, 95: 3.841, 99: 6.635 };

const round = (x) => Math.ceil(x);
const fmt = (x, dp = 4) => Number(x.toFixed(dp)).toString();

/**
 * population: N (whole number) or null when the population is very large or unknown.
 * confidence: 90, 95 or 99. margin: margin of error as a proportion (0.05 = 5%). p: expected proportion (0.5 when unknown).
 * Returns { inputs, methods: [{ name, formula, working, n }], recommended }.
 */
export function sampleSizes({ population, confidence = 95, margin = 0.05, p = 0.5 }) {
  const N = Number.isFinite(population) && population > 0 ? Math.floor(population) : null;
  const z = Z[confidence] ?? Z[95];
  const chi = CHI_SQUARE_1DF[confidence] ?? CHI_SQUARE_1DF[95];
  const e = margin;
  const methods = [];

  // Cochran (with the finite population correction when N is known)
  const n0 = (z * z * p * (1 - p)) / (e * e);
  if (N) {
    const n = n0 / (1 + (n0 - 1) / N);
    methods.push({
      name: "Cochran (1977), with finite population correction",
      formula: "n₀ = Z²·p(1−p) / e²;  n = n₀ / (1 + (n₀ − 1)/N)",
      working: `n₀ = ${z}² × ${p} × ${fmt(1 - p, 2)} / ${e}² = ${fmt(n0, 2)};  n = ${fmt(n0, 2)} / (1 + (${fmt(n0, 2)} − 1)/${N}) = ${fmt(n, 2)}`,
      n: round(n),
    });
  } else {
    methods.push({
      name: "Cochran (1977), large or unknown population",
      formula: "n = Z²·p(1−p) / e²",
      working: `n = ${z}² × ${p} × ${fmt(1 - p, 2)} / ${e}² = ${fmt(n0, 2)}`,
      n: round(n0),
    });
  }

  if (N) {
    // Yamane (1967)
    const ny = N / (1 + N * e * e);
    methods.push({
      name: "Yamane (1967)",
      formula: "n = N / (1 + N·e²)",
      working: `n = ${N} / (1 + ${N} × ${e}²) = ${fmt(ny, 2)}`,
      n: round(ny),
    });

    // Krejcie and Morgan (1970)
    const nk = (chi * N * p * (1 - p)) / (e * e * (N - 1) + chi * p * (1 - p));
    methods.push({
      name: "Krejcie and Morgan (1970)",
      formula: "s = X²·N·P(1−P) / (d²(N−1) + X²·P(1−P))",
      working: `s = ${chi} × ${N} × ${p} × ${fmt(1 - p, 2)} / (${e}² × ${N - 1} + ${chi} × ${p} × ${fmt(1 - p, 2)}) = ${fmt(nk, 2)}`,
      n: round(nk),
    });
  }

  const recommended = N ? methods.find((m) => m.name.startsWith("Krejcie")) : methods[0];
  return {
    inputs: { population: N, confidence, margin, p, z, chi_square: chi },
    methods,
    recommended: { name: recommended.name, n: Math.min(recommended.n, N ?? Infinity) },
  };
}
