import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spendCredit, refundCredit } from "@/lib/payments/credits";
import { normaliseLevel } from "@/lib/payments/levels";
import { logDocumentEvent } from "@/lib/documents/events";

export const dynamic = "force-dynamic";

/**
 * POST /api/documents/:id/unlock
 * Spends one proposal credit for the document's level (Consultant Enterprise spends none), moves the saved full text
 * from the locked store into the document, and returns the full document.
 * With no credit left it answers PAYWALL_TRIGGERED so the page can open the payment popup.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    // ---------- 1. Authenticate and find the document (RLS: only the owner's rows) ----------
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Unauthorized. Login required." },
        { status: 401 }
      );
    }

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, document_type, research_topic, target_institution, generated_content, is_unlocked, created_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (docErr) {
      console.error("Unlock document lookup error:", docErr);
      return NextResponse.json(
        { error: "DATABASE_ERROR", message: "Could not load the document." },
        { status: 500 }
      );
    }
    if (!doc) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Document not found." }, { status: 404 });
    }
    if (doc.is_unlocked) {
      return NextResponse.json({ success: true, already_unlocked: true, document: doc });
    }
    if (doc.document_type !== "proposal") {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Only proposals can be unlocked this way." },
        { status: 400 }
      );
    }

    // ---------- 2. Load the locked copy and its level (server-only table) ----------
    const admin = createAdminClient();
    const { data: secret, error: secretErr } = await admin
      .from("document_secrets")
      .select("content, academic_level")
      .eq("document_id", String(doc.id))
      .maybeSingle();

    if (secretErr || !secret?.content) {
      console.error("Unlock locked-content error:", secretErr);
      return NextResponse.json(
        { error: "DATABASE_ERROR", message: "The full document could not be found. You have not been charged." },
        { status: 500 }
      );
    }
    const level = normaliseLevel(secret.academic_level);

    // ---------- 3. Spend a credit for this level (a higher level or a plan also covers it) ----------
    const spent = await spendCredit(admin, user.id, "proposal", level);
    if (!spent.ok) {
      if (spent.reason === "NO_CREDIT") {
        return NextResponse.json(
          {
            error: "PAYWALL_TRIGGERED",
            target: "tier_1",
            level,
            message: "Buy a proposal at this level or subscribe to unlock the full document.",
          },
          { status: 403 }
        );
      }
      console.error("Unlock credit spend error:", spent.reason, spent.error);
      return NextResponse.json(
        { error: "CONFLICT", message: "Please try again in a moment." },
        { status: 409 }
      );
    }

    const refund = () => refundCredit(admin, user.id, spent.column);

    // ---------- 4. Move the full text into the document ----------
    const { data: unlocked, error: unlockErr } = await admin
      .from("documents")
      .update({ generated_content: secret.content, is_unlocked: true })
      .eq("id", doc.id)
      .eq("user_id", user.id)
      .eq("is_unlocked", false) // a second, simultaneous unlock gets no row and is refunded
      .select("id");

    if (unlockErr || !unlocked || unlocked.length === 0) {
      console.error("Unlock update error:", unlockErr);
      await refund();
      return NextResponse.json(
        { error: "DATABASE_ERROR", message: "Could not unlock the document. You have not been charged." },
        { status: 500 }
      );
    }

    // Locked copy no longer needed (best effort).
    await admin.from("document_secrets").delete().eq("document_id", String(doc.id));
    await logDocumentEvent(admin, doc.id, user.id, "unlocked");

    return NextResponse.json({
      success: true,
      document: { ...doc, generated_content: secret.content, is_unlocked: true },
    });
  } catch (error) {
    console.error("Unlock server error:", error);
    return NextResponse.json(
      { error: "SERVER_FAULT", message: "Could not unlock the document." },
      { status: 500 }
    );
  }
}
