"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePermintaanAction } from "./actions";

export function DeletePermintaanButton({
  id,
  label = "Hapus",
  description,
  disabled,
  className,
}: {
  id: string;
  label?: string;
  description: string;
  disabled?: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => {
        if (!window.confirm(`Hapus permintaan ${description}? Data yang dihapus tidak bisa dikembalikan.`)) return;
        startTransition(() => deletePermintaanAction(id));
      }}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:hover:bg-transparent"
      }
    >
      <Trash2 size={14} />
      {pending ? "Menghapus..." : label}
    </button>
  );
}
