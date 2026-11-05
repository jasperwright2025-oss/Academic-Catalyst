import Link from "next/link";

// Shown at the top of a limited tool result, like the proposal preview's unlock box.
export default function UnlockBox({ what, projectId }) {
  return (
    <div className="rounded-xl border border-[#BFE0D6] bg-mint p-4">
      <p className="text-sm font-semibold text-brand-dark">This is a free preview of your {what}.</p>
      <p className="mt-1 text-xs text-brand-dark">
        Unlock it with any monthly plan to see everything now, or get the full research proposal, which includes it in full.
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <Link
          href="/dashboard/write?buy=1"
          className="rounded-lg bg-brand px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Unlock the full {what}
        </Link>
        <Link
          href={`/dashboard/write?project=${projectId || ""}`}
          className="rounded-lg border border-brand bg-white px-4 py-3 text-center text-sm font-semibold text-brand transition hover:bg-[#F4F9F7]"
        >
          Get the full proposal
        </Link>
      </div>
    </div>
  );
}
