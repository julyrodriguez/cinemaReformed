import React, { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Lock,
  RefreshCw,
  Server,
  ServerOff,
  ShieldAlert,
  Sliders,
  X,
} from "lucide-react";

import { getCineConfig, saveCineConfig } from "@/lib/cineConfig";
import { useServerStatus } from "@/lib/dbService";
import { changeCinemaPassword, updateProyeccionPin } from "@/lib/ipAccess";
import { db, CINES_COLLECTION } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

type Props = {
  visible: boolean;
  cineId: string;
  fallbackTitle?: string;
  onClose: () => void;
};

type SettingsTab = "general" | "security" | "pin";

export default function CineProfileModal({
  visible,
  cineId,
  fallbackTitle = "Cine",
  onClose,
}: Props) {
  const {
    isOnline: isServerOnline,
    isChecking: isCheckingServer,
    recheck: recheckServer,
  } = useServerStatus();

  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [loading, setLoading] = useState(true);

  const [savingConfig, setSavingConfig] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [nombre, setNombre] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [salasCount, setSalasCount] = useState("");

  const [configError, setConfigError] = useState<string | null>(null);
  const [configOkMsg, setConfigOkMsg] = useState<string | null>(null);

  const [pin, setPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordOkMsg, setPasswordOkMsg] = useState<string | null>(null);

  const [newProyeccionPin, setNewProyeccionPin] = useState("");
  const [repeatProyeccionPin, setRepeatProyeccionPin] = useState("");
  const [masterPin, setMasterPin] = useState("");
  const [proyeccionPinError, setProyeccionPinError] = useState<string | null>(null);
  const [proyeccionPinOkMsg, setProyeccionPinOkMsg] = useState<string | null>(null);
  const [updatingProyeccionPin, setUpdatingProyeccionPin] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!visible || !cineId) return;

      setLoading(true);
      setConfigError(null);
      setConfigOkMsg(null);
      setPasswordError(null);
      setPasswordOkMsg(null);
      setRefreshStatus(null);
      setRefreshError(null);
      setPin("");
      setNewPassword("");
      setRepeatPassword("");
      setNewProyeccionPin("");
      setRepeatProyeccionPin("");
      setMasterPin("");
      setProyeccionPinError(null);
      setProyeccionPinOkMsg(null);

      try {
        const cfg = await getCineConfig(cineId);
        if (cancelled) return;

        setNombre(cfg?.nombre || fallbackTitle);
        setAuthEmail(cfg?.authEmail || "");
        setSalasCount(
          cfg?.salasCount != null && !Number.isNaN(cfg.salasCount)
            ? String(cfg.salasCount)
            : ""
        );
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setConfigError("No se pudo cargar la configuración del cine.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [visible, cineId, fallbackTitle]);

  if (!visible) return null;

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);
    setConfigOkMsg(null);

    const parsed = Number(salasCount);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setConfigError("La cantidad de salas debe ser un número mayor o igual a 1.");
      return;
    }

    try {
      setSavingConfig(true);
      await saveCineConfig(cineId, {
        nombre: nombre.trim(),
        authEmail: authEmail.trim(),
        salasCount: Math.floor(parsed),
      });
      setConfigOkMsg("Configuración guardada correctamente.");
    } catch (e) {
      console.error(e);
      setConfigError("No se pudo guardar la configuración.");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordOkMsg(null);

    const cleanPin = pin.trim();
    const pass = newPassword;
    const repeat = repeatPassword;

    if (!cleanPin) {
      setPasswordError("Ingresá el PIN actual.");
      return;
    }
    if (!pass) {
      setPasswordError("Ingresá la nueva contraseña.");
      return;
    }
    if (pass.length < 6) {
      setPasswordError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (pass !== repeat) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setChangingPassword(true);
      const res = await changeCinemaPassword({
        pin: cleanPin,
        newPassword: pass,
      });

      if (!res.ok) {
        setPasswordError(res.message);
        return;
      }

      setPasswordOkMsg(res.message);
      setPin("");
      setNewPassword("");
      setRepeatPassword("");
    } catch (e) {
      console.error(e);
      setPasswordError("No se pudo cambiar la contraseña.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveProyeccionPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setProyeccionPinError(null);
    setProyeccionPinOkMsg(null);

    const cleanMasterPin = masterPin.trim();
    const cleanProjPin = newProyeccionPin.trim();
    const cleanRepeatProjPin = repeatProyeccionPin.trim();

    if (!cleanProjPin) {
      setProyeccionPinError("Ingresá el nuevo PIN de proyección.");
      return;
    }
    if (cleanProjPin !== cleanRepeatProjPin) {
      setProyeccionPinError("Los PINs no coinciden.");
      return;
    }
    if (!cleanMasterPin) {
      setProyeccionPinError("Ingresá el PIN maestro.");
      return;
    }

    try {
      setUpdatingProyeccionPin(true);
      const res = await updateProyeccionPin({
        pin: cleanMasterPin,
        proyeccionPin: cleanProjPin,
      });

      if (!res.ok) {
        setProyeccionPinError(res.message);
        return;
      }

      setProyeccionPinOkMsg(res.message);
      setNewProyeccionPin("");
      setRepeatProyeccionPin("");
      setMasterPin("");
    } catch (e) {
      console.error(e);
      setProyeccionPinError("No se pudo actualizar el PIN de proyección.");
    } finally {
      setUpdatingProyeccionPin(false);
    }
  };

  const handleRefreshSession = async () => {
    setRefreshing(true);
    setRefreshStatus(null);
    setRefreshError(null);

    let backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "";
    try {
      const globalConfigSnap = await getDoc(doc(db, CINES_COLLECTION, "global", "info", "config"));
      if (globalConfigSnap.exists() && globalConfigSnap.data()?.dataProcessorUrl) {
        backendUrl = globalConfigSnap.data()?.dataProcessorUrl;
      } else {
        const cineConfigSnap = await getDoc(doc(db, CINES_COLLECTION, cineId, "info", "config"));
        if (cineConfigSnap.exists() && cineConfigSnap.data()?.dataProcessorUrl) {
          backendUrl = cineConfigSnap.data()?.dataProcessorUrl;
        }
      }
    } catch (err) {
      console.error("Error al buscar backend URL en Firestore:", err);
    }

    try {
      const res = await fetch(`${backendUrl}/api/cinemark/session/refresh`, {
        method: "POST",
      });

      if (res.ok) {
        const resJson = (await res.json()) as any;
        if (resJson?.success) {
          setRefreshStatus("¡Sesión de Cinemark renovada con éxito!");
        } else {
          setRefreshError(`Error: ${resJson?.error || "Desconocido"}`);
        }
      } else {
        setRefreshError(`Error del servidor: ${res.status}`);
      }
    } catch (err: any) {
      console.error("Error renovando sesión:", err);
      setRefreshError("Error: No se pudo conectar con el servidor.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-stripe-lg dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Configuración del Complejo
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Parámetros operativos, conexión con servidor y seguridad
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Server Status Callout */}
        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
              isServerOnline
                ? "border-emerald-200/80 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "border-rose-200/80 bg-rose-50/60 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {isServerOnline ? (
                <Server className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ServerOff className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span>
                    {isServerOnline
                      ? "Servidor Docker en línea"
                      : isCheckingServer
                      ? "Comprobando conexión..."
                      : "Servidor desconectado (Modo Lectura)"}
                  </span>
                </div>
                <p className="truncate text-[11px] opacity-80">
                  {isServerOnline
                    ? "Sincronización activa con MongoDB y respaldo en Firestore."
                    : "Consultando datos desde respaldo en Firebase. Escrituras deshabilitadas."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={recheckServer}
              disabled={isCheckingServer}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-current/20 bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold shadow-sm hover:bg-white disabled:opacity-50 dark:bg-zinc-900/80 dark:hover:bg-zinc-900"
            >
              <RefreshCw className={`h-3 w-3 ${isCheckingServer ? "animate-spin" : ""}`} />
              <span>Comprobar</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-900">
          {[
            { id: "general" as const, label: "Complejo y Salas", icon: Sliders },
            { id: "pin" as const, label: "PIN de Proyección", icon: Lock },
            { id: "security" as const, label: "Contraseña", icon: KeyRound },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-colors ${
                  active
                    ? "border-rose-600 text-rose-600 dark:border-rose-500 dark:text-rose-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-zinc-400">
              <RefreshCw className="h-6 w-6 animate-spin text-rose-600" />
              <span className="mt-2 text-xs font-medium">Cargando configuración…</span>
            </div>
          ) : activeTab === "general" ? (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              {(cineId === "parquebrown" || authEmail.toLowerCase().includes("parquebrown")) && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    El control de acceso por IP (checkIpAccess) se encuentra desactivado para este complejo.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Nombre del Complejo
                  </label>
                  <input
                    type="text"
                    value={nombre}
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Identificador (Cine ID)
                  </label>
                  <input
                    type="text"
                    value={cineId}
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 font-mono text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Email de Autenticación
                  </label>
                  <input
                    type="text"
                    value={authEmail}
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 font-mono text-xs text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Cantidad de Salas
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={salasCount}
                    onChange={(e) => setSalasCount(e.target.value)}
                    placeholder="Ej: 10"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </div>

              {configError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                  {configError}
                </p>
              )}
              {configOkMsg && (
                <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {configOkMsg}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRefreshSession}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  <span>{refreshing ? "Renovando sesión BFF..." : "Renovar sesión Cinemark"}</span>
                </button>

                <button
                  type="submit"
                  disabled={savingConfig}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  {savingConfig ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>

              {refreshError && (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {refreshError}
                </p>
              )}
              {refreshStatus && (
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {refreshStatus}
                </p>
              )}
            </form>
          ) : activeTab === "pin" ? (
            <form onSubmit={handleSaveProyeccionPin} className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                El PIN de proyección permite desbloquear la edición en los módulos técnicos de Proyección y Calendario. Para modificarlo, ingresá el nuevo PIN y autorizalo con el PIN maestro del complejo.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Nuevo PIN de Proyección
                  </label>
                  <input
                    type="password"
                    value={newProyeccionPin}
                    onChange={(e) => setNewProyeccionPin(e.target.value)}
                    placeholder="Ej: 1234"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Repetir Nuevo PIN
                  </label>
                  <input
                    type="password"
                    value={repeatProyeccionPin}
                    onChange={(e) => setRepeatProyeccionPin(e.target.value)}
                    placeholder="Repetir PIN"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  PIN Maestro del Complejo
                </label>
                <input
                  type="password"
                  value={masterPin}
                  onChange={(e) => setMasterPin(e.target.value)}
                  placeholder="Ingresá el PIN maestro para autorizar"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              {proyeccionPinError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                  {proyeccionPinError}
                </p>
              )}
              {proyeccionPinOkMsg && (
                <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {proyeccionPinOkMsg}
                </p>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={updatingProyeccionPin}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  {updatingProyeccionPin ? "Actualizando..." : "Guardar PIN de Proyección"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                Para actualizar la contraseña de acceso del complejo, ingresá el PIN maestro actual y la nueva clave (mínimo 6 caracteres).
              </p>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  PIN Maestro Actual
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Ingresá el PIN del cine"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Repetir Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    placeholder="Repetí la contraseña"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </div>

              {passwordError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                  {passwordError}
                </p>
              )}
              {passwordOkMsg && (
                <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {passwordOkMsg}
                </p>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  {changingPassword ? "Actualizando..." : "Actualizar Contraseña"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
