import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLIENT_EVENTS, logDocumentEvent } from "@/lib/documents/events";

export const dynamic = "force-dynamic";

// POST /api/documents/:id/events   body: { "event": "download" | "print" | "copy" }
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized. Login required." }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Request body must be valid JSON." }, { status: 400 });
    }
    if (!CLIENT_EVENTS.includes(body?.event)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Unknown event." }, { status: 400 });
    }

    // Only the owner's unlocked documents count.
    const { data: doc } = await supabase
      .from("documents")
      .select("id, is_unlocked")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!doc || !doc.is_unlocked) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Document not found." }, { status: 404 });
    }

    await logDocumentEvent(createAdminClient(), doc.id, user.id, body.event);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Document event error:", error);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not record that." }, { status: 500 });
  }
}
