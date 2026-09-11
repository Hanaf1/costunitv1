import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Cost Unit Report</h1>
          <p className="text-sm text-slate-500 mt-1">Login admin untuk mengelola permintaan & laporan.</p>
        </div>
        <LoginForm next={next && next.startsWith("/") ? next : "/laporan"} />
      </div>
    </main>
  );
}
