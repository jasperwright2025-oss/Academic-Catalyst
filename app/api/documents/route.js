import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DOCUMENT_TYPES = ["proposal", "field_data", "dissertation"];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * GET /api/documents?page=1&limit=20&type=proposal
 * Lists the signed-in user's saved documents, newest first.
 * The full text is left out of the list on purpose (it can be very large);
 * fetch it with GET /api/documents/:id.
 */
export async function GET(request) {
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
        { status: 401 }
      );
    }

    // ---------- 2. Validate query params ----------
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(params.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );
    const type = params.get("type");

    if (type && !DOCUMENT_TYPES.includes(type)) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          message: `type must be one of: ${DOCUMENT_TYPES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // ---------- 3. Query (user_id filter on top of RLS, as defence in depth) ----------
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("documents")
      .select(
        "id, document_type, research_topic, target_institution, is_unlocked, created_at",
        { count: "exact" }
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (type) query = query.eq("document_type", type);

    const { data, count, error } = await query;

    if (error) {
      console.error("Documents list error:", error);
      return NextResponse.json(
        { error: "DATABASE_ERROR", message: "Could not load your documents." },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    return NextResponse.json({
      success: true,
      documents: data || [],
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
        has_more: to + 1 < total,
      },
    });
  } catch (error) {
    console.error("Documents list server error:", error);
    return NextResponse.json(
      { error: "SERVER_FAULT", message: "Could not load your documents." },
      { status: 500 }
    );
  }
}
