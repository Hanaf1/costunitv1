"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { NAV_SECTIONS } from "./sidebar";

// Cari menu sidebar yang cocok dengan URL, untuk breadcrumb + ikon header.
function findNav(pathname: string) {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return { section, item };
    }
  }
  return null;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const nav = findNav(usePathname());
  const Icon = nav?.item.icon;

  return (
    <div className="-mx-4 -mt-6 mb-1 border-b border-slate-200 bg-white px-4 pt-5 pb-5 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-6">
      {nav && (
        <p className="mb-3 flex items-center gap-1 text-xs text-slate-500">
          {nav.section.title}
          <ChevronRight size={12} />
          <span className={nav.item.label === title ? "text-slate-700" : ""}>{nav.item.label}</span>
          {nav.item.label !== title && (
            <>
              <ChevronRight size={12} />
              <span className="text-slate-700">{title}</span>
            </>
          )}
        </p>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
              <Icon size={20} />
            </span>
          )}
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            {description && <p className="text-sm text-slate-600 mt-0.5">{description}</p>}
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}
