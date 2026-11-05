import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchWorks } from "@/lib/tools/openalex";

export const dynamic = "force-dynamic";

/**
 * GET /api/literature/search?q=...&from=2015&oa=1&reviews=1
 * Searches published research. Searching is free and does not count towards the monthly limit;
 * only the evidence summary does.
 */
export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized. Login required." }, { status: 401 });

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim().slice(0, 300);
  if (q.length < 3) {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Please type a research question or a few key words." }, { status: 400 });
  }
  const from = Number(url.searchParams.get("from"));
  try {
    const result = await searchWorks(q, {
      fromYear: from >= 1950 && from <= new Date().getFullYear() ? from : undefined,
      openAccessOnly: url.searchParams.get("oa") === "1",
      reviewsOnly: url.searchParams.get("reviews") === "1",
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Literature search error:", err?.status, err?.message);
    return NextResponse.json(
      { error: "SEARCH_UNAVAILABLE", message: "The research database did not respond. Please try again in a moment." },
      { status: 503 }
    );
  }
}
