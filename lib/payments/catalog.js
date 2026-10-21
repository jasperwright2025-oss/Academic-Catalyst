// --- SECURE SERVER-SIDE BILLING CATALOG ---
// This file locks your premium dollar values where users cannot alter them.

export const PRODUCTS = {
  // --- PAY-AS-YOU-GO SINGLE DOCUMENTS ---
  proposal_single: {
    key: "proposal_single",
    label: "Premium Proposal Draft",
    type: "single",
    amount: 80.00,
    currency: "USD",
    grant_proposals: 1,
    grant_dissertations: 0
  },
  data_simulation_single: {
    key: "data_simulation_single",
    label: "Empirical Field Data Simulation",
    type: "single",
    amount: 135.00,
    currency: "USD",
    grant_proposals: 0,
    grant_dissertations: 0 // Unlocks the data simulator for 1 run
  },
  dissertation_single: {
    key: "dissertation_single",
    label: "Distinction-Grade Dissertation Report",
    type: "single",
    amount: 540.00,
    currency: "USD",
    grant_proposals: 0,
    grant_dissertations: 1
  },

  // --- RECURRING MONTHLY SUBSCRIPTION PLANS ---
  proposal_architect: {
    key: "proposal_architect",
    label: "Proposal Architect Plan",
    type: "subscription",
    amount: 70.00,
    currency: "USD",
    grant_proposals: 5,
    grant_dissertations: 0
  },
  data_suite: {
    key: "data_suite",
    label: "Data & Analysis Suite",
    type: "subscription",
    amount: 110.00,
    currency: "USD",
    grant_proposals: 5,
    grant_dissertations: 0 // Unlocks full access to data simulator
  },
  consultant_enterprise: {
    key: "consultant_enterprise",
    label: "Consultant Enterprise Suite",
    type: "subscription",
    amount: 400.00,
    currency: "USD",
    grant_proposals: 9999, // Unlimited proposals for agencies
    grant_dissertations: 3
  }
};
