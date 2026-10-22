import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/documents/:id/unlock
 * Spends one proposal credit (Consultant Enterprise spends none), moves the saved full text
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

    // ---------- 2. Check and spend a credit ----------
    const admin = createAdminClient();
    const { data: sub, error: subErr } = await admin
      .from("subscriptions")
      .select("tier, proposals_remaining")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subErr || !sub) {
      console.error("Unlock subscription error:", subErr);
      return NextResponse.json(
        { error: "DATABASE_ERROR", message: "Could not verify your plan." },
        { status: 500 }
      );
    }

    const isEnterprise = sub.tier === "consultant_enterprise";
    const creditsBefore = sub.proposals_remaining ?? 0;

    if (!isEnterprise) {
      if (creditsBefore <= 0) {
        return NextResponse.json(
          {
            error: "PAYWALL_TRIGGERED",
            target: "tier_1",
            message: "Buy a proposal or subscribe to unlock the full document.",
          },
          { status: 403 }
        );
      }

      // Only succeeds if the balance is still what we just read (stops double spending).
      const { data: spent, error: spendErr } = await admin
        .from("subscriptions")
        .update({ proposals_remaining: creditsBefore - 1 })
        .eq("user_id", user.id)
        .eq("proposals_remaining", creditsBefore)
        .select("user_id");

      if (spendErr || !spent || spent.length === 0) {
        console.error("Unlock credit spend error:", spendErr);
        return NextResponse.json(
          { error: "CONFLICT", message: "Please try again in a moment." },
          { status: 409 }
        );
      }
    }

    const refund = async () => {
      if (!isEnterprise) {
        await admin
          .from("subscriptions")
          .update({ proposals_remaining: creditsBefore })
          .eq("user_id", user.id);
      }
    };

    // ---------- 3. Move the full text into the document ----------
    const { data: secret, error: secretErr } = await admin
      .from("document_secrets")
      .select("content")
      .eq("document_id", String(doc.id))
      .maybeSingle();

    if (secretErr || !secret?.content) {
      console.error("Unlock locked-content error:", secretErr);
      await refund();
      return NextResponse.json(
        { error: "DATABASE_ERROR", message: "The full document could not be found. You have not been charged." },
        { status: 500 }
      );
    }

    const { data: unlocked, error: unlockErr } = await admin
      .from("documents")
      .update({ generated_content: secret.content, is_unlocked: true })
      .eq("id", doc.id)
      .eq("user_id", user.id)
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
