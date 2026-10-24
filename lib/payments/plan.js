// Plan helpers shared by the payment webhooks and the routes that check access.

// A monthly payment keeps the plan active for this many days (a few days of grace on top of 30).
export const PLAN_PERIOD_DAYS = 35;

// Consultant Enterprise stores 9999 proposals to mean "unlimited".
export const UNLIMITED_PROPOSALS = 9999;

export function planExpiryFromNow() {
  return new Date(Date.now() + PLAN_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

// A paid plan whose period has run out counts as "free". Rows with no expiry date are left alone.
export function effectiveTier(sub) {
  const tier = sub?.tier || "free";
  if (tier === "free") return "free";
  if (sub?.plan_expires_at && new Date(sub.plan_expires_at).getTime() < Date.now()) return "free";
  return tier;
}

// Returns the plan and proposal balance that should actually apply right now.
// An expired Enterprise plan must not keep its "unlimited" 9999 balance.
export function normalizeSubscription(sub) {
  const tier = effectiveTier(sub);
  const proposals = sub?.proposals_remaining ?? 0;
  return {
    tier,
    proposals_remaining:
      tier !== "consultant_enterprise" && proposals >= UNLIMITED_PROPOSALS ? 0 : proposals,
  };
}
