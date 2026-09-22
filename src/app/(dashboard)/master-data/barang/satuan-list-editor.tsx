"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { buttonSecondary, input } from "@/lib/ui";

export type SatuanRow = { namaSatuan: string; isi: number; harga: number | null };

// Satuan alternatif barang, dikirim ke server action sebagai JSON di field "satuanListJson".
export function SatuanListEditor({ initial = [] }: { initial?: SatuanRow[] }) {
  const [rows, setRows] = useState<SatuanRow[]>(initial);

  function update(index: number, patch: Partial<SatuanRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-sm font-medium text-slate-700">Satuan Lain</span>
        <p className="text-xs text-slate-500">
          Contoh: Rim berisi 500 satuan dasar. Kosongkan harga agar dihitung otomatis dari harga referensi × isi.
        </p>
      </div>
      <input type="hidden" name="satuanListJson" value={JSON.stringify(rows)} />

      {rows.length > 0 && (
        <div className="grid grid-cols-[1fr_6rem_8rem_2rem] gap-2 text-xs text-slate-500">
          <span>Nama satuan</span>
          <span>Isi</span>
          <span>Harga (opsional)</span>
          <span />
          {rows.map((row, i) => (
            <div key={i} className="contents">
              <input
                value={row.namaSatuan}
                onChange={(e) => update(i, { namaSatuan: e.target.value })}
                placeholder="Rim"
                className={`${input} py-1.5`}
              />
              <input
                type="number"
                min={1}
                step={1}
                value={row.isi}
                onChange={(e) => update(i, { isi: Number(e.target.value) || 0 })}
                className={`${input} py-1.5 text-right`}
              />
              <input
                type="number"
                min={0}
                step={1}
                value={row.harga ?? ""}
                onChange={(e) => update(i, { harga: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="otomatis"
                className={`${input} py-1.5 text-right`}
              />
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                title="Hapus satuan"
                className="rounded p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { namaSatuan: "", isi: 1, harga: null }])}
        className={`${buttonSecondary} w-fit py-1.5`}
      >
        <Plus size={14} />
        Tambah Satuan
      </button>
    </div>
  );
}
