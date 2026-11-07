import Link from "next/link";
import Logo from "./Logo";
import { TOOLS, FULL_SERVICES, serviceHref } from "@/lib/site/content";

const linkClass = "text-ink hover:text-brand";

// Works without JavaScript: the menus are <details> elements.
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 text-ink">
          <Logo />
          <span className="font-serif text-[22px] font-semibold tracking-tight">Academic Catalyst</span>
        </Link>

        <div className="hidden items-center gap-7 text-[15px] font-medium md:flex">
          <Menu label="Tools" items={TOOLS} />
          <Menu label="Services" items={FULL_SERVICES} />
          <Link href="/pricing" className={linkClass}>Pricing</Link>
          <Link href="/blog" className={linkClass}>Blog</Link>
          <Link href="/login" className={linkClass}>Sign in</Link>
          <Link href="/register" className="rounded-full bg-ink px-5 py-3 font-semibold text-white hover:bg-[#1c3156]">
            Start free
          </Link>
        </div>

        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink">
            Menu
          </summary>
          <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-line bg-white p-4 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Tools</p>
            <ul className="mt-2 space-y-1">
              {TOOLS.map((s) => (
                <li key={s.slug}><Link href={serviceHref(s)} className="block rounded-lg px-2 py-2 text-ink hover:bg-paper">{s.name}</Link></li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Services</p>
            <ul className="mt-2 space-y-1">
              {FULL_SERVICES.map((s) => (
                <li key={s.slug}><Link href={serviceHref(s)} className="block rounded-lg px-2 py-2 text-ink hover:bg-paper">{s.name}</Link></li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
              <Link href="/pricing" className="px-2 py-2 text-ink">Pricing</Link>
              <Link href="/blog" className="px-2 py-2 text-ink">Blog</Link>
              <Link href="/login" className="px-2 py-2 text-ink">Sign in</Link>
              <Link href="/register" className="rounded-full bg-ink px-4 py-3 text-center font-semibold text-white">Start free</Link>
            </div>
          </div>
        </details>
      </nav>
    </header>
  );
}

function Menu({ label, items }) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-ink hover:text-brand">
        {label}
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="transition group-open:rotate-180">
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="absolute left-1/2 mt-3 w-80 -translate-x-1/2 rounded-2xl border border-line bg-white p-3 shadow-xl">
        {items.map((s) => (
          <Link key={s.slug} href={serviceHref(s)} className="block rounded-xl px-3 py-2.5 hover:bg-paper">
            <span className="flex items-center gap-2 font-semibold text-ink">
              {s.name}
              {s.status === "soon" && (
                <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-[#7A4A0C]">Soon</span>
              )}
            </span>
            <span className="mt-0.5 block text-[13px] font-normal text-muted">{s.short}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}
