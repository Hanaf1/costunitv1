"use client";

import { useActionState } from "react";
import { UploadCloud } from "lucide-react";
import type { ImportState } from "../actions";
import { buttonPrimary, card } from "@/lib/ui";

export function ImportForm({
  action,
  label,
  hint,
}: {
  action: (state: ImportState, formData: FormData) => Promise<ImportState>;
  label: string;
  hint: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className={`flex flex-col gap-3 p-5 ${card}`}>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{label}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
      </div>
      <input
        type="file"
        name="file"
        accept=".xlsx"
        required
        className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
      />
      <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>
        <UploadCloud size={16} />
        {pending ? "Mengimpor..." : "Import"}
      </button>
      {state && (
        <div className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-600"}>
          <p>{state.message}</p>
          {state.ok && state.warnings.length > 0 && (
            <ul className="list-disc pl-5 mt-1 text-amber-700">
              {state.warnings.slice(0, 10).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {state.warnings.length > 10 && <li>...dan {state.warnings.length - 10} peringatan lainnya.</li>}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
