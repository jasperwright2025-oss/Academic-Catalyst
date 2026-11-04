"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBillingStatus, getActiveJob, listDocuments, waitForJob, isUnauthorized } from "@/lib/api/client";
import { TOOLS } from "@/lib/site/content";

const TYPE_LABELS = { proposal: "Research proposal", field_data: "Data simulation", dissertation: "Dissertation report" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Kampala" }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export default function DashboardHome() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [billing, setBilling] = useState(null);
  const [job, setJob] = useState(null);
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState("");

  // Payment providers return customers to /dashboard: hand the return over to the workspace page.
  useEffect(() => {
    const search = window.location.search;
    if (/payment=|OrderTrackingId=/.test(search)) router.replace(`/dashboard/write${search}`);
  }, [router]);

  useEffect(() => {
    let stop = { stopped: false };
    const onAuthError = (err) => {
      if (isUnauthorized(err)) {
        router.push("/login");
        return true;
      }
      return false;
    };

    fetch("/api/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setName((d?.profile?.full_name || "").split(" ")[0]))
      .catch(() => {});
    getBillingStatus().then(setBilling).catch((err) => onAuthError(err) || setError(err.message));
    listDocuments({ page: 1, limit: 5 })
      .then((res) => setDocs(res.documents || []))
      .catch((err) => onAuthError(err) || setDocs([]));

    getActiveJob()
      .then(({ job: active }) => {
        if (!active) return;
        setJob(active);
        waitForJob(active.job_id, { stopSignal: stop, onProgress: setJob })
          .then(() => {
            setJob(null);
            listDocuments({ page: 1, limit: 5 }).then((res) => setDocs(res.documents || []));
            getBillingStatus().then(setBilling);
          })
          .catch(() => setJob(null));
      })
      .catch(() => {});

    return () => {
      stop.stopped = true;
    };
  }, [router]);

  const c = billing?.credits;
  const cards = c
    ? [
        {
          label: "Proposal credits",
          value: c.proposals.unlimited ? "Unlimited" : String(c.proposals.remaining),
          note: c.free_previews_remaining > 0 ? "Free preview available" : "Free preview used",
        },
        { label: "Dissertation credits", value: String(c.dissertations.remaining), note: "Included with Consultant Enterprise" },
        {
          label: "Data simulations",
          value: c.data_simulations.included_in_plan ? "Included" : String(c.data_simulations.remaining),
          note: "Included with Data Suite",
        },
        { label: "Plan", value: billing.plan.name, note: billing.plan.is_subscribed ? "Active subscription" : "Upgrade any time" },
      ]
    : [];

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kampala" })}
          </p>
          <h1 className="mt-1.5 font-serif text-4xl font-medium tracking-tight">
            {greeting()}
            {name ? `, ${name}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/dashboard/write?buy=1" className="rounded-full border border-[#C9CCC4] bg-white px-5 py-3 text-sm font-semibold hover:border-ink">
            Buy credits
          </Link>
          <Link href="/dashboard/write" className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark">
            Write a document
          </Link>
        </div>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Credits */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(cards.length ? cards : Array.from({ length: 4 }, () => null)).map((card, i) => (
          <div key={card?.label || i} className="rounded-2xl border border-line bg-white p-5">
            {card ? (
              <>
                <p className="text-[13px] font-semibold text-muted">{card.label}</p>
                <p className="mt-2 font-serif text-3xl">{card.value}</p>
                <p className="mt-1 text-[13px] text-muted">{card.note}</p>
              </>
            ) : (
              <div className="h-[86px] animate-pulse rounded-lg bg-[#F0F2EC]" />
            )}
          </div>
        ))}
      </div>

      {/* Document being written */}
      {job && (
        <section aria-live="polite" className="mt-6 rounded-2xl bg-mint px-6 py-5">
          <div className="flex flex-wrap justify-between gap-2 text-[15px]">
            <span className="font-bold">Writing your document: {String(job.stage_label || "starting").replace(/^Writing /, "").toLowerCase()}</span>
            {job.stage_count ? (
              <span className="font-semibold text-brand-dark">Step {Math.min((job.stage_index ?? 0) + 1, job.stage_count)} of {job.stage_count}</span>
            ) : null}
          </div>
          <div className="mt-3 h-2 rounded-full bg-[#C6E4DB]">
            <div
              className="h-2 rounded-full bg-brand transition-all duration-700"
              style={{ width: `${Math.max(6, Math.round(((job.stage_index ?? 0) / (job.stage_count || 1)) * 100))}%` }}
            />
          </div>
          <p className="mt-2.5 text-[13px] text-[#2D5B50]">You can leave this page. The work carries on and the document appears in My documents when it is ready.</p>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-6">
        {/* Recent documents */}
        <section aria-labelledby="recent" className="min-w-0 flex-[2_1_480px]">
          <div className="flex items-baseline justify-between">
            <h2 id="recent" className="text-[17px] font-bold">Recent documents</h2>
            <Link href="/dashboard/write#history" className="text-sm font-semibold text-brand">View all</Link>
          </div>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
            {docs === null ? (
              <div className="m-5 h-24 animate-pulse rounded-lg bg-[#F0F2EC]" />
            ) : docs.length === 0 ? (
              <div className="p-6 text-sm text-ink-soft">
                No documents yet.{" "}
                <Link href="/dashboard/write" className="font-semibold text-brand">Start with a free proposal preview →</Link>
              </div>
            ) : (
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th scope="col" className="border-b border-[#ECECE6] px-4 py-3.5 font-semibold">Document</th>
                    <th scope="col" className="border-b border-[#ECECE6] px-4 py-3.5 font-semibold">Type</th>
                    <th scope="col" className="border-b border-[#ECECE6] px-4 py-3.5 font-semibold">Status</th>
                    <th scope="col" className="border-b border-[#ECECE6] px-4 py-3.5 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td className="max-w-[280px] truncate border-b border-[#F0F0EA] px-4 py-3.5 font-semibold">{d.research_topic}</td>
                      <td className="border-b border-[#F0F0EA] px-4 py-3.5 text-ink-soft">{TYPE_LABELS[d.document_type] || d.document_type}</td>
                      <td className="border-b border-[#F0F0EA] px-4 py-3.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${d.is_unlocked ? "bg-mint text-brand-dark" : "bg-sand text-[#7A4A0C]"}`}>
                          {d.is_unlocked ? "Ready" : "Preview"}
                        </span>
                      </td>
                      <td className="border-b border-[#F0F0EA] px-4 py-3.5 text-ink-soft">{formatDate(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Tools */}
        <section aria-labelledby="tools" className="min-w-0 flex-[1_1_300px]">
          <div className="flex items-baseline justify-between">
            <h2 id="tools" className="text-[17px] font-bold">Tools</h2>
            <Link href="/dashboard/tools" className="text-sm font-semibold text-brand">All tools</Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {TOOLS.map((t) => (
              <Link key={t.slug} href="/dashboard/tools" className="flex min-h-24 flex-col gap-1.5 rounded-2xl border border-line bg-white p-4 hover:border-[#C9CCC4]">
                <span className="text-[15px] font-semibold leading-snug">{t.name}</span>
                <span className="text-[13px] text-muted">{t.status === "soon" ? "Opening soon" : t.price}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
