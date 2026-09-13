"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

type Option = { value: string; label: string };

// Multi-select dengan kotak pencarian. Nilai terpilih dikirim lewat <input type="hidden">
// dengan `name` yang sama, jadi tetap kompatibel dengan form GET biasa.
export function MultiSelectSearch({
  name,
  options,
  defaultSelected,
  placeholder,
}: {
  name: string;
  options: Option[];
  defaultSelected: string[];
  placeholder: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const labelByValue = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const toggle = (value: string) =>
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  const selectAllFiltered = () =>
    setSelected((prev) => [...new Set([...prev, ...filtered.map((o) => o.value)])]);

  return (
    <div ref={containerRef} className="relative">
      {selected.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="w-full min-h-[42px] flex items-center gap-2 border border-slate-300 rounded-md bg-white px-3 py-1.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
      >
        <span className="flex flex-wrap gap-1 flex-1 min-w-0">
          {selected.length === 0 && <span className="text-slate-400 py-0.5">{placeholder}</span>}
          {selected.slice(0, 3).map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 max-w-full rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
            >
              <span className="truncate">{labelByValue.get(v) ?? v}</span>
              <X
                size={12}
                className="shrink-0 cursor-pointer text-slate-400 hover:text-slate-700"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(v);
                }}
              />
            </span>
          ))}
          {selected.length > 3 && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">+{selected.length - 3} lagi</span>
          )}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={14} className="text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter di kotak cari jangan submit form; pilih hasil pertama saja.
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered[0]) toggle(filtered[0].value);
                }
              }}
              placeholder="Cari..."
              className="w-full text-sm focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-slate-100">
            <button type="button" onClick={selectAllFiltered} className="text-slate-600 hover:text-slate-900">
              Pilih semua{query ? " hasil" : ""}
            </button>
            <button type="button" onClick={() => setSelected([])} className="text-slate-600 hover:text-slate-900">
              Hapus pilihan ({selected.length})
            </button>
          </div>

          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.map((o) => {
              const isSelected = selected.includes(o.value);
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => toggle(o.value)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${isSelected ? "text-slate-900 font-medium" : "text-slate-700"}`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}
                    >
                      {isSelected && <Check size={12} />}
                    </span>
                    <span className="truncate">{o.label}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-400">Tidak ditemukan.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
