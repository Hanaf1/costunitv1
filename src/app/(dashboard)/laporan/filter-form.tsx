"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import { buttonPrimary, card, input } from "@/lib/ui";
import { MultiSelectSearch } from "./multi-select-search";

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
          <MultiSelectSearch name="unit" options={unitOptions} defaultSelected={selectedUnits} placeholder="Semua unit" />
          <p className="text-xs text-slate-400 mt-1">Kosongkan = semua unit.</p>
        </div>

        <div>
          <span className="text-sm font-medium text-slate-700 block mb-1">Item / Barang</span>
          <MultiSelectSearch name="barang" options={barangOptions} defaultSelected={selectedBarang} placeholder="Semua item" />
          <p className="text-xs text-slate-400 mt-1">Kosongkan = semua item.</p>
        </div>

        <div>
          <span className="text-sm font-medium text-slate-700 block mb-1">Satuan</span>
          <MultiSelectSearch
            name="satuan"
            options={satuanOptions.map((s) => ({ value: s, label: s }))}
            defaultSelected={selectedSatuan}
            placeholder="Semua satuan"
          />
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
