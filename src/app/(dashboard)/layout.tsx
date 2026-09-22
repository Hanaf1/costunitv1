import { requireSession } from "@/lib/auth";
import { Sidebar } from "./sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const username = await requireSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar username={username} />
      <main className="lg:pl-64">
        <div className="w-full px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
