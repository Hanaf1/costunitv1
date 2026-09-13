"use client";

import { useActionState, useMemo, useState } from "react";
import { Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { savePermintaanAction } from "./actions";
import { DeletePermintaanButton } from "./delete-button";
import { formatRupiah } from "@/lib/format";
import { buttonPrimary, buttonSecondary, card, input } from "@/lib/ui";

type BarangOption = {
  id: string;
  kodeItem: string;
  namaBarang: string;
  satuanDasar: string;
  hargaReferensi: number;
};

type UnitOption = { id: string; namaUnit: string };

type Row = {
  key: string;
  barangId: string;
  namaBarangSnapshot: string;
  satuanSnapshot: string;
  jumlahBarang: number;
  hargaSatuan: number;
};

let rowKeyCounter = 0;
function newRowKey() {
  rowKeyCounter += 1;
  return `row-${Date.now()}-${rowKeyCounter}`;
}

export function PermintaanForm({
  units,
  barangOptions,
  initial,
}: {
  units: UnitOption[];
  barangOptions: BarangOption[];
  initial?: {
    id: string;
    unitId: string;
    unitLabel: string;
    mingguValue: string;
    items: Row[];
  };
}) {
  const [state, action, pending] = useActionState(savePermintaanAction, undefined);
  const [unitId, setUnitId] = useState(initial?.unitId ?? "");
  const [mingguValue, setMingguValue] = useState(initial?.mingguValue ?? "");
  const [rows, setRows] = useState<Row[]>(
    initial?.items ?? [],
  );
  // Data yang sudah tersimpan dibuka dalam mode terkunci (hanya lihat detail).
  const [locked, setLocked] = useState(Boolean(initial?.id));

  const barangById = useMemo(() => new Map(barangOptions.map((b) => [b.id, b])), [barangOptions]);

  function lockAndDiscard() {
    if (!initial) return;
    setUnitId(initial.unitId);
    setMingguValue(initial.mingguValue);
    setRows(initial.items);
    setLocked(true);
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: newRowKey(), barangId: "", namaBarangSnapshot: "", satuanSnapshot: "", jumlahBarang: 1, hargaSatuan: 0 },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handleBarangSelect(key: string, barangId: string) {
    const barang = barangById.get(barangId);
    if (!barang) {
      updateRow(key, { barangId: "", namaBarangSnapshot: "", satuanSnapshot: "" });
      return;
    }
    updateRow(key, {
      barangId,
      namaBarangSnapshot: barang.namaBarang,
      satuanSnapshot: barang.satuanDasar,
      hargaSatuan: barang.hargaReferensi,
    });
  }

  const total = rows.reduce((sum, r) => sum + r.jumlahBarang * r.hargaSatuan, 0);

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.barangId)
      .map((r) => ({
        barangId: r.barangId,
        namaBarangSnapshot: r.namaBarangSnapshot,
        satuanSnapshot: r.satuanSnapshot,
        jumlahBarang: r.jumlahBarang,
        hargaSatuan: r.hargaSatuan,
      })),
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="itemsJson" value={itemsJson} />

      {initial?.id && (
        <div
          className={`flex items-center justify-between flex-wrap gap-3 rounded-lg border px-4 py-3 ${locked ? "border-slate-200 bg-slate-50" : "border-amber-200 bg-amber-50"}`}
        >
          <p className={`flex items-center gap-2 text-sm ${locked ? "text-slate-600" : "text-amber-800"}`}>
            {locked ? <Lock size={16} /> : <LockOpen size={16} />}
            {locked
              ? "Data terkunci (mode lihat detail). Buka kunci untuk mengedit atau menghapus."
              : "Mode edit aktif. Simpan perubahan, atau kunci kembali untuk membatalkan."}
          </p>
          <div className="flex items-center gap-2">
            {locked ? (
              <button type="button" onClick={() => setLocked(false)} className={buttonSecondary}>
                <LockOpen size={16} />
                Buka Kunci untuk Edit
              </button>
            ) : (
              <>
                <DeletePermintaanButton
                  id={initial.id}
                  label="Hapus Permintaan"
                  description={`${initial.unitLabel} minggu ${initial.mingguValue}`}
                />
                <button type="button" onClick={lockAndDiscard} className={buttonSecondary}>
                  <Lock size={16} />
                  Kunci Kembali
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl p-5 ${card}`}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Unit</span>
          <select
            name="unitId"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            required
            disabled={locked}
            className={`${input} disabled:bg-slate-50 disabled:text-slate-700`}
          >
            <option value="">Pilih unit...</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.namaUnit}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Minggu</span>
          <input
            type="week"
            name="minggu"
            value={mingguValue}
            onChange={(e) => setMingguValue(e.target.value)}
            required
            disabled={locked}
            className={`${input} disabled:bg-slate-50 disabled:text-slate-700`}
          />
        </label>
      </div>

      <div className={`overflow-x-auto ${card}`}>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Barang</th>
              <th className="px-4 py-2.5 font-medium">Satuan</th>
              <th className="px-4 py-2.5 font-medium">Jumlah</th>
              <th className="px-4 py-2.5 font-medium">Harga Satuan</th>
              <th className="px-4 py-2.5 font-medium text-right">Harga</th>
              {!locked && <th className="px-4 py-2.5 font-medium" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) =>
              locked ? (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{row.namaBarangSnapshot}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.satuanSnapshot || "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.jumlahBarang}</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatRupiah(row.hargaSatuan)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-900 font-medium">
                    {formatRupiah(row.jumlahBarang * row.hargaSatuan)}
                  </td>
                </tr>
              ) : (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="px-4 py-2.5">
                    <select
                      value={row.barangId}
                      onChange={(e) => handleBarangSelect(row.key, e.target.value)}
                      className={`${input} py-1.5 w-64`}
                    >
                      <option value="">Pilih barang...</option>
                      {row.barangId && !barangById.has(row.barangId) && (
                        <option value={row.barangId}>{row.namaBarangSnapshot}</option>
                      )}
                      {barangOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.namaBarang}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{row.satuanSnapshot || "-"}</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={row.jumlahBarang}
                      onChange={(e) => updateRow(row.key, { jumlahBarang: Number(e.target.value) || 0 })}
                      className={`${input} py-1.5 w-24`}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.hargaSatuan}
                      onChange={(e) => updateRow(row.key, { hargaSatuan: Number(e.target.value) || 0 })}
                      className={`${input} py-1.5 w-32`}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-900 font-medium">
                    {formatRupiah(row.jumlahBarang * row.hargaSatuan)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      title="Hapus baris"
                      className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ),
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={locked ? 5 : 6} className="px-4 py-10 text-center text-slate-400">
                  Belum ada baris barang. Klik &ldquo;Tambah Baris Barang&rdquo; di bawah.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        {locked ? (
          <span />
        ) : (
          <button type="button" onClick={addRow} className={buttonSecondary}>
            <Plus size={16} />
            Tambah Baris Barang
          </button>
        )}
        <div className={`${card} px-4 py-2.5 text-sm`}>
          <span className="text-slate-500">Total HPP: </span>
          <span className="font-semibold text-slate-900">{formatRupiah(total)}</span>
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      {!locked && (
        <button type="submit" disabled={pending || rows.length === 0} className={`${buttonPrimary} w-fit`}>
          {pending ? "Menyimpan..." : initial?.id ? "Simpan Perubahan" : "Simpan Permintaan"}
        </button>
      )}
    </form>
  );
}
