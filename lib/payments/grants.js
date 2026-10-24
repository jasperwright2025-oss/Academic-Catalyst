import { planExpiryFromNow } from "./plan.js";

/**
 * Applies a purchase to public.subscriptions with optimistic locking, so two payments landing at
 * the same moment cannot overwrite each other.
 *  - one_off:      credits are added.
 *  - subscription: same tier -> allotment refills up to the monthly amount (never lowers a balance);
 *                  tier change -> balances are set to the new plan's allotment.
 *                  The plan is marked active for PLAN_PERIOD_DAYS from now.
 * Returns true on success.
 */
export async function applyGrants(admin, userId, product) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row, error: readErr } = await admin
      .from("subscriptions")
      .select("tier, proposals_remaining, dissertations_remaining, data_simulations_remaining")
      .eq("user_id", userId)
      .maybeSingle();

    if (readErr) {
      console.error("Subscription read error:", readErr);
      return false;
    }

    const cur = {
      proposals: row?.proposals_remaining ?? 0,
      dissertations: row?.dissertations_remaining ?? 0,
      simulations: row?.data_simulations_remaining ?? 0,
    };
    const g = product.grants;

    let next;
    if (product.type === "one_off") {
      next = {
        proposals_remaining: cur.proposals + (g.proposals || 0),
        dissertations_remaining: cur.dissertations + (g.dissertations || 0),
        data_simulations_remaining: cur.simulations + (g.simulations || 0),
      };
    } else {
      const sameTier = row?.tier === product.tier;
      next = {
        tier: product.tier,
        plan_expires_at: planExpiryFromNow(),
        proposals_remaining: sameTier ? Math.max(cur.proposals, g.proposals) : g.proposals,
        dissertations_remaining: sameTier ? Math.max(cur.dissertations, g.dissertations) : g.dissertations,
        data_simulations_remaining: cur.simulations,
      };
    }

    if (!row) {
      const { error: insertErr } = await admin
        .from("subscriptions")
        .insert({ user_id: userId, tier: "free", ...next });
      if (!insertErr) return true;
      if (insertErr.code === "23505") continue; // row appeared meanwhile, retry
      console.error("Subscription insert error:", insertErr);
      return false;
    }

    const { data: updated, error: updateErr } = await admin
      .from("subscriptions")
      .update(next)
      .eq("user_id", userId)
      .eq("proposals_remaining", row.proposals_remaining)
      .eq("dissertations_remaining", row.dissertations_remaining)
      .eq("data_simulations_remaining", row.data_simulations_remaining)
      .select("user_id");

    if (updateErr) {
      console.error("Subscription update error:", updateErr);
      return false;
    }
    if (updated && updated.length === 1) return true;
    // Someone else changed the row first: loop and recompute.
  }
  return false;
}
