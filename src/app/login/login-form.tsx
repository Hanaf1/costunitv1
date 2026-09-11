"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-4 w-full max-w-sm">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm font-medium text-slate-700">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoFocus
          className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-slate-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
