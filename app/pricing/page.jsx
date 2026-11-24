import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import PlanGrid from "@/components/site/PlanGrid";
import LevelPriceTable from "@/components/site/LevelPriceTable";
import { SITE } from "@/lib/site/content";
import { createAdminClient } from "@/lib/supabase/admin";
import { launchOfferState } from "@/lib/payments/launchOffer";

// Shilling prices use the exchange rate set on the server; refresh hourly.
export const revalidate = 600;

export const metadata = {
  title: "Pricing",
  description: "Start free. Pay for a single document or choose a monthly plan. Mobile money and USDT accepted.",
};

const QUESTIONS = [
  ["What is free?", "Every account gets one free proposal preview: the introduction and objectives in full, with the rest unlocked by a single purchase or a plan. The four tools each allow three free uses a month, and you can run one Topic validator check without an account."],
  ["How do I pay?", "By MTN or Airtel mobile money, or by USDT. Your credits appear once the payment is confirmed."],
  ["What does a single purchase include?", "One complete document of that type at your academic level, unlocked in full with a formatted Word download."],
  ["Why do prices differ by level?", "An undergraduate proposal is shorter and needs fewer sources than a master's or PhD proposal, so it costs less to prepare. A credit for a higher level also covers a lower one."],
  ["Can I get a refund?", "Documents that have been generated or unlocked are normally not refundable. Within 7 days you can ask for a refund or for the credit to be restored if you paid but received no credits, paid twice for the same order, or a technical fault meant no usable document was produced."],
];

async function placesLeft() {
  try {
    return (await launchOfferState(createAdminClient())).placesLeft;
  } catch {
    return null;
  }
}

export default async function PricingPage() {
  const left = await placesLeft();
  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">Pricing</p>
        <h1 className="mt-3 max-w-3xl font-serif text-5xl font-medium tracking-tight">Start free. Pay when you need the full document.</h1>
        <PlanGrid />
        <p className="mt-5 text-sm text-muted">Monthly plans cover every academic level. {SITE.payment}</p>
        <LevelPriceTable placesLeft={left} />

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
