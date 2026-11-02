import React from "react";
import { useRouter } from "expo-router";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-stripe-md dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
          <Compass className="h-6 w-6" />
        </div>
        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
          ERROR 404
        </span>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          Sección no encontrada
        </h1>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
          La dirección a la que intentás acceder no existe o fue reubicada dentro del panel operativo.
        </p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver al panel principal</span>
        </button>
      </div>
    </div>
  );
}
