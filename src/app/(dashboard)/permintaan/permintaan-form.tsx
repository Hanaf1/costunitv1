"use client";

import { useActionState, useMemo, useState, useRef } from "react";
import { Lock, LockOpen, Plus, Trash2, Camera, Loader2 } from "lucide-react";
import { savePermintaanAction } from "./actions";
import { DeletePermintaanButton } from "./delete-button";
import { SearchableSelect } from "../searchable-select";
import { formatRupiah } from "@/lib/format";
import { buttonPrimary, buttonSecondary, card, input } from "@/lib/ui";

type BarangOption = {
  id: string;
  kodeItem: string;
  namaBarang: string;
  satuanDasar: string;
  hargaReferensi: number;
  satuanList: { namaSatuan: string; isi: number; harga: number | null }[];
};

type UnitOption = { id: string; namaUnit: string };

type Row = {
  key: string;
  barangId: string;
  namaBarangSnapshot: string;
  satuanSnapshot: string;
  isiSnapshot: number;
  jumlahBarang: number;
  hargaSatuan: number;
};

type SatuanChoice = { nama: string; isi: number; harga: number };

// Satuan dasar + satuan alternatif barang (mis. Lembar, Rim = 500 Lembar).
function satuanChoices(b: BarangOption): SatuanChoice[] {
  return [
    { nama: b.satuanDasar, isi: 1, harga: b.hargaReferensi },
    ...b.satuanList.map((s) => ({ nama: s.namaSatuan, isi: s.isi, harga: s.harga ?? b.hargaReferensi * s.isi })),
  ];
}

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
  const [rows, setRows] = useState<Row[]>(initial?.items ?? []);
  // Data yang sudah tersimpan dibuka dalam mode terkunci (hanya lihat detail).
  const [locked, setLocked] = useState(Boolean(initial?.id));
  const [isScanning, setIsScanning] = useState(false);
  const [scanEngine, setScanEngine] = useState<"gemini" | "local">("gemini");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const barangById = useMemo(() => new Map(barangOptions.map((b) => [b.id, b])), [barangOptions]);
  const barangSelectOptions = useMemo(
    () => barangOptions.map((b) => ({ value: b.id, label: b.namaBarang, hint: `${b.kodeItem} · ${b.satuanDasar}` })),
    [barangOptions],
  );
  const unitSelectOptions = useMemo(() => units.map((u) => ({ value: u.id, label: u.namaUnit })), [units]);

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
      {
        key: newRowKey(),
        barangId: "",
        namaBarangSnapshot: "",
        satuanSnapshot: "",
        isiSnapshot: 1,
        jumlahBarang: 1,
        hargaSatuan: 0,
      },
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
      updateRow(key, { barangId: "", namaBarangSnapshot: "", satuanSnapshot: "", isiSnapshot: 1 });
      return;
    }
    updateRow(key, {
      barangId,
      namaBarangSnapshot: barang.namaBarang,
      satuanSnapshot: barang.satuanDasar,
      isiSnapshot: 1,
      hargaSatuan: barang.hargaReferensi,
    });
  }

  function handleSatuanSelect(key: string, barangId: string, nama: string) {
    const barang = barangById.get(barangId);
    const choice = barang && satuanChoices(barang).find((c) => c.nama === nama);
    if (!choice) return;
    updateRow(key, { satuanSnapshot: choice.nama, isiSnapshot: choice.isi, hargaSatuan: choice.harga });
  }

  async function handleScanForm(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("engine", scanEngine);

      const res = await fetch("/api/scan-form", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Gagal memproses gambar formulir");

      const data = await res.json();

      if (data.unitId) {
        setUnitId(data.unitId);
      }

      if (data.items && Array.isArray(data.items)) {
        const newRows: Row[] = data.items.map((item: { barangId?: string; jumlahBarang?: number }) => {
          const barang = item.barangId ? barangById.get(item.barangId) : undefined;
          return {
            key: newRowKey(),
            barangId: item.barangId || "",
            namaBarangSnapshot: barang?.namaBarang || "",
            satuanSnapshot: barang?.satuanDasar || "",
            isiSnapshot: 1,
            jumlahBarang: item.jumlahBarang || 1,
            hargaSatuan: barang?.hargaReferensi || 0,
          };
        });

        setRows((prev) => [...prev, ...newRows.filter((r) => r.barangId)]);
      }
    } catch (err) {
      alert("Error scanning form: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const total = rows.reduce((sum, r) => sum + r.jumlahBarang * r.hargaSatuan, 0);

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.barangId)
      .map((r) => ({
        barangId: r.barangId,
        namaBarangSnapshot: r.namaBarangSnapshot,
        satuanSnapshot: r.satuanSnapshot,
        isiSnapshot: r.isiSnapshot,
        jumlahBarang: r.jumlahBarang,
        hargaSatuan: r.hargaSatuan,
      })),
  );

  return (
    <form action={action} className={`flex flex-col gap-5 ${isScanning ? "pointer-events-none" : ""}`}>
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
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Unit</span>
          <SearchableSelect
            name="unitId"
            options={unitSelectOptions}
            value={unitId}
            onChange={setUnitId}
            placeholder="Pilih unit..."
            disabled={locked}
            fallbackLabel={initial?.unitLabel}
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Minggu</span>
          <input
            type="week"
            name="minggu"
            value={mingguValue}
            onChange={(e) => setMingguValue(e.target.value)}
            required
            disabled={locked}
            className={input}
          />
        </label>
      </div>

      <div className={`overflow-x-auto ${card}`}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500 text-left">
            <tr>
              <th className="w-10 pl-4 pr-2 py-2.5 font-semibold text-right">#</th>
              <th className="px-3 py-2.5 font-semibold">Barang</th>
              <th className="px-3 py-2.5 font-semibold">Satuan</th>
              <th className="px-3 py-2.5 font-semibold text-right">Jumlah</th>
              <th className="px-3 py-2.5 font-semibold text-right">Harga Satuan</th>
              <th className="px-3 py-2.5 font-semibold text-right">Subtotal</th>
              {!locked && <th className="w-10 pr-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => {
              const barang = barangById.get(row.barangId);
              const choices = barang ? satuanChoices(barang) : [];
              const subtotal = row.jumlahBarang * row.hargaSatuan;
              const no = <td className="pl-4 pr-2 py-2 text-right text-slate-400 tabular-nums">{index + 1}</td>;

              if (locked) {
                return (
                  <tr key={row.key}>
                    {no}
                    <td className="px-3 py-2.5 text-slate-900">{row.namaBarangSnapshot}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.satuanSnapshot || "-"}</td>
                    <td className="px-3 py-2.5 text-right text-slate-900 tabular-nums">{row.jumlahBarang}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">
                      {formatRupiah(row.hargaSatuan)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-900 font-medium tabular-nums">
                      {formatRupiah(subtotal)}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={row.key}>
                  {no}
                  <td className="px-3 py-2">
                    <div className="w-72">
                      <SearchableSelect
                        options={barangSelectOptions}
                        value={row.barangId}
                        onChange={(v) => handleBarangSelect(row.key, v)}
                        placeholder="Pilih barang..."
                        fallbackLabel={row.namaBarangSnapshot}
                        size="sm"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {barang && choices.length > 1 ? (
                      <select
                        value={row.satuanSnapshot}
                        onChange={(e) => handleSatuanSelect(row.key, row.barangId, e.target.value)}
                        className={`${input} py-1.5 w-40`}
                      >
                        {!choices.some((c) => c.nama === row.satuanSnapshot) && (
                          <option value={row.satuanSnapshot}>{row.satuanSnapshot}</option>
                        )}
                        {choices.map((c) => (
                          <option key={c.nama} value={c.nama}>
                            {c.isi > 1 ? `${c.nama} (${c.isi} ${barang.satuanDasar})` : c.nama}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-700">{row.satuanSnapshot || "-"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={row.jumlahBarang}
                      onChange={(e) => updateRow(row.key, { jumlahBarang: Number(e.target.value) || 0 })}
                      className={`${input} py-1.5 w-20 text-right ml-auto block`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative w-36 ml-auto">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                        Rp
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row.hargaSatuan}
                        onChange={(e) => updateRow(row.key, { hargaSatuan: Number(e.target.value) || 0 })}
                        className={`${input} py-1.5 pl-9 w-full text-right`}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900 font-medium tabular-nums whitespace-nowrap">
                    {formatRupiah(subtotal)}
                  </td>
                  <td className="pr-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      title="Hapus baris"
                      className="rounded p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={locked ? 6 : 7} className="px-4 py-10 text-center text-slate-500">
                  Belum ada barang. Tambah baris atau scan foto formulir.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={5} className="px-3 py-3 text-right text-sm text-slate-600">
                Total HPP · {rows.length} item
              </td>
              <td className="px-3 py-3 text-right text-base font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                {formatRupiah(total)}
              </td>
              {!locked && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {!locked && (
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={addRow} className={buttonSecondary} disabled={isScanning}>
            <Plus size={16} />
            Tambah Baris
          </button>
          <button
            type="button"
            onClick={() => {
              setScanEngine("gemini");
              fileInputRef.current?.click();
            }}
            className={buttonSecondary}
            disabled={isScanning}
          >
            {isScanning && scanEngine === "gemini" ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            Scan Foto (Gemini)
          </button>
          <button
            type="button"
            onClick={() => {
              setScanEngine("local");
              fileInputRef.current?.click();
            }}
            className={buttonSecondary}
            disabled={isScanning}
          >
            {isScanning && scanEngine === "local" ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            Scan Foto (Lokal)
          </button>
          {isScanning && (
            <span className="text-sm text-slate-500">
              {scanEngine === "gemini" ? "Membaca foto dengan Gemini..." : "Membaca foto (OCR lokal)..."}
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            className="hidden"
            onChange={handleScanForm}
          />
        </div>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      {!locked && (
        <button type="submit" disabled={pending || rows.length === 0} className={`${buttonPrimary} w-fit`}>
          {pending ? "Menyimpan..." : initial?.id ? "Simpan Perubahan" : "Simpan Permintaan"}
        </button>
      )}
    </form>
  );
}
