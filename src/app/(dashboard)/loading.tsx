import { card } from "@/lib/ui";

// Skeleton instan saat pindah halaman di dashboard, supaya klik tidak terasa macet
// selagi server mengambil data.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse" aria-busy="true">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-64 max-w-full rounded bg-slate-200" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
      </div>
      <div className={`${card} flex flex-col gap-3 p-5`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 rounded bg-slate-100" />
        ))}
      </div>
      <div className={`${card} flex flex-col gap-3 p-5`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-6 rounded bg-slate-100" />
        ))}
      </div>
      <span className="sr-only">Memuat...</span>
    </div>
  );
}
