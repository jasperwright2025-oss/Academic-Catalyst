import { PRODUCTS, singleProductKey } from "@/lib/payments/catalog";
import { LEVELS, LEVEL_LABELS, WORD_ALLOWANCE } from "@/lib/payments/levels";
import { ugxPerUsd, ugxAmount } from "@/lib/payments/momo";
import Link from "next/link";
import { availableSamples } from "@/lib/site/samples";

const ROWS = [
  ["proposal", "Research proposal"],
  ["simulation", "Practice Data Pack"],
  ["dissertation", "Dissertation draft report"],
];

// What each level is written to, in plain words (matches lib/payments/levels.js).
const WHAT_YOU_GET = {
  undergraduate: "One main theory or framework, about 20 to 30 well-chosen sources, a practical design, descriptive statistics and simple tests.",
  masters: "An argued theoretical and conceptual framework, a critical review of about 35 to 50 sources, a fully justified design and inferential analysis.",
  phd: "A stated original contribution, competing theories, an extended critical review with an extra round of source checking, and advanced analysis.",
};

// Single-purchase prices by academic level, in Uganda shillings first (at the rate set on the server).
export default function LevelPriceTable() {
  const rate = ugxPerUsd();
  const samples = availableSamples();
  const price = (kind, level) => {
    const usd = PRODUCTS[singleProductKey(kind, level)].amount;
    return rate ? `UGX ${ugxAmount(usd, rate).toLocaleString("en-US")}/= ($${usd})` : `$${usd}`;
  };
  return (
    <section className="mt-16">
      <h2 className="font-serif text-3xl font-medium">Single purchases, priced by level</h2>
      <p className="mt-2 max-w-3xl text-ink-soft">
        Choose your level when you start a document. Each level sets the length and depth. A postgraduate diploma is priced at the master&apos;s level.
      </p>
      <div className="mt-6 overflow-x-auto rounded-[18px] border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Document</th>
              {LEVELS.map((l) => (
                <th key={l} className="px-5 py-3 font-semibold">{LEVEL_LABELS[l]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ROWS.map(([kind, name]) => (
              <tr key={kind}>
                <td className="px-5 py-4 font-semibold">{name}</td>
                {LEVELS.map((l) => {
                  const cap = WORD_ALLOWANCE[kind]?.[l];
                  return (
                    <td key={l} className="px-5 py-4">
                      <span className="block font-semibold">{price(kind, l)}</span>
                      {cap && <span className="block text-xs text-muted">Up to {cap.toLocaleString("en-GB")} words</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="px-5 py-4 align-top font-semibold">Written to this depth</td>
              {LEVELS.map((l) => (
                <td key={l} className="px-5 py-4 align-top text-xs leading-relaxed text-ink-soft">
                  {WHAT_YOU_GET[l]}
                  {samples.includes(l) && (
                    <Link href={`/samples/${l}`} className="mt-2 block font-semibold text-brand hover:text-brand-dark">
                      See a sample
                    </Link>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Shilling amounts follow the current exchange rate and are rounded up to the nearest 1,000. Need a longer document? Choose the next level up. Every document includes a cover page, references checked during writing in your citation style, and a formatted Word download. Dissertation drafts also mark what only you can add with "Your input" notes and end with a "Before you submit" checklist.
      </p>
    </section>
  );
}
