import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTS } from "@/lib/payments/catalog";

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
      .select(
        "tier, proposals_remaining, dissertations_remaining, data_simulations_remaining"
      )
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
    const tier = sub?.tier ?? "free";
    const proposals = sub?.proposals_remaining ?? 0;
    const dissertations = sub?.dissertations_remaining ?? 0;
    const simulations = sub?.data_simulations_remaining ?? 0;

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
        plan: {
          tier,
          name:
            tier === "free"
              ? "Free"
              : (planProduct?.label ?? tier).replace(/ \(monthly\)$/, ""),
          is_subscribed: tier !== "free",
          monthly_price_usd: planProduct?.amount ?? 0,
        },
        credits: {
          proposals: { remaining: proposals, unlimited: isEnterprise },
          dissertations: { remaining: dissertations, unlimited: false },
          data_simulations: {
            remaining: simulations,
            included_in_plan: hasDataSuite,
          },
        },
        can_generate: {
          generate_proposal: isEnterprise || proposals > 0,
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
