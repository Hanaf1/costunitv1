"use client";

import { useActionState } from "react";
import { updateBarangAction } from "../../actions";
import type { Barang, BarangSatuan } from "@prisma/client";
import { SatuanListEditor } from "../satuan-list-editor";
import { buttonPrimary, card, input } from "@/lib/ui";

export function EditBarangForm({ barang }: { barang: Barang & { satuanList: BarangSatuan[] } }) {
  const [state, action, pending] = useActionState(updateBarangAction, undefined);

  return (
    <form action={action} className={`flex flex-col gap-4 max-w-xl p-5 ${card}`}>
      <input type="hidden" name="id" value={barang.id} />

      <Field label="Kode Item">
        <input disabled value={barang.kodeItem} className={`${input} bg-slate-50 text-slate-500`} />
      </Field>

      <Field label="Nama Barang">
        <input name="namaBarang" defaultValue={barang.namaBarang} required className={input} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Satuan Dasar">
          <input name="satuanDasar" defaultValue={barang.satuanDasar} required className={input} />
        </Field>
        <Field label="Satuan Konversi">
          <input name="satuanKonversi" defaultValue={barang.satuanKonversi ?? ""} className={input} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Kategori">
          <input name="kategori" defaultValue={barang.kategori ?? ""} className={input} />
        </Field>
        <Field label="Sub Kategori">
          <input name="subKategori" defaultValue={barang.subKategori ?? ""} className={input} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Jenis Item">
          <input name="jenisItem" defaultValue={barang.jenisItem ?? ""} className={input} />
        </Field>
        <Field label="Tipe Barang">
          <input name="tipeBarang" defaultValue={barang.tipeBarang ?? ""} className={input} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Harga Referensi (Rp)">
          <input
            name="hargaReferensi"
            type="number"
            min={0}
            step={1}
            defaultValue={barang.hargaReferensi}
            required
            className={input}
          />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={barang.status} className={input}>
            <option value="Aktif">Aktif</option>
            <option value="Nonaktif">Nonaktif</option>
          </select>
        </Field>
      </div>

      <SatuanListEditor
        initial={barang.satuanList.map((s) => ({ namaSatuan: s.namaSatuan, isi: s.isi, harga: s.harga }))}
      />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>
        {pending ? "Menyimpan..." : "Simpan Perubahan"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
