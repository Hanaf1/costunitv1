import { requireSession } from "@/lib/auth";
import { PageHeader } from "../../../page-header";
import { CreateBarangForm } from "./create-form";

export default async function TambahBarangPage() {
  await requireSession();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Tambah Barang" description="Tambahkan item baru ke master barang secara manual." />
      <CreateBarangForm />
    </div>
  );
}
