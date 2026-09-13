import { requireSession } from "@/lib/auth";
import { PageHeader } from "../../../page-header";
import { CreateUnitForm } from "./create-form";

export default async function TambahUnitPage() {
  await requireSession();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Tambah Unit" description="Tambahkan unit baru ke master unit secara manual." />
      <CreateUnitForm />
    </div>
  );
}
