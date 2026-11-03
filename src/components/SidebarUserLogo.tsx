import React from "react";
import { Film } from "lucide-react";

type Props = {
  cineLabel: string;
  isExpanded: boolean;
  isServerOnline?: boolean;
  roleLabel?: string;
  onPress?: () => void;
};

export default function SidebarUserLogo({
  cineLabel,
  isExpanded,
  roleLabel = "Cine",
}: Props) {
  const displayRole =
    roleLabel.toUpperCase() === "CINE"
      ? "Cine"
      : roleLabel.toUpperCase() === "ADMIN"
      ? "Admin"
      : roleLabel.toUpperCase() === "OFICINAS"
      ? "Oficinas"
      : roleLabel;

  return (
    <div
      className={`flex w-full items-center rounded-xl p-1.5 text-left select-none ${
        isExpanded ? "justify-start px-2" : "justify-center px-1"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Minimalist Corporate Workspace Avatar */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-600 to-rose-700 text-white shadow-sm ring-1 ring-rose-700/20">
          <Film className="h-4 w-4 stroke-[2.2]" />
        </div>

        {isExpanded && (
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {cineLabel || "Cinemark"}
            </span>
            <span className="block text-[11px] font-medium text-slate-500 dark:text-zinc-400">
              {displayRole}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
