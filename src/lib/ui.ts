export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 transition-colors";

export const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors";

export const buttonSuccess =
  "inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 transition-colors";

export const buttonDanger = "text-sm text-red-600 hover:text-red-700 underline underline-offset-2";

export const card = "border border-slate-200 rounded-lg bg-white";

export const input =
  "border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400";

export const badge = (tone: "success" | "neutral") =>
  tone === "success"
    ? "text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-0.5 text-xs font-medium"
    : "text-slate-500 bg-slate-100 rounded-full px-2.5 py-0.5 text-xs font-medium";
