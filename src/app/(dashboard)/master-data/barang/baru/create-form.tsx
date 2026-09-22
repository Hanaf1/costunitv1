"use client";

import { useActionState } from "react";
import { createBarangAction } from "../../actions";
import { SatuanListEditor } from "../satuan-list-editor";
import { buttonPrimary, card, input } from "@/lib/ui";

export function CreateBarangForm() {
  const [state, action, pending] = useActionState(createBarangAction, undefined);

  return (
    <form action={action} className={`flex flex-col gap-4 max-w-xl p-5 ${card}`}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Kode Item *">
          <input name="kodeItem" required className={input} />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue="Aktif" className={input}>
            <option value="Aktif">Aktif</option>
            <option value="Nonaktif">Nonaktif</option>
          </select>
        </Field>
      </div>

      <Field label="Nama Barang *">
        <input name="namaBarang" required className={input} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Satuan Dasar *">
          <input name="satuanDasar" defaultValue="Pcs" required className={input} />
        </Field>
        <Field label="Satuan Konversi">
          <input name="satuanKonversi" className={input} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Kategori">
          <input name="kategori" className={input} />
        </Field>
        <Field label="Sub Kategori">
          <input name="subKategori" className={input} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Jenis Item">
          <input name="jenisItem" className={input} />
        </Field>
        <Field label="Tipe Barang">
          <input name="tipeBarang" className={input} />
        </Field>
      </div>

      <Field label="Harga Referensi (Rp) *">
        <input name="hargaReferensi" type="number" min={0} step={1} required className={input} />
      </Field>

      <SatuanListEditor />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>
        {pending ? "Menyimpan..." : "Simpan Barang"}
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
