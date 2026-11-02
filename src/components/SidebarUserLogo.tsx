import React from "react";
import { ChevronsUpDown, Film } from "lucide-react";

type Props = {
  cineLabel: string;
  isExpanded: boolean;
  isServerOnline: boolean;
  roleLabel?: string;
  onPress?: () => void;
};

export default function SidebarUserLogo({
  cineLabel,
  isExpanded,
  isServerOnline,
  roleLabel = "COMPLEJO",
  onPress,
}: Props) {
  return (
    <button
      type="button"
      onClick={onPress}
      title={`${cineLabel || "Cinemark"} — Configuración`}
      className={`group flex w-full items-center rounded-xl border border-transparent p-2 text-left transition-all duration-150 hover:border-slate-200/80 hover:bg-slate-100/80 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 ${
        isExpanded ? "justify-between px-2.5" : "justify-center px-1"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Minimalist Corporate Workspace Avatar */}
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-600 to-rose-700 text-white shadow-sm ring-1 ring-rose-700/20 transition-transform duration-150 group-hover:scale-[1.03]">
          <Film className="h-4 w-4 stroke-[2.2]" />
          {/* Live Status Indicator Dot */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full ring-2 ring-white dark:ring-zinc-950 ${
              isServerOnline ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
        </div>

        {isExpanded && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13.5px] font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                {cineLabel || "Cinemark"}
              </span>
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-slate-600 ring-1 ring-inset ring-slate-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                {roleLabel}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  isServerOnline ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              <span className="truncate">
                {isServerOnline ? "API Local Conectada" : "Respaldo Cloud (Lectura)"}
              </span>
            </div>
          </div>
        )}
      </div>

      {isExpanded && (
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-600 dark:text-zinc-500 dark:group-hover:text-zinc-300" />
      )}
    </button>
  );
}
