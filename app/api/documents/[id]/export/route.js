import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitClarity } from "@/lib/documents/clarity";
import { logDocumentEvent } from "@/lib/documents/events";
import { markdownToDocx } from "@/lib/export/docx";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fileSlug = (text) =>
  String(text || "document")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "document";

/**
 * GET /api/documents/:id/export?part=document|clarity
 * Downloads one of the user's unlocked documents as a formatted Word file.
 * part=clarity downloads the plain-language clarity note on its own.
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const part = new URL(request.url).searchParams.get("part") === "clarity" ? "clarity" : "document";

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized. Login required." }, { status: 401 });
    }

    const { data: doc, error } = await supabase
      .from("documents")
      .select("id, document_type, research_topic, generated_content, is_unlocked")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Export lookup error:", error);
      return NextResponse.json({ error: "DATABASE_ERROR", message: "Could not load the document." }, { status: 500 });
    }
    if (!doc) return NextResponse.json({ error: "NOT_FOUND", message: "Document not found." }, { status: 404 });
    if (!doc.is_unlocked) {
      return NextResponse.json(
        { error: "LOCKED", message: "Unlock the full document to download it." },
        { status: 403 }
      );
    }

    const { main, note } = splitClarity(doc.generated_content);
    const markdown = part === "clarity" ? note : main;
    if (!markdown) {
      return NextResponse.json({ error: "NOT_FOUND", message: "There is no clarity note for this document." }, { status: 404 });
    }

    const title = part === "clarity" ? `Clarity note: ${doc.research_topic}` : doc.research_topic;
    const buffer = await markdownToDocx(
      part === "clarity" ? `# Clarity note\n\n${markdown}` : markdown,
      { title }
    );

    try {
      await logDocumentEvent(createAdminClient(), doc.id, user.id, "download");
    } catch {
      // never block a download over logging
    }

    const name = `${fileSlug(doc.research_topic)}${part === "clarity" ? "-clarity-note" : ""}.docx`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not create the Word file." }, { status: 500 });
  }
}
