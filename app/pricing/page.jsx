import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import PlanGrid from "@/components/site/PlanGrid";
import { SITE, SINGLE_PRICES } from "@/lib/site/content";

export const metadata = {
  title: "Pricing",
  description: "Start free. Pay for a single document or choose a monthly plan. Mobile money and USDT accepted.",
};

const QUESTIONS = [
  ["What is free?", "Every account gets one free preview of a full research proposal. The four tools will each allow three free uses a month when they open."],
  ["How do I pay?", "By MTN or Airtel mobile money, or by USDT. Your credits appear once the payment is confirmed."],
  ["What does a single purchase include?", "One complete document of that type, unlocked in full with a formatted Word download."],
  ["Can I get a refund?", "Documents that have been generated or unlocked are normally not refundable. Within 7 days you can ask for a refund or for the credit to be restored if you paid but received no credits, paid twice for the same order, or a technical fault meant no usable document was produced."],
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">Pricing</p>
        <h1 className="mt-3 max-w-3xl font-serif text-5xl font-medium tracking-tight">Start free. Pay when you need the full document.</h1>
        <PlanGrid />
        <p className="mt-5 text-sm text-muted">{SINGLE_PRICES} {SITE.payment}</p>

        <section className="mt-20 max-w-3xl">
          <h2 className="font-serif text-3xl font-medium">Questions</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {QUESTIONS.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                  {q}
                  <span aria-hidden="true" className="text-brand transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 leading-relaxed text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">
            Full details are in our <Link href="/terms" className="font-semibold text-brand">Terms of Service</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
