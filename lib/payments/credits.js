// Credit balances and spending for level-based pricing.
//
// Each document kind has:
//  - a general column (proposals_remaining, ...): subscription allotments and earlier purchases,
//    valid for ANY level;
//  - one column per level (proposals_undergraduate, proposals_masters, proposals_phd, ...),
//    filled by single purchases. A credit also covers any LOWER level.
// Every change raises credits_version, and only lands if the version is unchanged since the read,
// so two payments or spends at the same moment cannot overwrite each other.

import { LEVELS, normaliseLevel } from "./levels.js";
import { effectiveTier, UNLIMITED_PROPOSALS } from "./plan.js";

export const CREDIT_COLUMNS = {
  proposal: { general: "proposals_remaining", prefix: "proposals_" },
  dissertation: { general: "dissertations_remaining", prefix: "dissertations_" },
  simulation: { general: "data_simulations_remaining", prefix: "simulations_" },
};

const LEVEL_COLUMNS = Object.values(CREDIT_COLUMNS).flatMap((c) => LEVELS.map((l) => c.prefix + l));
const GENERAL_COLUMNS = Object.values(CREDIT_COLUMNS).map((c) => c.general);

export const SUBSCRIPTION_SELECT = [
  "tier",
  "plan_expires_at",
  "free_previews_used",
  "credits_version",
  ...GENERAL_COLUMNS,
  ...LEVEL_COLUMNS,
].join(", ");

// Plans that need no credit for a kind of document.
export function isIncludedInPlan(sub, kind) {
  const tier = effectiveTier(sub);
  if (tier === "consultant_enterprise") return true;
  if (kind === "simulation") return tier === "data_suite";
  return false;
}

// The general proposal balance, ignoring an expired Enterprise "unlimited" 9999.
function generalBalance(sub, kind) {
  const value = sub?.[CREDIT_COLUMNS[kind].general] ?? 0;
  if (kind === "proposal" && value >= UNLIMITED_PROPOSALS && effectiveTier(sub) !== "consultant_enterprise") return 0;
  return value;
}

// Columns that can pay for a document of this kind and level, in the order they are spent:
// the general balance first (subscription credits refill monthly), then the exact level, then higher levels.
export function payingColumns(kind, level) {
  const c = CREDIT_COLUMNS[kind];
  const from = LEVELS.indexOf(normaliseLevel(level));
  return [c.general, ...LEVELS.slice(from).map((l) => c.prefix + l)];
}

function balanceOf(sub, kind, column) {
  return column === CREDIT_COLUMNS[kind].general ? generalBalance(sub, kind) : sub?.[column] ?? 0;
}

// True when the user can get this document now without paying (plan or credit).
export function canPay(sub, kind, level) {
  if (isIncludedInPlan(sub, kind)) return true;
  return payingColumns(kind, level).some((col) => balanceOf(sub, kind, col) > 0);
}

/**
 * Spends one credit for a document of this kind and level.
 * Returns { ok: true, column } (column is null when the plan includes it),
 * or { ok: false, reason: "NO_CREDIT" | "CONFLICT" | "DATABASE_ERROR" }.
 */
export async function spendCredit(admin, userId, kind, level) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: sub, error } = await admin
      .from("subscriptions")
      .select(SUBSCRIPTION_SELECT)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !sub) return { ok: false, reason: "DATABASE_ERROR", error };
    if (isIncludedInPlan(sub, kind)) return { ok: true, column: null };

    const column = payingColumns(kind, level).find((col) => balanceOf(sub, kind, col) > 0);
    if (!column) return { ok: false, reason: "NO_CREDIT" };

    const version = sub.credits_version ?? 0;
    const { data: updated, error: updErr } = await admin
      .from("subscriptions")
      .update({ [column]: balanceOf(sub, kind, column) - 1, credits_version: version + 1 })
      .eq("user_id", userId)
      .eq("credits_version", version)
      .select("user_id");
    if (updErr) return { ok: false, reason: "DATABASE_ERROR", error: updErr };
    if (updated && updated.length === 1) return { ok: true, column };
  }
  return { ok: false, reason: "CONFLICT" };
}

// Gives back a credit spent by spendCredit (for example when saving the document failed).
export async function refundCredit(admin, userId, column) {
  if (!column) return true;
  return addCredits(admin, userId, { [column]: 1 });
}

// Adds credits to the given columns. Returns true on success.
export async function addCredits(admin, userId, amounts) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: sub, error } = await admin
      .from("subscriptions")
      .select(SUBSCRIPTION_SELECT)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !sub) return false;
    const version = sub.credits_version ?? 0;
    const next = { credits_version: version + 1 };
    for (const [col, n] of Object.entries(amounts)) next[col] = (sub[col] ?? 0) + n;
    const { data: updated, error: updErr } = await admin
      .from("subscriptions")
      .update(next)
      .eq("user_id", userId)
      .eq("credits_version", version)
      .select("user_id");
    if (updErr) return false;
    if (updated && updated.length === 1) return true;
  }
  return false;
}

// Balances for the dashboard: { proposal: { general, undergraduate, masters, phd, total, unlimited }, ... }
export function creditSummary(sub) {
  const out = {};
  for (const kind of Object.keys(CREDIT_COLUMNS)) {
    const c = CREDIT_COLUMNS[kind];
    const row = { general: generalBalance(sub, kind) };
    for (const l of LEVELS) row[l] = sub?.[c.prefix + l] ?? 0;
    row.total = row.general + LEVELS.reduce((s, l) => s + row[l], 0);
    row.unlimited = isIncludedInPlan(sub, kind);
    out[kind] = row;
  }
  return out;
}
