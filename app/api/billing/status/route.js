import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTS } from "@/lib/payments/catalog";
import { FREE_PREVIEW_LIMIT } from "@/lib/documents/preview";
import { effectiveTier } from "@/lib/payments/plan";
import { SUBSCRIPTION_SELECT, creditSummary } from "@/lib/payments/credits";
import { isAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/billing/status
 * Powers the dashboard: active plan, remaining credits, what the user can run
 * right now, and their latest payments.
 *
 * can_generate mirrors the checks in /api/generate so the UI can disable buttons
 * early. The generate route stays the authority; never rely on this for security.
 */
export async function GET() {
  try {
    // ---------- 1. Authenticate ----------
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Unauthorized. Login required." },
        { status: 401, headers: NO_STORE }
      );
    }

    // ---------- 2. Subscription (RLS limits this to the signed-in user) ----------
    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select(SUBSCRIPTION_SELECT)
      .eq("user_id", user.id)
      .maybeSingle();

    if (subErr) {
      console.error("Billing status subscription error:", subErr);
      return NextResponse.json(
        { error: "DATABASE_ERROR", message: "Could not load your plan." },
        { status: 500, headers: NO_STORE }
      );
    }

    // A user with no row yet is treated as free with no credits.
    const tier = effectiveTier(sub);
    // Totals across the general balance and every level; by_level shows the split.
    const summary = creditSummary(sub);
    const proposals = summary.proposal.total;
    const dissertations = summary.dissertation.total;
    const simulations = summary.simulation.total;
    const previewsRemaining = Math.max(0, FREE_PREVIEW_LIMIT - (sub?.free_previews_used ?? 0));

    const isEnterprise = tier === "consultant_enterprise";
    const hasDataSuite = tier === "data_suite" || isEnterprise;
    const planProduct = PRODUCTS[tier];

    // ---------- 3. Recent payments (non-fatal if this query fails) ----------
    let recentTransactions = [];
    const { data: txs, error: txErr } = await supabase
      .from("transactions")
      .select("product_key, amount, currency, status, paid_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (txErr) {
      console.error("Billing status transactions error:", txErr);
    } else {
      recentTransactions = (txs || []).map((t) => ({
        ...t,
        description: PRODUCTS[t.product_key]?.label ?? t.product_key,
      }));
    }

    return NextResponse.json(
      {
        success: true,
        is_admin: isAdminUser(user),
        plan: {
          tier,
          name:
            tier === "free"
              ? "Free"
              : (planProduct?.label ?? tier).replace(/ \(monthly\)$/, ""),
          is_subscribed: tier !== "free",
          monthly_price_usd: planProduct?.amount ?? 0,
          expires_at: tier === "free" ? null : sub?.plan_expires_at ?? null,
        },
        credits: {
          proposals: { remaining: proposals, unlimited: isEnterprise, by_level: summary.proposal },
          dissertations: { remaining: dissertations, unlimited: false, by_level: summary.dissertation },
          data_simulations: {
            remaining: simulations,
            included_in_plan: hasDataSuite,
            by_level: summary.simulation,
          },
          free_previews_remaining: previewsRemaining,
        },
        can_generate: {
          generate_proposal: isEnterprise || proposals > 0 || previewsRemaining > 0,
          simulate_data: hasDataSuite || simulations > 0,
          compile_dissertation: isEnterprise || dissertations > 0,
        },
        recent_transactions: recentTransactions,
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("Billing status error:", error);
    return NextResponse.json(
      { error: "SERVER_FAULT", message: "Could not load billing status." },
      { status: 500, headers: NO_STORE }
    );
  }
}
