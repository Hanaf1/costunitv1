"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import { buttonPrimary, card, input } from "@/lib/ui";

type Option = { value: string; label: string };

export function LaporanFilterForm({
  mode,
  minggu,
  start,
  end,
  weekOptions,
  unitOptions,
  selectedUnits,
  barangOptions,
  selectedBarang,
  satuanOptions,
  selectedSatuan,
}: {
  mode: "minggu" | "rentang";
  minggu: string;
  start: string;
  end: string;
  weekOptions: Option[];
  unitOptions: Option[];
  selectedUnits: string[];
  barangOptions: Option[];
  selectedBarang: string[];
  satuanOptions: string[];
  selectedSatuan: string[];
}) {
  const [currentMode, setCurrentMode] = useState<"minggu" | "rentang">(mode);

  return (
    <form action="/laporan" method="get" className={`flex flex-col gap-5 p-5 ${card}`}>
      <div>
        <span className="text-sm font-medium text-slate-700 block mb-2">Periode</span>
        <div className="flex items-center gap-5 mb-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="mode"
              value="rentang"
              checked={currentMode === "rentang"}
              onChange={() => setCurrentMode("rentang")}
              className="accent-slate-900"
            />
            Rentang Tanggal / Tahun
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="mode"
              value="minggu"
              checked={currentMode === "minggu"}
              onChange={() => setCurrentMode("minggu")}
              className="accent-slate-900"
            />
            Pilih Minggu
          </label>
        </div>

        {currentMode === "rentang" ? (
          <div className="flex items-center gap-3">
            <input type="date" name="start" defaultValue={start} className={input} />
            <span className="text-sm text-slate-400">s/d</span>
            <input type="date" name="end" defaultValue={end} className={input} />
          </div>
        ) : (
          <select name="minggu" defaultValue={minggu} className={input}>
            <option value="">Pilih minggu...</option>
            {weekOptions.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <span className="text-sm font-medium text-slate-700 block mb-1">Unit</span>
          <select name="unit" multiple defaultValue={selectedUnits} size={6} className={`w-full ${input}`}>
            {unitOptions.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Kosongkan = semua unit. Ctrl/Cmd+klik untuk pilih lebih dari satu.</p>
        </div>

        <div>
          <span className="text-sm font-medium text-slate-700 block mb-1">Item / Barang</span>
          <select name="barang" multiple defaultValue={selectedBarang} size={6} className={`w-full ${input}`}>
            {barangOptions.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Kosongkan = semua item.</p>
        </div>

        <div>
          <span className="text-sm font-medium text-slate-700 block mb-1">Satuan</span>
          <select name="satuan" multiple defaultValue={selectedSatuan} size={6} className={`w-full ${input}`}>
            {satuanOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Kosongkan = semua satuan.</p>
        </div>
      </div>

      <div>
        <button type="submit" className={buttonPrimary}>
          <Filter size={16} />
          Tampilkan Laporan
        </button>
      </div>
    </form>
  );
}
