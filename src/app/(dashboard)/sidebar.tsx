"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  ClipboardList,
  Building2,
  Package,
  Upload,
  LogOut,
  Menu,
  X,
  ReceiptText,
} from "lucide-react";
import { logoutAction } from "./actions";

type NavItem = {
  href: string;
  label: string;
  icon: typeof BarChart3;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Laporan",
    items: [
      { href: "/laporan", label: "Laporan Cost Unit", icon: BarChart3 },
      { href: "/permintaan", label: "Permintaan Mingguan", icon: ClipboardList },
    ],
  },
  {
    title: "Master Data",
    items: [
      { href: "/master-data/unit", label: "Master Unit", icon: Building2 },
      { href: "/master-data/barang", label: "Master Barang", icon: Package },
      { href: "/master-data/import", label: "Import Excel", icon: Upload },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/laporan") return pathname === "/laporan";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({ username, onNavigate }: { username: string; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-slate-900">
          <ReceiptText size={19} />
        </span>
        <div>
          <span className="block text-sm font-semibold text-white">Cost Unit Report</span>
          <span className="block text-xs text-slate-400">Logistik Non Medis</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {section.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-white/10 text-white shadow-[inset_2px_0_0_white]"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon size={17} strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold uppercase text-white">
            {username.slice(0, 2)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{username}</p>
            <p className="text-xs text-slate-400">Admin</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Keluar"
              className="flex items-center justify-center rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ username }: { username: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-900">
        <SidebarContent username={username} />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <ReceiptText size={18} />
          Cost Unit Report
        </span>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-slate-300 hover:bg-white/10"
          aria-label="Buka menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-900 shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-slate-400 hover:bg-white/10"
              aria-label="Tutup menu"
            >
              <X size={18} />
            </button>
            <SidebarContent username={username} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
