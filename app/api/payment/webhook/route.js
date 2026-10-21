/**
 * Single source of truth for what can be bought.
 * Prices live here on the server, never in the request from the browser.
 *
 * type "one_off"      -> credits are ADDED to the user's balance.
 * type "subscription" -> tier is set and the monthly allotment is applied on every successful charge.
 *                        Needs a Flutterwave payment plan created in the dashboard (plan ID in env).
 */
export const PRODUCTS = {
  // ---------- Pay-as-you-go ----------
  proposal_single: {
    type: "one_off",
    label: "Premium Proposal Draft",
    amount: 80,
    currency: "USD",
    grants: { proposals: 1, dissertations: 0, simulations: 0 },
  },
  data_simulation_single: {
    type: "one_off",
    label: "Empirical Field Data Simulation",
    amount: 135,
    currency: "USD",
    grants: { proposals: 0, dissertations: 0, simulations: 1 },
  },
  dissertation_single: {
    type: "one_off",
    label: "Distinction-Grade Dissertation Report",
    amount: 540,
    currency: "USD",
    grants: { proposals: 0, dissertations: 1, simulations: 0 },
  },

  // ---------- Monthly subscriptions ----------
  proposal_architect: {
    type: "subscription",
    label: "Proposal Architect (monthly)",
    amount: 70,
    currency: "USD",
    tier: "proposal_architect",
    planIdEnv: "FLUTTERWAVE_PLAN_ID_PROPOSAL_ARCHITECT",
    grants: { proposals: 5, dissertations: 0 },
  },
  data_suite: {
    type: "subscription",
    label: "Data Suite (monthly)",
    amount: 110,
    currency: "USD",
    tier: "data_suite",
    planIdEnv: "FLUTTERWAVE_PLAN_ID_DATA_SUITE",
    grants: { proposals: 5, dissertations: 0 },
  },
  consultant_enterprise: {
    type: "subscription",
    label: "Consultant Enterprise (monthly)",
    amount: 400,
    currency: "USD",
    tier: "consultant_enterprise",
    planIdEnv: "FLUTTERWAVE_PLAN_ID_CONSULTANT_ENTERPRISE",
    grants: { proposals: 9999, dissertations: 3 }, // 9999 = unlimited
  },
};

export function getPlanId(product) {
  return product?.planIdEnv ? process.env[product.planIdEnv] : undefined;
}

/** Returns [productKey, product] for a Flutterwave payment plan ID, or null. */
export function findSubscriptionByPlanId(planId) {
  if (planId === undefined || planId === null || planId === "") return null;
  return (
    Object.entries(PRODUCTS).find(
      ([, product]) =>
        product.type === "subscription" &&
        String(getPlanId(product)) === String(planId)
    ) ?? null
  );
}
