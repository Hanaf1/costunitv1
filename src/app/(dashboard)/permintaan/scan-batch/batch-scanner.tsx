"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { SearchableSelect } from "../../searchable-select";
import { saveBatchPermintaanAction, type BatchSaveResult } from "../actions";
import { satuanChoices, type BarangOption } from "@/lib/satuan";
import { isoWeekInfo } from "@/lib/week";
import { formatRupiah } from "@/lib/format";
import { buttonPrimary, buttonSecondary, card, input } from "@/lib/ui";
import type { ScannedForm } from "@/app/api/scan-batch/route";

type Row = {
  key: string;
  teks: string;
  barangId: string;
  namaBarangSnapshot: string;
  satuanSnapshot: string;
  isiSnapshot: number;
  jumlahBarang: number;
  hargaSatuan: number;
};

type FormCard = {
  key: string;
  foto: number;
  ruangTeks: string;
  unitId: string;
  tanggal: string; // YYYY-MM-DD
  minggu: string; // YYYY-Www
  include: boolean;
  rows: Row[];
};

type PhotoStatus = { name: string; state: "antri" | "membaca" | "selesai" | "gagal"; message?: string };

let keyCounter = 0;
const newKey = () => `k${Date.now()}-${++keyCounter}`;

function mingguFromTanggal(tanggal: string): string {
  const d = new Date(`${tanggal}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const w = isoWeekInfo(d);
  return `${w.tahun}-W${String(w.mingguKe).padStart(2, "0")}`;
}

// Kecilkan foto HP (bisa >5 MB) agar muat batas body request Vercel (4,5 MB).
async function compressImage(file: File): Promise<Blob> {
  const MAX = 2000;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal memproses foto"))), "image/jpeg", 0.85),
  );
}

export function BatchScanner({
  units,
  barangOptions,
  existingWeeks,
}: {
  units: { id: string; namaUnit: string }[];
  barangOptions: BarangOption[];
  existingWeeks: string[];
}) {
  const [forms, setForms] = useState<FormCard[]>([]);
  const [photos, setPhotos] = useState<PhotoStatus[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [result, setResult] = useState<Extract<BatchSaveResult, { ok: true }> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const barangById = useMemo(() => new Map(barangOptions.map((b) => [b.id, b])), [barangOptions]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u.namaUnit])), [units]);
  const existingSet = useMemo(() => new Set(existingWeeks), [existingWeeks]);
  const barangSelectOptions = useMemo(
    () => barangOptions.map((b) => ({ value: b.id, label: b.namaBarang, hint: `${b.kodeItem} · ${b.satuanDasar}` })),
    [barangOptions],
  );
  const unitSelectOptions = useMemo(() => units.map((u) => ({ value: u.id, label: u.namaUnit })), [units]);
  const scanning = photos.some((p) => p.state === "antri" || p.state === "membaca");

  function rowFromBarang(teks: string, barangId: string | null, jumlah: number): Row {
    const b = barangId ? barangById.get(barangId) : undefined;
    return {
      key: newKey(),
      teks,
      barangId: b?.id ?? "",
      namaBarangSnapshot: b?.namaBarang ?? "",
      satuanSnapshot: b?.satuanDasar ?? "",
      isiSnapshot: 1,
      jumlahBarang: jumlah,
      hargaSatuan: b?.hargaReferensi ?? 0,
    };
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = [...files];
    const offset = photos.length;
    setPhotos((prev) => [...prev, ...list.map((f) => ({ name: f.name, state: "antri" as const }))]);
    setResult(null);

    const setPhoto = (i: number, patch: Partial<PhotoStatus>) =>
      setPhotos((prev) => prev.map((p, j) => (j === offset + i ? { ...p, ...patch } : p)));

    // Satu foto per request: aman dari batas ukuran & durasi function.
    for (const [i, file] of list.entries()) {
      setPhoto(i, { state: "membaca" });
      try {
        const body = new FormData();
        body.append("file", await compressImage(file), "form.jpg");
        const res = await fetch("/api/scan-batch", { method: "POST", body });
        const data = (await res.json().catch(() => ({}))) as { forms?: ScannedForm[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Gagal membaca foto");

        const cards: FormCard[] = (data.forms ?? []).map((f) => ({
          key: newKey(),
          foto: offset + i + 1,
          ruangTeks: f.ruangTeks,
          unitId: f.unitId ?? "",
          tanggal: f.tanggal ?? "",
          minggu: f.tanggal ? mingguFromTanggal(f.tanggal) : "",
          include: true,
          rows: f.items.map((it) => rowFromBarang(it.teks, it.barangId, it.jumlah)),
        }));
        setForms((prev) => [...prev, ...cards]);
        setPhoto(i, { state: "selesai", message: `${cards.length} formulir terbaca` });
      } catch (err) {
        setPhoto(i, { state: "gagal", message: err instanceof Error ? err.message : String(err) });
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function updateForm(key: string, patch: Partial<FormCard>) {
    setForms((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }
  function updateRow(formKey: string, rowKey: string, patch: Partial<Row>) {
    setForms((prev) =>
      prev.map((f) =>
        f.key === formKey ? { ...f, rows: f.rows.map((r) => (r.key === rowKey ? { ...r, ...patch } : r)) } : f,
      ),
    );
  }
  function selectBarang(formKey: string, rowKey: string, barangId: string) {
    const b = barangById.get(barangId);
    updateRow(formKey, rowKey, {
      barangId: b?.id ?? "",
      namaBarangSnapshot: b?.namaBarang ?? "",
      satuanSnapshot: b?.satuanDasar ?? "",
      isiSnapshot: 1,
      hargaSatuan: b?.hargaReferensi ?? 0,
    });
  }
  function selectSatuan(formKey: string, row: Row, nama: string) {
    const b = barangById.get(row.barangId);
    const c = b && satuanChoices(b).find((x) => x.nama === nama);
    if (c) updateRow(formKey, row.key, { satuanSnapshot: c.nama, isiSnapshot: c.isi, hargaSatuan: c.harga });
  }

  const active = forms.filter((f) => f.include);
  const problems = (f: FormCard) => {
    const list: string[] = [];
    if (!f.unitId) list.push("unit belum dipilih");
    if (!f.minggu) list.push("minggu belum diisi");
    if (f.rows.length === 0) list.push("belum ada barang");
    const unmatched = f.rows.filter((r) => !r.barangId).length;
    if (unmatched) list.push(`${unmatched} barang belum dipilih`);
    return list;
  };
  const canSave = active.length > 0 && active.every((f) => problems(f).length === 0) && !saving && !scanning;
  const totalItems = active.reduce((s, f) => s + f.rows.length, 0);
  const totalHarga = active.reduce((s, f) => s + f.rows.reduce((t, r) => t + r.jumlahBarang * r.hargaSatuan, 0), 0);

  async function saveAll() {
    setSaving(true);
    setSaveError("");
    const res = await saveBatchPermintaanAction(
      active.map((f) => ({
        unitId: f.unitId,
        minggu: f.minggu,
        items: f.rows.map((r) => ({
          barangId: r.barangId,
          namaBarangSnapshot: r.namaBarangSnapshot,
          satuanSnapshot: r.satuanSnapshot,
          isiSnapshot: r.isiSnapshot,
          jumlahBarang: r.jumlahBarang,
          hargaSatuan: r.hargaSatuan,
        })),
      })),
    ).catch((err) => ({ ok: false as const, error: err instanceof Error ? err.message : String(err) }));
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    setResult(res);
    setForms([]);
    setPhotos([]);
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      {result && (
        <section className={`p-5 ${card}`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CheckCircle2 size={18} className="text-emerald-600" />
            {result.saved.length} permintaan tersimpan
          </h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {result.saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-slate-800">
                  <span className="font-medium">{unitById.get(s.unitId) ?? "-"}</span> · {s.minggu} · {s.itemCount} barang
                  <span className="ml-2 text-xs text-slate-500">
                    {s.appended ? "ditambahkan ke permintaan yang sudah ada" : "permintaan baru"}
                  </span>
                </span>
                <Link href={`/permintaan/${s.id}`} className="text-sm text-slate-700 underline underline-offset-2">
                  Lihat
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        className={`flex flex-col items-center gap-3 border-2 border-dashed border-slate-300 bg-white p-8 text-center rounded-lg`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <ImagePlus size={32} className="text-slate-400" />
        <div>
          <p className="text-sm font-medium text-slate-900">Tarik foto ke sini, atau pilih dari perangkat</p>
          <p className="text-xs text-slate-500">
            Satu foto boleh berisi banyak formulir. Pastikan tulisan terbaca dan formulir tidak saling menutupi.
          </p>
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} className={buttonPrimary} disabled={scanning}>
          {scanning ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          {scanning ? "Membaca foto..." : "Pilih Foto"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {photos.length > 0 && (
          <ul className="w-full max-w-md text-left text-sm">
            {photos.map((p, i) => (
              <li key={i} className="flex items-center gap-2 py-1">
                {p.state === "membaca" || p.state === "antri" ? (
                  <Loader2 size={14} className="animate-spin text-slate-400" />
                ) : p.state === "selesai" ? (
                  <CheckCircle2 size={14} className="text-emerald-600" />
                ) : (
                  <AlertTriangle size={14} className="text-red-600" />
                )}
                <span className="text-slate-700">Foto {i + 1}</span>
                <span className={`text-xs ${p.state === "gagal" ? "text-red-600" : "text-slate-500"}`}>
                  {p.state === "antri" ? "menunggu" : p.state === "membaca" ? "membaca..." : p.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {forms.map((f, index) => {
        const issues = problems(f);
        const exists = f.unitId && f.minggu && existingSet.has(`${f.unitId}|${f.minggu}`);
        const subtotal = f.rows.reduce((t, r) => t + r.jumlahBarang * r.hargaSatuan, 0);
        return (
          <section key={f.key} className={`${card} ${f.include ? "" : "opacity-50"}`}>
            <header className="flex flex-wrap items-start gap-4 border-b border-slate-200 p-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Formulir #{index + 1} · foto {f.foto}</span>
                <div className="w-64">
                  <SearchableSelect
                    options={unitSelectOptions}
                    value={f.unitId}
                    onChange={(v) => updateForm(f.key, { unitId: v })}
                    placeholder="Pilih unit..."
                    size="sm"
                  />
                </div>
                <span className="text-xs text-slate-500">Tertulis: &ldquo;{f.ruangTeks || "-"}&rdquo;</span>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Tanggal</span>
                <input
                  type="date"
                  value={f.tanggal}
                  onChange={(e) =>
                    updateForm(f.key, { tanggal: e.target.value, minggu: mingguFromTanggal(e.target.value) || f.minggu })
                  }
                  className={`${input} py-1.5`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Minggu</span>
                <input
                  type="week"
                  value={f.minggu}
                  onChange={(e) => updateForm(f.key, { minggu: e.target.value })}
                  className={`${input} py-1.5`}
                />
              </label>
              <div className="ml-auto flex flex-col items-end gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={f.include}
                    onChange={(e) => updateForm(f.key, { include: e.target.checked })}
                  />
                  Ikut disimpan
                </label>
                {f.include &&
                  (issues.length > 0 ? (
                    <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">{issues.join(" · ")}</span>
                  ) : exists ? (
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                      Sudah ada permintaan minggu ini → barang ditambahkan
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Permintaan baru</span>
                  ))}
              </div>
            </header>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="px-4 py-2">Barang</th>
                    <th className="px-3 py-2">Satuan</th>
                    <th className="px-3 py-2 text-right">Jumlah</th>
                    <th className="px-3 py-2 text-right">Harga Satuan</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {f.rows.map((r) => {
                    const b = barangById.get(r.barangId);
                    const choices = b ? satuanChoices(b) : [];
                    return (
                      <tr key={r.key} className={r.barangId ? "" : "bg-amber-50/60"}>
                        <td className="px-4 py-2">
                          <div className="w-72">
                            <SearchableSelect
                              options={barangSelectOptions}
                              value={r.barangId}
                              onChange={(v) => selectBarang(f.key, r.key, v)}
                              placeholder="Pilih barang..."
                              size="sm"
                            />
                          </div>
                          {r.teks && <span className="mt-0.5 block text-xs text-slate-500">Tertulis: &ldquo;{r.teks}&rdquo;</span>}
                        </td>
                        <td className="px-3 py-2">
                          {b && choices.length > 1 ? (
                            <select
                              value={r.satuanSnapshot}
                              onChange={(e) => selectSatuan(f.key, r, e.target.value)}
                              className={`${input} py-1.5 w-36`}
                            >
                              {choices.map((c) => (
                                <option key={c.nama} value={c.nama}>
                                  {c.isi > 1 ? `${c.nama} (${c.isi} ${b.satuanDasar})` : c.nama}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-700">{r.satuanSnapshot || "-"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            value={r.jumlahBarang}
                            onChange={(e) => updateRow(f.key, r.key, { jumlahBarang: Number(e.target.value) || 0 })}
                            className={`${input} py-1.5 w-20 text-right ml-auto block`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={r.hargaSatuan}
                            onChange={(e) => updateRow(f.key, r.key, { hargaSatuan: Number(e.target.value) || 0 })}
                            className={`${input} py-1.5 w-28 text-right ml-auto block`}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900 whitespace-nowrap">
                          {formatRupiah(r.jumlahBarang * r.hargaSatuan)}
                        </td>
                        <td className="pr-3 py-2 text-right">
                          <button
                            type="button"
                            title="Hapus baris"
                            onClick={() => updateForm(f.key, { rows: f.rows.filter((x) => x.key !== r.key) })}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
              <button
                type="button"
                onClick={() => updateForm(f.key, { rows: [...f.rows, rowFromBarang("", null, 1)] })}
                className="inline-flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900"
              >
                <Plus size={14} />
                Tambah baris
              </button>
              <span className="text-sm text-slate-600">
                Subtotal <span className="font-semibold text-slate-900">{formatRupiah(subtotal)}</span>
              </span>
            </footer>
          </section>
        );
      })}

      {forms.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur lg:pl-64">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">{active.length}</span> formulir ·{" "}
              <span className="font-semibold text-slate-900">{totalItems}</span> barang ·{" "}
              <span className="font-semibold text-slate-900">{formatRupiah(totalHarga)}</span>
              {saveError && <span className="ml-3 text-red-600">{saveError}</span>}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForms([])} className={buttonSecondary} disabled={saving}>
                Buang Semua
              </button>
              <button type="button" onClick={saveAll} className={buttonPrimary} disabled={!canSave}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Menyimpan..." : "Simpan Semua"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
