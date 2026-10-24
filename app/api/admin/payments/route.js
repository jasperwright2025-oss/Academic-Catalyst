import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin";
import { PRODUCTS } from "@/lib/payments/catalog";
import { applyGrants } from "@/lib/payments/grants";
import { MOMO_PROVIDER_LIST, isMomoRef, momoCreatedMs } from "@/lib/payments/momo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { response: NextResponse.json({ error: "UNAUTHORIZED", message: "Please sign in." }, { status: 401 }) };
  }
  if (!isAdminUser(user)) {
    return { response: NextResponse.json({ error: "FORBIDDEN", message: "This page is for administrators only." }, { status: 403 }) };
  }
  return { user };
}

// GET /api/admin/payments  ->  mobile money payments waiting for approval
export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { data, error } = await createAdminClient()
      .from("transactions")
      .select("tx_ref, product_key, amount, currency, provider, provider_reference, customer_email")
      .in("provider", MOMO_PROVIDER_LIST)
      .eq("status", "awaiting_review")
      .order("tx_ref", { ascending: false })
      .limit(100);

    if (error) throw error;

    const payments = (data || []).map((row) => ({
      ...row,
      product: PRODUCTS[row.product_key]?.label || row.product_key,
      network: row.provider === "momo-mtn" ? "MTN" : "Airtel",
      created_at: new Date(momoCreatedMs(row.tx_ref) || 0).toISOString(),
    }));

    return NextResponse.json({ success: true, payments });
  } catch (error) {
    console.error("Admin payments list error:", error);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not load payments." }, { status: 500 });
  }
}

// POST /api/admin/payments   body: { "tx_ref": "momo-...", "action": "approve" | "reject" }
export async function POST(request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Request body must be valid JSON." }, { status: 400 });
    }

    const { tx_ref: txRef, action } = body || {};
    if (!isMomoRef(txRef) || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "tx_ref and action (approve or reject) are required." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: row, error: rowErr } = await admin
      .from("transactions")
      .select("tx_ref, user_id, product_key, status")
      .eq("tx_ref", txRef)
      .in("provider", MOMO_PROVIDER_LIST)
      .maybeSingle();

    if (rowErr) throw rowErr;
    if (!row) return NextResponse.json({ error: "NOT_FOUND", message: "Payment not found." }, { status: 404 });
    if (row.status !== "awaiting_review") {
      return NextResponse.json({ error: "CONFLICT", message: "This payment was already handled." }, { status: 409 });
    }

    if (action === "reject") {
      await admin.from("transactions").update({ status: "rejected" }).eq("tx_ref", txRef).eq("status", "awaiting_review");
      return NextResponse.json({ success: true, state: "rejected" });
    }

    const product = PRODUCTS[row.product_key];
    if (!product) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Unknown product on this payment." }, { status: 400 });
    }

    // Claim it first, so a double click cannot grant credits twice.
    const { data: claimed, error: claimErr } = await admin
      .from("transactions")
      .update({ status: "successful", paid_at: new Date().toISOString() })
      .eq("tx_ref", txRef)
      .eq("status", "awaiting_review")
      .select("tx_ref");

    if (claimErr) throw claimErr;
    if (!claimed || claimed.length === 0) {
      return NextResponse.json({ error: "CONFLICT", message: "This payment was already handled." }, { status: 409 });
    }

    const granted = await applyGrants(admin, row.user_id, product);
    if (!granted) {
      await admin.from("transactions").update({ status: "awaiting_review" }).eq("tx_ref", txRef);
      return NextResponse.json({ error: "GRANT_FAILED", message: "Credits could not be saved. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true, state: "approved" });
  } catch (error) {
    console.error("Admin payments action error:", error);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not complete the action." }, { status: 500 });
  }
}
