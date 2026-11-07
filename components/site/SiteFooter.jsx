import Link from "next/link";
import Logo from "./Logo";
import { TOOLS, FULL_SERVICES, serviceHref } from "@/lib/site/content";
import { LEGAL } from "@/lib/legal";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2.5 text-ink">
            <Logo />
            <span className="font-serif text-xl font-semibold">Academic Catalyst</span>
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-muted">Research support for postgraduates and professionals.</p>
        </div>
        <FooterList title="Tools" items={TOOLS.map((s) => [s.name, serviceHref(s)])} />
        <FooterList title="Services" items={FULL_SERVICES.map((s) => [s.name, serviceHref(s)])} />
        <FooterList
          title="Company"
          items={[
            ["Pricing", "/pricing"],
            ["Blog", "/blog"],
            ["Privacy Policy", "/privacy"],
            ["Terms of Service", "/terms"],
            [`Contact: ${LEGAL.contactEmail}`, `mailto:${LEGAL.contactEmail}`],
          ]}
        />
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted">
          © {new Date().getFullYear()} {LEGAL.productName}, operated by {LEGAL.legalEntity}
        </p>
      </div>
    </footer>
  );
}

function FooterList({ title, items }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="break-words text-muted hover:text-brand">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
