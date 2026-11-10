/**
 * Single source of truth for what can be bought.
 * Prices live here on the server, never in the request from the browser.
 *
 * type "one_off"      -> credits are ADDED to the user's balance.
 * type "subscription" -> tier is set and the monthly allotment is applied on every successful charge.
 *                        Card payers can choose automatic monthly renewal on the Pesapal payment page.
 */
export const PRODUCTS = {
  // ---------- Single purchases, priced by academic level (10 Nov 2026) ----------
  // The master's keys keep their original names so orders placed before the change still work.
  // A postgraduate diploma is bought at the master's level. A credit also covers lower levels.
  proposal_undergraduate: {
    type: "one_off",
    label: "Research Proposal (Undergraduate)",
    kind: "proposal",
    level: "undergraduate",
    amount: 25,
    currency: "USD",
    grants: { proposals_undergraduate: 1 },
  },
  proposal_single: {
    type: "one_off",
    label: "Research Proposal (Master's)",
    kind: "proposal",
    level: "masters",
    amount: 80,
    currency: "USD",
    grants: { proposals_masters: 1 },
  },
  proposal_phd: {
    type: "one_off",
    label: "Research Proposal (PhD)",
    kind: "proposal",
    level: "phd",
    amount: 100,
    currency: "USD",
    grants: { proposals_phd: 1 },
  },
  data_simulation_undergraduate: {
    type: "one_off",
    label: "Practice Data Pack (Undergraduate)",
    kind: "simulation",
    level: "undergraduate",
    amount: 40,
    currency: "USD",
    grants: { simulations_undergraduate: 1 },
  },
  data_simulation_single: {
    type: "one_off",
    label: "Practice Data Pack (Master's)",
    kind: "simulation",
    level: "masters",
    amount: 135,
    currency: "USD",
    grants: { simulations_masters: 1 },
  },
  data_simulation_phd: {
    type: "one_off",
    label: "Practice Data Pack (PhD)",
    kind: "simulation",
    level: "phd",
    amount: 160,
    currency: "USD",
    grants: { simulations_phd: 1 },
  },
  dissertation_undergraduate: {
    type: "one_off",
    label: "Dissertation Draft Report (Undergraduate)",
    kind: "dissertation",
    level: "undergraduate",
    amount: 150,
    currency: "USD",
    grants: { dissertations_undergraduate: 1 },
  },
  dissertation_single: {
    type: "one_off",
    label: "Dissertation Draft Report (Master's)",
    kind: "dissertation",
    level: "masters",
    amount: 540,
    currency: "USD",
    grants: { dissertations_masters: 1 },
  },
  dissertation_phd: {
    type: "one_off",
    label: "Dissertation Draft Report (PhD)",
    kind: "dissertation",
    level: "phd",
    amount: 700,
    currency: "USD",
    grants: { dissertations_phd: 1 },
  },

  // ---------- Monthly subscriptions ----------
  proposal_architect: {
    type: "subscription",
    label: "Proposal Architect (monthly)",
    amount: 70,
    currency: "USD",
    tier: "proposal_architect",
    grants: { proposals: 5, dissertations: 0 },
  },
  data_suite: {
    type: "subscription",
    label: "Data Suite (monthly)",
    amount: 110,
    currency: "USD",
    tier: "data_suite",
    grants: { proposals: 5, dissertations: 0 },
  },
  consultant_enterprise: {
    type: "subscription",
    label: "Consultant Enterprise (monthly)",
    amount: 400,
    currency: "USD",
    tier: "consultant_enterprise",
    grants: { proposals: 9999, dissertations: 3 }, // 9999 = unlimited
  },
};

// The single-purchase key for a kind of document at a level.
export function singleProductKey(kind, level) {
  return Object.keys(PRODUCTS).find(
    (k) => PRODUCTS[k].type === "one_off" && PRODUCTS[k].kind === kind && PRODUCTS[k].level === level
  );
}
