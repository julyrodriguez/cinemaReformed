import React, { useMemo, useState } from "react";
import { GlobeLock, KeyRound, LogOut, Monitor, ShieldCheck } from "lucide-react";

export function IpAccessGate({
  visible,
  cineLabel,
  ip,
  loading,
  error,
  onSubmit,
  onLogout,
}: {
  visible: boolean;
  cineLabel: string;
  ip: string;
  loading: boolean;
  error: string | null;
  onSubmit: (payload: { pin: string; label: string }) => void;
  onLogout: () => void;
}) {
  const [pin, setPin] = useState("");
  const [label, setLabel] = useState("PC Proyección");

  const safeCineLabel = useMemo(() => cineLabel || "Cine", [cineLabel]);

  if (!visible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ pin, label });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-stripe-lg dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-5 text-center dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200/70 dark:bg-rose-950/50 dark:text-rose-400 dark:ring-rose-900/50">
            <GlobeLock className="h-5 w-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            Autorización de IP Requerida
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Esta dirección IP aún no se encuentra vinculada al complejo{" "}
            <span className="font-semibold text-slate-800 dark:text-zinc-200">
              {safeCineLabel}
            </span>
            .
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              IP Detectada
            </span>
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-zinc-100">
              {ip || "—"}
            </span>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300">
              <Monitor className="h-3.5 w-3.5 text-slate-400" />
              <span>Etiqueta del Equipo</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: PC Cabina / Administración"
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300">
              <KeyRound className="h-3.5 w-3.5 text-slate-400" />
              <span>PIN de Acceso del Complejo</span>
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\s+/g, ""))}
              placeholder="••••"
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm tracking-widest text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-center text-xs font-semibold text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="space-y-2.5 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{loading ? "Verificando PIN..." : "Autorizar IP y Continuar"}</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
