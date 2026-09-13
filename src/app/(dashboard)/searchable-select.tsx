"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

export type SelectOption = { value: string; label: string; hint?: string };

// Batasi jumlah baris yang dirender supaya tetap ringan walau opsi ratusan.
const MAX_RESULTS = 100;

// Select satu nilai dengan kotak pencarian. Dropdown dirender lewat portal dengan
// posisi fixed supaya tidak terpotong container ber-overflow (mis. tabel barang).
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  name,
  disabled,
  fallbackLabel,
  size = "md",
}: {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  // Label cadangan kalau `value` tidak ada di `options` (mis. data sudah nonaktif).
  fallbackLabel?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    return options.find((o) => o.value === value)?.label ?? fallbackLabel ?? value;
  }, [options, value, fallbackLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);
  const visible = filtered.slice(0, MAX_RESULTS);

  function openPanel(initialQuery = "") {
    if (disabled) return;
    const selectedIndex = initialQuery ? -1 : options.findIndex((o) => o.value === value);
    setQuery(initialQuery);
    setHighlight(selectedIndex >= 0 && selectedIndex < MAX_RESULTS ? selectedIndex : 0);
    setOpen(true);
  }

  function close(focusTrigger = true) {
    setOpen(false);
    setQuery("");
    if (focusTrigger) triggerRef.current?.focus();
  }

  function choose(next: string) {
    onChange(next);
    close();
  }

  // Posisi panel mengikuti trigger; diatur langsung ke style agar tidak memicu render ulang.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const r = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const spaceAbove = r.top - 8;
      const placeAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
      panel.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 280) - 8))}px`;
      panel.style.width = `${Math.max(r.width, 280)}px`;
      panel.style.maxHeight = `${Math.min(360, placeAbove ? spaceAbove : spaceBelow)}px`;
      if (placeAbove) {
        panel.style.top = "";
        panel.style.bottom = `${window.innerHeight - r.top + 4}px`;
      } else {
        panel.style.bottom = "";
        panel.style.top = `${r.bottom + 4}px`;
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${highlight}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const sizeClass = size === "sm" ? "min-h-[36px] py-1.5" : "min-h-[40px] py-2";

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPanel();
          } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            // Langsung ketik saat trigger fokus = mulai mencari.
            e.preventDefault();
            openPanel(e.key);
          }
        }}
        className={`w-full flex items-center gap-2 border border-slate-300 rounded-md bg-white px-3 text-left text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 disabled:bg-slate-50 disabled:cursor-default ${sizeClass}`}
      >
        <span className={`flex-1 min-w-0 truncate ${selectedLabel ? "text-slate-900" : "text-slate-400"}`}>
          {selectedLabel || placeholder}
        </span>
        {!disabled && (
          <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed" }}
            className="z-50 flex flex-col rounded-md border border-slate-200 bg-white shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
              <Search size={14} className="shrink-0 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={visible[highlight] ? `${listId}-${highlight}` : undefined}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlight((h) => Math.min(h + 1, visible.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter") {
                    // Jangan submit form; pilih opsi yang di-highlight.
                    e.preventDefault();
                    if (visible[highlight]) choose(visible[highlight].value);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    close();
                  } else if (e.key === "Tab") {
                    close(false);
                  }
                }}
                placeholder="Ketik untuk mencari..."
                className="w-full text-sm focus:outline-none"
              />
            </div>

            <ul ref={listRef} id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1">
              {visible.map((o, i) => {
                const isSelected = o.value === value;
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o.value)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${i === highlight ? "bg-slate-100" : ""} ${isSelected ? "font-medium text-slate-900" : "text-slate-700"}`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{o.label}</span>
                      {o.hint && <span className="block truncate text-xs font-normal text-slate-400">{o.hint}</span>}
                    </span>
                    {isSelected && <Check size={14} className="shrink-0 text-slate-900" />}
                  </li>
                );
              })}
              {visible.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-400">Tidak ditemukan.</li>}
            </ul>

            {filtered.length > MAX_RESULTS && (
              <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-400">
                Menampilkan {MAX_RESULTS} dari {filtered.length}. Ketik untuk mempersempit.
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
