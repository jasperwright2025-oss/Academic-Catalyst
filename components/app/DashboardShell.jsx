"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/site/Logo";
import { logout } from "@/lib/api/client";

const NAV = [
  { href: "/dashboard", label: "Home", icon: "M3 11l9-8 9 8M5 10v10h14V10" },
  { href: "/dashboard/write", label: "Write a document", icon: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" },
  { href: "/dashboard/write#history", label: "My documents", icon: "M7 3h7l5 5v13H7zM14 3v5h5" },
  { href: "/dashboard/tools", label: "Tools", icon: "M14 7l3-3 3 3-3 3M4 20l9-9M7 4v6M4 7h6" },
  { href: "/dashboard/write?buy=1", label: "Buy credits", icon: "M3 6h18v12H3zM3 10h18" },
  { href: "/dashboard/help", label: "Help", icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4M12 17h.01" },
];

export default function DashboardShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // Go to the login page either way.
    }
    router.push("/login");
    router.refresh();
  }

  const isActive = (href) => {
    const path = href.split(/[?#]/)[0];
    if (href.includes("#") || href.includes("?")) return false;
    return path === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(path);
  };

  const menu = (
    <nav aria-label="Dashboard" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${
              active ? "bg-white/12 text-white" : "text-[#C7CFDC] hover:bg-white/8 hover:text-white"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F4F5F0] font-sans text-ink lg:flex">
      {/* Phone and tablet: top bar with a menu button */}
      <div className="flex items-center justify-between bg-ink px-4 py-3 text-white lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo light />
          <span className="font-serif text-lg font-semibold">Academic Catalyst</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="bg-ink px-4 pb-4 lg:hidden">
          {menu}
          <button type="button" onClick={signOut} disabled={signingOut} className="mt-3 w-full rounded-xl border border-white/20 px-3 py-2.5 text-left text-sm text-[#C7CFDC]">
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}

      {/* Desktop: side menu */}
      <aside className="hidden w-64 flex-none flex-col gap-7 bg-ink px-4 py-6 text-white lg:flex lg:min-h-screen">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <Logo light />
          <span className="font-serif text-xl font-semibold">Academic Catalyst</span>
        </Link>
        {menu}
        <div className="mt-auto space-y-3">
          <div className="rounded-2xl bg-white/7 p-4">
            <p className="text-sm leading-relaxed">Full proposals and unlimited tools from $70 a month.</p>
            <Link href="/pricing" className="mt-2 inline-block text-sm font-semibold text-[#3CC2A2]">See plans →</Link>
          </div>
          <button type="button" onClick={signOut} disabled={signingOut} className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-[#C7CFDC] hover:bg-white/8 hover:text-white">
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
