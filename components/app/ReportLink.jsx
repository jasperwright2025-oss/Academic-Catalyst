"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// "Report this problem" next to an error message: opens the help form, filled in.
export default function ReportLink({ error, topic = "other" }) {
  const pathname = usePathname();
  const params = new URLSearchParams({ topic, error: String(error || "").slice(0, 600), from: pathname || "" });
  return (
    <Link href={`/dashboard/help?${params}#support`} className="ml-1 font-semibold underline">
      Report this problem
    </Link>
  );
}
