import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getUser(supabase) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

const unauthorized = () =>
  NextResponse.json(
    { error: "UNAUTHORIZED", message: "Unauthorized. Login required." },
    { status: 401 }
  );

const notFound = () =>
  NextResponse.json(
    { error: "NOT_FOUND", message: "Document not found." },
    { status: 404 }
  );

// GET /api/documents/:id  -> one document including its full text
export async function GET(request, { params }) {
  try {
    const { id } = await params; // params is a Promise in Next.js 15
    const supabase = await createClient();
    const user = await getUser(supabase);
    if (!user) return unauthorized();

    const { data: doc, error } = await supabase
      .from("documents")
      .select(
        "id, document_type, research_topic, target_institution, generated_content, is_unlocked, created_at"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Document fetch error:", error);
      return NextResponse.json(
        { error: "DATABASE_ERROR", message: "Could not load the document." },
        { status: 500 }
      );
    }
    if (!doc) return notFound();

    // Locked documents never leak their text.
    if (!doc.is_unlocked) {
      return NextResponse.json({
        success: true,
        document: { ...doc, generated_content: null },
        locked: true,
      });
    }

    return NextResponse.json({ success: true, document: doc, locked: false });
  } catch (error) {
    console.error("Document fetch server error:", error);
    return NextResponse.json(
      { error: "SERVER_FAULT", message: "Could not load the document." },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/:id
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await getUser(supabase);
    if (!user) return unauthorized();

    const { data: deleted, error } = await supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      console.error("Document delete error:", error);
      return NextResponse.json(
        { error: "DATABASE_ERROR", message: "Could not delete the document." },
        { status: 500 }
      );
    }
    if (!deleted || deleted.length === 0) return notFound();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Document delete server error:", error);
    return NextResponse.json(
      { error: "SERVER_FAULT", message: "Could not delete the document." },
      { status: 500 }
    );
  }
}
