import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COVER_FIELDS = ["position", "affiliation", "registration_number", "programme", "supervisors"];

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 200);

function readProfile(user) {
  const meta = user?.user_metadata || {};
  const cover = meta.cover || {};
  return {
    email: user?.email || "",
    full_name: meta.full_name || "",
    position: cover.position || "",
    affiliation: cover.affiliation || "",
    registration_number: cover.registration_number || "",
    programme: cover.programme || "",
    supervisors: cover.supervisors || "",
  };
}

// GET /api/profile  ->  the details used on the cover page of every document
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized. Login required." }, { status: 401 });
    }
    return NextResponse.json({ success: true, profile: readProfile(user) });
  } catch (error) {
    console.error("Profile read error:", error);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not load your details." }, { status: 500 });
  }
}

// POST /api/profile  body: { full_name, position, affiliation, registration_number, programme, supervisors }
export async function POST(request) {
  try {
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

    const existing = user.user_metadata || {};
    const cover = { ...(existing.cover || {}) };
    for (const field of COVER_FIELDS) {
      if (field in (body || {})) cover[field] = clean(body[field]);
    }

    const data = { ...existing, cover };
    if (typeof body?.full_name === "string" && clean(body.full_name)) data.full_name = clean(body.full_name);

    const { data: updated, error } = await supabase.auth.updateUser({ data });
    if (error) {
      console.error("Profile update error:", error);
      return NextResponse.json({ error: "DATABASE_ERROR", message: "Could not save your details." }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: readProfile(updated.user) });
  } catch (error) {
    console.error("Profile save error:", error);
    return NextResponse.json({ error: "SERVER_FAULT", message: "Could not save your details." }, { status: 500 });
  }
}
