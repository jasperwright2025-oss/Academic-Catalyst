import { planExpiryFromNow } from "./plan.js";
import { SUBSCRIPTION_SELECT } from "./credits.js";

/**
 * Applies a purchase to public.subscriptions with optimistic locking (credits_version), so two
 * payments landing at the same moment cannot overwrite each other.
 *  - one_off:      product.grants maps credit columns to amounts, which are added
 *                  (for example { proposals_undergraduate: 1 }).
 *  - subscription: same tier -> allotment refills up to the monthly amount (never lowers a balance);
 *                  tier change -> balances are set to the new plan's allotment.
 *                  The plan is marked active for PLAN_PERIOD_DAYS from now.
 *                  Subscription credits sit in the general columns and cover every level.
 * Returns true on success.
 */
export async function applyGrants(admin, userId, product) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row, error: readErr } = await admin
      .from("subscriptions")
      .select(SUBSCRIPTION_SELECT)
      .eq("user_id", userId)
      .maybeSingle();

    if (readErr) {
      console.error("Subscription read error:", readErr);
      return false;
    }

    const g = product.grants || {};
    let next;
    if (product.type === "one_off") {
      next = {};
      for (const [col, n] of Object.entries(g)) next[col] = (row?.[col] ?? 0) + n;
    } else {
      const sameTier = row?.tier === product.tier;
      const curP = row?.proposals_remaining ?? 0;
      const curD = row?.dissertations_remaining ?? 0;
      next = {
        tier: product.tier,
        plan_expires_at: planExpiryFromNow(),
        proposals_remaining: sameTier ? Math.max(curP, g.proposals) : g.proposals,
        dissertations_remaining: sameTier ? Math.max(curD, g.dissertations) : g.dissertations,
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

    const version = row.credits_version ?? 0;
    const { data: updated, error: updateErr } = await admin
      .from("subscriptions")
      .update({ ...next, credits_version: version + 1 })
      .eq("user_id", userId)
      .eq("credits_version", version)
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
