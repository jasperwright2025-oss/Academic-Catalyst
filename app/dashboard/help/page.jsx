import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import SupportForm from "@/components/app/SupportForm";

export const metadata = { title: "Help" };

const ITEMS = [
  ["My literature search found too few studies.", "Use three to six key words rather than a full question, for example: mobile money saving market traders. Leave out place names at first, then add them back. The search also widens itself when it finds fewer than five studies."],
  ["How do I get my free preview?", "Open Write a document, choose Research proposal, fill in your topic and background, and press Generate free preview. A full proposal takes about 10 to 20 minutes, and you can leave the page while it is written."],
  ["How do I pay?", "Press Buy credits and choose MTN or Airtel mobile money, or USDT. Follow the instructions on screen. Your credits appear once the payment is confirmed."],
  ["How do I unlock and download?", "Open the document from My documents and press Unlock at the top of the preview. Then press Download Word."],
  ["What is the clarity note?", "A plain-language companion to your document. It explains the reasoning and lists exactly where to add your own experience and data. It is not part of the document."],
  ["What is the reference check?", "A note on what was checked about the references, and any entries to confirm by hand before you submit. It is not part of the document."],
  ["Where do I set the details on my cover page?", "In Write a document, under Cover page details. They are used on the cover page of every new document."],
];

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Help</h1>
      <div className="mt-8">
        <SupportForm />
      </div>
      <h2 className="mt-10 text-[17px] font-bold">Common questions</h2>
      <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
        {ITEMS.map(([q, a]) => (
          <details key={q} className="group px-6 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {q}
              <span aria-hidden="true" className="text-brand transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 leading-relaxed text-ink-soft">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 text-ink-soft">
        Still stuck? Write to <a href={`mailto:${LEGAL.contactEmail}`} className="font-semibold text-brand">{LEGAL.contactEmail}</a>.
        Read our <Link href="/terms" className="font-semibold text-brand">Terms of Service</Link> and{" "}
        <Link href="/privacy" className="font-semibold text-brand">Privacy Policy</Link>.
      </p>
    </main>
  );
}
