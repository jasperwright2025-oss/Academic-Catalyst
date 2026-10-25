import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export function LegalSection({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export function LegalList({ items }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function LegalLayout({ title, children }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/" className="font-semibold text-slate-900">
            {LEGAL.productName}
          </Link>
          <div className="flex gap-4 text-indigo-600">
            <Link href="/privacy" className="hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms of Service
            </Link>
          </div>
        </nav>

        <h1 className="mt-8 text-3xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Effective date: {LEGAL.effectiveDate}</p>

        {children}

        <p className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
          {LEGAL.productName} is operated by {LEGAL.legalEntity}. Questions about this page can be sent to{" "}
          {LEGAL.contactEmail}.
        </p>
      </article>
    </main>
  );
}
