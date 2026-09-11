import { requireSession } from "@/lib/auth";
import { importBarangAction, importUnitAction } from "../actions";
import { ImportForm } from "./import-form";
import { PageHeader } from "../../page-header";

export default async function ImportMasterDataPage() {
  await requireSession();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title="Import Master Data"
        description="Upload file export Master Unit / Master Barang (.xlsx). Import ulang akan memperbarui data yang sudah ada berdasarkan Kode Unit / Kode Item (tidak menduplikasi)."
      />

      <ImportForm
        action={importUnitAction}
        label="Master Unit"
        hint="Kolom wajib: Kode Unit, Nama Unit."
      />
      <ImportForm
        action={importBarangAction}
        label="Master Barang"
        hint="Kolom wajib: Kode Item, Nama Barang, Satuan Dasar, Harga Referensi (HPS)."
      />
    </div>
  );
}
