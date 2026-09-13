"use client";

import { useActionState } from "react";
import { createUnitAction } from "../../actions";
import { buttonPrimary, card, input } from "@/lib/ui";

export function CreateUnitForm() {
  const [state, action, pending] = useActionState(createUnitAction, undefined);

  return (
    <form action={action} className={`flex flex-col gap-4 max-w-xl p-5 ${card}`}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Kode Unit *">
          <input name="kodeUnit" required className={input} />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue="Aktif" className={input}>
            <option value="Aktif">Aktif</option>
            <option value="Nonaktif">Nonaktif</option>
          </select>
        </Field>
      </div>

      <Field label="Nama Unit *">
        <input name="namaUnit" required className={input} />
      </Field>

      <Field label="Struktur Induk">
        <input name="strukturInduk" className={input} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="PJ Unit">
          <input name="pjUnit" className={input} />
        </Field>
        <Field label="NIK PJ">
          <input name="nikPj" className={input} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Gedung">
          <input name="gedung" className={input} />
        </Field>
        <Field label="Lantai">
          <input name="lantai" className={input} />
        </Field>
      </div>

      <Field label="Lokasi Detail">
        <input name="lokasiDetail" className={input} />
      </Field>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>
        {pending ? "Menyimpan..." : "Simpan Unit"}
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
