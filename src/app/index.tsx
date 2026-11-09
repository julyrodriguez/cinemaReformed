import { Redirect, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  LockOpen,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ServerOff,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import NavHeader from "@/components/NavHeader";
import CineProfileModal from "@/components/cineProfileModal";
import SidebarUserLogo from "@/components/SidebarUserLogo";
import { IpAccessGate } from "@/components/IpAccessGate";
import SEOHead from "@/components/SEOHead";
import { auth, db, CINES_COLLECTION } from "../lib/firebaseConfig";
import {
  doc,
  onSnapshot,
  useServerStatus,
  isFallbackMode,
  checkServerHealth,
} from "@/lib/dbService";
import { authorizeCurrentIp, checkIpAccess } from "../lib/ipAccess";
import { applyTheme, getSavedTheme, saveTheme } from "../lib/theme";
import { useAppLayout } from "../lib/useAppLayout";
import { useAuthUser } from "../lib/useAuthUser";

import CalendarTab from "./screens/CalendarTab";
import CreditosScreen from "./screens/Creditos";
import EventosScreen from "./screens/Eventos";
import MarketingTab from "./screens/MarketingTab";
import ProgramacionTab from "./screens/ProgramacionTab";
import RmaTab from "./screens/RmaTab";
import DcpTab from "./screens/DcpTab";
import OficinasCalendarioScreen from "./oficinas-calendario";
import OficinasEventosScreen from "./oficinas-eventos";
import CoordinadoresPoziScreen from "./screens/CoordinadoresPoziScreen";
import CoordinadoresProgramacionScreen from "./screens/CoordinadoresProgramacionScreen";
import CoordinadoresQuimicosScreen from "./screens/CoordinadoresQuimicosScreen";
import CoordinadoresLentesScreen from "./screens/CoordinadoresLentesScreen";
import CoordinadoresProximamenteScreen from "./screens/CoordinadoresProximamenteScreen";
import TrailersSemanalesScreen from "./screens/TrailersSemanalesScreen";
import ControlSemanalScreen from "./screens/ControlSemanalScreen";
import ChequeoCopiasScreen from "./screens/ChequeoCopiasScreen";
import LamparasScreen from "./screens/LamparasScreen";
import CierreMesScreen from "./screens/CierreMesScreen";
import ControlParlantesScreen from "./screens/ControlParlantesScreen";
import MantenimientosScreen from "./screens/MantenimientosScreen";
import ProgramacionProyeccionScreen from "./screens/ProgramacionProyeccionScreen";
import ControlSalasScreen from "./screens/ControlSalasScreen";
import MapaBannersScreen from "./screens/MapaBannersScreen";
import CompanyScreen from "./screens/CompanyScreen";
import FeedbackScreen from "./screens/FeedbackScreen";
import CustomPostersScreen from "./screens/CustomPostersScreen";
import StockMaterialesScreen from "./screens/StockMaterialesScreen";

type MainTab =
  | "PROGRAMACIÓN"
  | "CALENDARIO"
  | "EVENTOS"
  | "PROYECCIÓN"
  | "SERVICIOS"
  | "COORDINADORES"
  | "COMPAÑÍA"
  | "FEEDBACK";

type ProyeccionTab =
  | "RMA"
  | "MANTENIMIENTOS"
  | "CREDITOS"
  | "DCP"
  | "TRAILERS_SEMANALES"
  | "CHEQUEO_COPIAS"
  | "CONTROL_SEMANAL"
  | "LAMPARAS"
  | "CIERRE_MES"
  | "CONTROL_PARLANTES";

type MarketingSubTab =
  | "MKT"
  | "PROGRAMACION"
  | "CONTROL_SALAS"
  | "MAPA_BANNERS"
  | "STOCK_MATERIALES"
  | "CUSTOM_POSTERS";

type CoordinadoresSubTab =
  | "POZI"
  | "PROGRAMACION"
  | "QUIMICOS"
  | "LENTES_3D"
  | "PROXIMAMENTE";

const MAIN_TAB_META = {
  PROGRAMACIÓN: { label: "Programación", icon: "calendar-clock", group: "Operación Diaria" },
  CALENDARIO: { label: "Calendario", icon: "calendar-month-outline", group: "Operación Diaria" },
  EVENTOS: { label: "Eventos", icon: "calendar-star", group: "Operación Diaria" },
  PROYECCIÓN: { label: "Proyección", icon: "projector", group: "Áreas Técnicas" },
  SERVICIOS: { label: "Servicios", icon: "briefcase-outline", group: "Áreas Técnicas" },
  COORDINADORES: { label: "Coordinadores", icon: "account-group-outline", group: "Áreas Técnicas" },
  COMPAÑÍA: { label: "Compañía", icon: "office-building", group: "Corporativo" },
  FEEDBACK: { label: "Sugerencias & Bugs", icon: "message-draw", group: "Corporativo" },
} as const;

const SUB_TABS = {
  PROYECCIÓN: [
    { key: "LAMPARAS", label: "Lámparas", icon: "lightbulb-on-outline" },
    { key: "DCP", label: "DCP", icon: "disc" },
    { key: "CREDITOS", label: "Créditos", icon: "lightbulb-outline" },
    { key: "RMA", label: "RMA", icon: "wrench-outline" },
    { key: "MANTENIMIENTOS", label: "Mantenimientos", icon: "tools" },
    { key: "TRAILERS_SEMANALES", label: "Trailers Semanales", icon: "movie-outline" },
    { key: "CHEQUEO_COPIAS", label: "Chequeo de Copias", icon: "movie-check-outline" },
    { key: "CONTROL_SEMANAL", label: "Control Semanal", icon: "clipboard-check-outline" },
    { key: "CIERRE_MES", label: "Cierre de Mes", icon: "calendar-check" },
    { key: "CONTROL_PARLANTES", label: "Control Mensual Parlantes", icon: "speaker" },
  ],
  SERVICIOS: [
    { key: "PROGRAMACION", label: "Programaciones", icon: "clipboard-text-outline" },
    { key: "MKT", label: "Marketing", icon: "bullhorn-outline" },
    { key: "CONTROL_SALAS", label: "Control de Salas", icon: "sofa-single-outline" },
    { key: "MAPA_BANNERS", label: "Banners y Marquesinas", icon: "map-marker-outline" },
    { key: "STOCK_MATERIALES", label: "Stock Materiales", icon: "package-variant-closed" },
    { key: "CUSTOM_POSTERS", label: "Pósters Custom", icon: "image-plus" },
  ],
  COORDINADORES: [
    { key: "POZI", label: "POZI", icon: "account-clock-outline" },
    { key: "PROGRAMACION", label: "Programación", icon: "calendar-clock" },
    { key: "QUIMICOS", label: "Químicos", icon: "flask-outline" },
    { key: "LENTES_3D", label: "Lentes 3D", icon: "glasses" },
    { key: "PROXIMAMENTE", label: "Productos", icon: "package-variant-closed" },
  ],
} as const;

export default function Home() {
  const router = useRouter();
  const layout = useAppLayout();
  const { isMobile, isTablet, pagePadding, contentMaxWidth } = layout;

  const {
    user,
    loading: sessionLoading,
    isLoggedIn,
    isOficinas,
    isAdmin,
    displayName,
    cineId,
  } = useAuthUser();

  const [mainTab, setMainTab] = useState<MainTab>("PROGRAMACIÓN");
  const [proyeccionTab, setProyeccionTab] = useState<ProyeccionTab>("LAMPARAS");
  const [marketingTab, setMarketingTab] = useState<MarketingSubTab>("PROGRAMACION");
  const [coordinadoresTab, setCoordinadoresTab] = useState<CoordinadoresSubTab>("POZI");

  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem("sidebar_pinned_v2");
      return saved === null ? false : saved === "true";
    } catch {
      return false;
    }
  });
  const [isHovered, setIsHovered] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [profileVisible, setProfileVisible] = useState(false);

  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  const [proyeccionPin, setProyeccionPin] = useState<string | null>(null);
  const [isProjectionUnlocked, setIsProjectionUnlocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const toggleSidebarPin = () => {
    setIsSidebarPinned((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("sidebar_pinned_v2", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleConfirmUnlock = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (unlockPin.trim() === proyeccionPin) {
      setIsProjectionUnlocked(true);
      setShowUnlockModal(false);
    } else {
      setUnlockError("PIN de proyección incorrecto.");
    }
  };

  const toggleTheme = () => {
    const nextMode = themeMode === "light" ? "dark" : "light";
    setThemeMode(nextMode);
    applyTheme(nextMode);
    saveTheme(nextMode);
  };

  useEffect(() => {
    const saved = getSavedTheme();
    setThemeMode(saved);
    applyTheme(saved);
  }, []);

  const {
    isOnline: isServerOnline,
    isOffline: isServerOffline,
    isChecking: isCheckingServer,
    recheck: recheckServer,
  } = useServerStatus();

  const [ipCheckState, setIpCheckState] = useState<
    | { state: "idle" }
    | { state: "checking" }
    | { state: "authorized"; serverOffline?: boolean; skipped?: boolean }
    | { state: "not_authorized"; ip: string; cineLabel: string }
    | { state: "error"; message: string }
  >({ state: "idle" });

  const [ipGateLoading, setIpGateLoading] = useState(false);
  const [ipGateError, setIpGateError] = useState<string | null>(null);

  const logoutDirect = async () => {
    try {
      setShowLogoutConfirm(false);
      await signOut(auth);
    } catch (e) {
      console.error(e);
      setSessionError("No se pudo cerrar la sesión.");
    }
  };

  const visibleMainTabs = useMemo(() => {
    const tabs: MainTab[] = [];
    if (isOficinas) {
      tabs.push("PROGRAMACIÓN", "CALENDARIO", "EVENTOS");
    } else {
      tabs.push(
        "PROGRAMACIÓN",
        "CALENDARIO",
        "EVENTOS",
        "PROYECCIÓN",
        "SERVICIOS",
        "COORDINADORES"
      );
    }
    tabs.push("COMPAÑÍA", "FEEDBACK");
    return tabs;
  }, [isOficinas]);

  const ipCheckStartedRef = React.useRef(false);
  const cineLabelRaw = displayName || cineId || "Cine";
  const cineLabel = cineLabelRaw
    ? cineLabelRaw.charAt(0).toUpperCase() + cineLabelRaw.slice(1)
    : "Cine";

  useEffect(() => {
    if (!user) {
      ipCheckStartedRef.current = false;
      setIpCheckState({ state: "idle" });
      setIpGateError(null);
      setIpGateLoading(false);
      setProfileVisible(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!user || sessionLoading) return;
    if (ipCheckStartedRef.current) return;

    ipCheckStartedRef.current = true;

    if (isOficinas) {
      setIpCheckState({ state: "authorized" });
      return;
    }

    if (
      cineId === "parquebrown" ||
      (user?.email && user.email.toLowerCase().includes("parquebrown"))
    ) {
      setIpCheckState({ state: "authorized" });
      return;
    }

    const currentCineLabel = displayName || cineId || "Cine";

    async function run() {
      setIpCheckState({ state: "checking" });
      const res = await checkIpAccess();
      if (cancelled) return;

      if (res.state === "authorized") {
        setIpCheckState({
          state: "authorized",
          serverOffline: res.serverOffline,
          skipped: res.skipped,
        });
      } else if (res.state === "not_authorized") {
        setIpCheckState({
          state: "not_authorized",
          ip: res.ip,
          cineLabel: res.nombre || currentCineLabel,
        });
      } else if (res.state === "error") {
        const offline =
          isFallbackMode() ||
          isServerOffline ||
          !(await checkServerHealth().catch(() => false));
        if (offline) {
          setIpCheckState({
            state: "authorized",
            serverOffline: true,
            skipped: true,
          });
          return;
        }
        setIpCheckState({ state: "error", message: res.message });
      } else {
        setIpCheckState({
          state: "error",
          message: "No se pudo validar la IP.",
        });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user, sessionLoading, isOficinas, displayName, cineId, isServerOffline]);

  useEffect(() => {
    if (!cineId) {
      setProyeccionPin(null);
      setIsProjectionUnlocked(false);
      return;
    }

    const configRef = doc(db, CINES_COLLECTION, cineId, "info", "config");
    const unsubscribe = onSnapshot(
      configRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const pin = data?.proyeccionPin ? String(data.proyeccionPin).trim() : null;
          setProyeccionPin(pin);
        } else {
          setProyeccionPin(null);
        }
      },
      (error) => {
        console.error("Error listening to cine config:", error);
      }
    );

    return () => unsubscribe();
  }, [cineId]);

  const activeSubSectionLabel = useMemo(() => {
    if (mainTab === "PROYECCIÓN") {
      return SUB_TABS.PROYECCIÓN.find((s) => s.key === proyeccionTab)?.label;
    }
    if (mainTab === "SERVICIOS") {
      return SUB_TABS.SERVICIOS.find((s) => s.key === marketingTab)?.label;
    }
    if (mainTab === "COORDINADORES") {
      return SUB_TABS.COORDINADORES.find((s) => s.key === coordinadoresTab)?.label;
    }
    return undefined;
  }, [mainTab, proyeccionTab, marketingTab, coordinadoresTab]);

  function renderProjectionLockBanner() {
    const isOffline = isServerOffline || isFallbackMode();

    return (
      <div
        className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs shadow-sm transition-colors ${
          isOffline
            ? "border-rose-200 bg-rose-50/80 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"
            : isProjectionUnlocked
            ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
            : "border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
              isOffline
                ? "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300"
                : isProjectionUnlocked
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300"
                : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {isOffline ? (
              <ServerOff className="h-3.5 w-3.5" />
            ) : isProjectionUnlocked ? (
              <LockOpen className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
          </div>
          <span className="font-medium">
            {isOffline
              ? "Modo lectura activo (Servidor desconectado). Modificaciones deshabilitadas."
              : isProjectionUnlocked
              ? "Edición habilitada. Podés registrar y modificar datos técnicos."
              : "Modo lectura activo. Desbloqueá con el PIN de proyección para realizar cambios."}
          </span>
        </div>

        <button
          type="button"
          onClick={
            isOffline
              ? () => {
                  window.alert(
                    "El servidor principal está desconectado. La aplicación opera en modo de solo lectura desde el respaldo de Firebase."
                  );
                }
              : isProjectionUnlocked
              ? () => setIsProjectionUnlocked(false)
              : () => {
                  if (!proyeccionPin) {
                    window.alert(
                      "Por favor, configurá el 'PIN de Proyección' en Configuración (abajo a la izquierda) para habilitar la edición."
                    );
                    return;
                  }
                  setUnlockPin("");
                  setUnlockError(null);
                  setShowUnlockModal(true);
                }
          }
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
            isOffline
              ? "border border-rose-300 bg-white text-rose-700 dark:border-rose-800 dark:bg-zinc-900 dark:text-rose-300"
              : isProjectionUnlocked
              ? "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-300"
              : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          }`}
        >
          {isOffline ? (
            <span>Solo Lectura</span>
          ) : isProjectionUnlocked ? (
            <>
              <Lock className="h-3 w-3" />
              <span>Bloquear edición</span>
            </>
          ) : (
            <>
              <LockOpen className="h-3 w-3" />
              <span>Desbloquear edición</span>
            </>
          )}
        </button>
      </div>
    );
  }

  function renderServerOfflineBanner() {
    const isOffline = isServerOffline || isFallbackMode();
    if (!isOffline) return null;

    return (
      <div className="border-b border-rose-200/80 bg-rose-50/90 px-4 py-2.5 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200 lg:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ServerOff className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <span className="font-bold">
                Servidor desconectado — Modo lectura activo
              </span>
              <span className="mx-2 hidden text-rose-300 dark:text-rose-800 sm:inline">•</span>
              <span className="hidden opacity-85 sm:inline">
                Consultando copia de respaldo en Firebase. Las modificaciones se habilitarán al reconectar.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={recheckServer}
            disabled={isCheckingServer}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:bg-zinc-900 dark:text-rose-300"
          >
            <RefreshCw className={`h-3 w-3 ${isCheckingServer ? "animate-spin" : ""}`} />
            <span>Reintentar conexión</span>
          </button>
        </div>
      </div>
    );
  }

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-rose-600 dark:border-zinc-800 dark:border-t-rose-500" />
        <span className="mt-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
          Inicializando entorno operativo…
        </span>
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return <Redirect href="/login" />;
  }

  if (ipCheckState.state === "idle" || ipCheckState.state === "checking") {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-rose-600 dark:border-zinc-800 dark:border-t-rose-500" />
        <span className="mt-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
          Verificando autorización de red (IP)…
        </span>
      </div>
    );
  }

  if (ipCheckState.state === "error") {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 p-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-stripe dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
            {ipCheckState.message}
          </p>
          <button
            type="button"
            onClick={logoutDirect}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    );
  }

  if (ipCheckState.state === "not_authorized") {
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-zinc-950">
        <NavHeader title={cineLabel} />
        <IpAccessGate
          visible
          cineLabel={ipCheckState.cineLabel || cineLabel}
          ip={ipCheckState.ip}
          loading={ipGateLoading}
          error={ipGateError}
          onLogout={logoutDirect}
          onSubmit={async ({ pin, label }) => {
            setIpGateError(null);
            setIpGateLoading(true);
            const res = await authorizeCurrentIp({ pin, label });
            setIpGateLoading(false);

            if (!res.ok) {
              setIpGateError(res.message);
              return;
            }
            setIpCheckState({ state: "authorized" });
          }}
        />
      </div>
    );
  }

  function renderSidebarContent(isDrawer = false) {
    const isExpanded = isSidebarPinned || isHovered || isDrawer;
    const roleLabel = isAdmin ? "ADMIN" : isOficinas ? "OFICINAS" : "CINE";

    return (
      <div className="flex h-full flex-col justify-between py-3">
        {/* Top Workspace Header */}
        <div className="px-2.5">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <SidebarUserLogo
                cineLabel={cineLabel}
                isExpanded={isExpanded}
                isServerOnline={isServerOnline}
                roleLabel={roleLabel}
                onPress={() => {
                  setProfileVisible(true);
                  if (isDrawer) setIsDrawerOpen(false);
                }}
              />
            </div>

            {!isDrawer && isExpanded && (
              <button
                type="button"
                onClick={toggleSidebarPin}
                title={
                  isSidebarPinned
                    ? "Contraer barra lateral automáticamente"
                    : "Fijar barra lateral abierta"
                }
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                {isSidebarPinned ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          <div className="my-2.5 h-px bg-slate-200/80 dark:bg-zinc-800/80" />
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2.5">
          {visibleMainTabs.map((tab, idx) => {
            const meta = MAIN_TAB_META[tab];
            const prevMeta = idx > 0 ? MAIN_TAB_META[visibleMainTabs[idx - 1]] : null;
            const showGroupHeader = isExpanded && (!prevMeta || prevMeta.group !== meta.group);
            const isActive = mainTab === tab;
            const hasSubmenu = tab in SUB_TABS;

            return (
              <div key={tab}>
                {showGroupHeader && (
                  <div className="mb-1 mt-3 px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 first:mt-0 dark:text-zinc-500">
                    {meta.group}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMainTab(tab);
                    if (tab === "PROYECCIÓN" && !proyeccionTab) setProyeccionTab("LAMPARAS");
                    if (tab === "SERVICIOS" && !marketingTab) setMarketingTab("PROGRAMACION");
                    if (tab === "COORDINADORES" && !coordinadoresTab) setCoordinadoresTab("POZI");

                    if (isDrawer && !hasSubmenu) {
                      setIsDrawerOpen(false);
                    }
                  }}
                  title={!isExpanded ? meta.label : undefined}
                  className={`group relative flex h-9 w-full items-center rounded-lg px-2.5 text-left text-[13px] font-medium transition-colors ${
                    !isExpanded ? "justify-center px-0" : "justify-between"
                  } ${
                    isActive
                      ? "bg-rose-50/90 font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-rose-600 dark:bg-rose-500" />
                  )}

                  <div className="flex min-w-0 items-center gap-2.5">
                    <MaterialCommunityIcons
                      name={meta.icon}
                      size={18}
                      color={
                        isActive
                          ? themeMode === "dark"
                            ? "#FB7185"
                            : "#BE123C"
                          : themeMode === "dark"
                          ? "#A1A1AA"
                          : "#64748B"
                      }
                    />
                    {isExpanded && <span className="truncate">{meta.label}</span>}
                  </div>

                  {isExpanded && hasSubmenu && (
                    <span className="text-slate-400 dark:text-zinc-500">
                      {isActive ? (
                        <ChevronDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </span>
                  )}
                </button>

                {/* Notion/Stripe-style Tree Submenu */}
                {isActive && isExpanded && hasSubmenu && (
                  <div className="mb-1.5 ml-4 mt-1 space-y-0.5 border-l border-slate-200/90 pl-2.5 dark:border-zinc-800">
                    {SUB_TABS[tab as keyof typeof SUB_TABS].map((subItem) => {
                      let isSubActive = false;
                      let onSubPress = () => {};

                      if (tab === "PROYECCIÓN") {
                        isSubActive = proyeccionTab === subItem.key;
                        onSubPress = () => {
                          setProyeccionTab(subItem.key as ProyeccionTab);
                          if (isDrawer) setIsDrawerOpen(false);
                        };
                      } else if (tab === "SERVICIOS") {
                        isSubActive = marketingTab === subItem.key;
                        onSubPress = () => {
                          setMarketingTab(subItem.key as MarketingSubTab);
                          if (isDrawer) setIsDrawerOpen(false);
                        };
                      } else if (tab === "COORDINADORES") {
                        isSubActive = coordinadoresTab === subItem.key;
                        onSubPress = () => {
                          setCoordinadoresTab(subItem.key as CoordinadoresSubTab);
                          if (isDrawer) setIsDrawerOpen(false);
                        };
                      }

                      return (
                        <button
                          key={subItem.key}
                          type="button"
                          onClick={onSubPress}
                          className={`flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs transition-colors ${
                            isSubActive
                              ? "bg-slate-900 font-semibold text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                              : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                          }`}
                        >
                          <MaterialCommunityIcons
                            name={subItem.icon}
                            size={14}
                            color={
                              isSubActive
                                ? themeMode === "dark"
                                  ? "#18181B"
                                  : "#FFFFFF"
                                : themeMode === "dark"
                                ? "#A1A1AA"
                                : "#64748B"
                            }
                          />
                          <span className="truncate">{subItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="px-2.5">
          <div className="my-2.5 h-px bg-slate-200/80 dark:bg-zinc-800/80" />

          <div className="space-y-0.5">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (isDrawer) setIsDrawerOpen(false);
                  router.push("/admin-cines");
                }}
                title={!isExpanded ? "Administración Cines" : undefined}
                className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 ${
                  !isExpanded ? "justify-center px-0" : ""
                }`}
              >
                <Shield className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                {isExpanded && <span className="truncate">Admin Cines</span>}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setProfileVisible(true);
                if (isDrawer) setIsDrawerOpen(false);
              }}
              title={!isExpanded ? "Configuración" : undefined}
              className={`flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 ${
                !isExpanded ? "justify-center px-0" : ""
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className="h-4 w-4 shrink-0" />
                {isExpanded && <span className="truncate">Configuración</span>}
              </div>
              {isExpanded && (
                <span
                  className={`h-2 w-2 rounded-full ${
                    isServerOnline ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowLogoutConfirm(true);
                if (isDrawer) setIsDrawerOpen(false);
              }}
              title={!isExpanded ? "Cerrar sesión" : undefined}
              className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 ${
                !isExpanded ? "justify-center px-0" : ""
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {isExpanded && <span className="truncate">Cerrar sesión</span>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderSubTabPillsBar() {
    if (!(mainTab in SUB_TABS)) return null;
    // Show horizontal quick sub-tabs bar on mobile/tablet or when sidebar is collapsed
    if (!isMobile && isSidebarPinned) return null;

    const items = SUB_TABS[mainTab as keyof typeof SUB_TABS];
    return (
      <div className="mb-4 overflow-x-auto pb-1">
        <div className="mx-auto flex w-max items-center gap-1.5">
        {items.map((subItem) => {
          let isSubActive = false;
          let onSubPress = () => {};

          if (mainTab === "PROYECCIÓN") {
            isSubActive = proyeccionTab === subItem.key;
            onSubPress = () => setProyeccionTab(subItem.key as ProyeccionTab);
          } else if (mainTab === "SERVICIOS") {
            isSubActive = marketingTab === subItem.key;
            onSubPress = () => setMarketingTab(subItem.key as MarketingSubTab);
          } else if (mainTab === "COORDINADORES") {
            isSubActive = coordinadoresTab === subItem.key;
            onSubPress = () => setCoordinadoresTab(subItem.key as CoordinadoresSubTab);
          }

          return (
            <button
              key={subItem.key}
              type="button"
              onClick={onSubPress}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isSubActive
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              <MaterialCommunityIcons
                name={subItem.icon}
                size={14}
                color={
                  isSubActive
                    ? themeMode === "dark"
                      ? "#18181B"
                      : "#FFFFFF"
                    : themeMode === "dark"
                    ? "#A1A1AA"
                    : "#64748B"
                }
              />
              <span>{subItem.label}</span>
            </button>
          );
        })}
        </div>
      </div>
    );
  }

  function renderContent() {
    if (mainTab === "PROGRAMACIÓN") {
      return (
        <View style={{ flex: 1, minHeight: 0 }}>
          <ProgramacionProyeccionScreen readOnly={!isProjectionUnlocked} />
        </View>
      );
    }

    if (mainTab === "CALENDARIO") {
      return isOficinas ? (
        <OficinasCalendarioScreen />
      ) : (
        <View style={{ flex: 1, minHeight: 0 }}>
          {renderProjectionLockBanner()}
          <View style={{ flex: 1, minHeight: 0 }}>
            <CalendarTab readOnly={!isProjectionUnlocked} />
          </View>
        </View>
      );
    }

    if (mainTab === "EVENTOS") {
      return isOficinas ? <OficinasEventosScreen /> : <EventosScreen />;
    }

    if (mainTab === "PROYECCIÓN") {
      return (
        <View style={{ flex: 1, minHeight: 0 }}>
          {renderSubTabPillsBar()}
          {renderProjectionLockBanner()}
          <View style={{ flex: 1, minHeight: 0 }}>
            {proyeccionTab === "DCP" && <DcpTab readOnly={!isProjectionUnlocked} />}
            {proyeccionTab === "CREDITOS" && <CreditosScreen readOnly={!isProjectionUnlocked} />}
            {proyeccionTab === "RMA" && <RmaTab readOnly={!isProjectionUnlocked} />}
            {proyeccionTab === "MANTENIMIENTOS" && (
              <MantenimientosScreen readOnly={!isProjectionUnlocked} />
            )}
            {proyeccionTab === "TRAILERS_SEMANALES" && (
              <TrailersSemanalesScreen readOnly={!isProjectionUnlocked} />
            )}
            {proyeccionTab === "CHEQUEO_COPIAS" && (
              <ChequeoCopiasScreen readOnly={!isProjectionUnlocked} />
            )}
            {proyeccionTab === "CONTROL_SEMANAL" && (
              <ControlSemanalScreen readOnly={!isProjectionUnlocked} />
            )}
            {proyeccionTab === "LAMPARAS" && (
              <LamparasScreen readOnly={!isProjectionUnlocked} />
            )}
            {proyeccionTab === "CIERRE_MES" && (
              <CierreMesScreen readOnly={!isProjectionUnlocked} />
            )}
            {proyeccionTab === "CONTROL_PARLANTES" && (
              <ControlParlantesScreen readOnly={!isProjectionUnlocked} />
            )}
          </View>
        </View>
      );
    }

    if (mainTab === "SERVICIOS") {
      return (
        <View style={{ flex: 1, minHeight: 0 }}>
          {renderSubTabPillsBar()}
          <View style={{ flex: 1, minHeight: 0 }}>
            {marketingTab === "MKT" && <MarketingTab />}
            {marketingTab === "PROGRAMACION" && <ProgramacionTab />}
            {marketingTab === "CONTROL_SALAS" && <ControlSalasScreen />}
            {marketingTab === "MAPA_BANNERS" && <MapaBannersScreen />}
            {marketingTab === "STOCK_MATERIALES" && <StockMaterialesScreen />}
            {marketingTab === "CUSTOM_POSTERS" && <CustomPostersScreen />}
          </View>
        </View>
      );
    }

    if (mainTab === "COORDINADORES") {
      return (
        <View style={{ flex: 1, minHeight: 0 }}>
          {renderSubTabPillsBar()}
          <View style={{ flex: 1, minHeight: 0 }}>
            {coordinadoresTab === "POZI" && <CoordinadoresPoziScreen />}
            {coordinadoresTab === "PROGRAMACION" && <CoordinadoresProgramacionScreen />}
            {coordinadoresTab === "QUIMICOS" && <CoordinadoresQuimicosScreen />}
            {coordinadoresTab === "LENTES_3D" && <CoordinadoresLentesScreen />}
            {coordinadoresTab === "PROXIMAMENTE" && <CoordinadoresProximamenteScreen />}
          </View>
        </View>
      );
    }

    if (mainTab === "COMPAÑÍA") {
      return (
        <View style={{ flex: 1, minHeight: 0 }}>
          <CompanyScreen />
        </View>
      );
    }

    if (mainTab === "FEEDBACK") {
      return (
        <View style={{ flex: 1, minHeight: 0 }}>
          <FeedbackScreen />
        </View>
      );
    }

    return null;
  }

  const sidebarExpanded = isSidebarPinned || isHovered;

  return (
    <>
      <SEOHead
        title={`${cineLabel} — ${MAIN_TAB_META[mainTab].label} | Cinemark Workspace`}
        description="Panel corporativo de control y gestión de proyección cinematográfica. Programación semanal, control de salas, eventos, trailers y copias DCP."
        pathname="/"
      />
      <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
        {/* Desktop Sidebar (Hidden/Compact Rail by default, expands on hover or pin) */}
        {!isMobile && (
          <div
            className="relative z-40 h-full shrink-0"
            style={{ width: isSidebarPinned ? 232 : 54 }}
          >
            <aside
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              style={{
                width: sidebarExpanded ? 232 : 54,
                transition: "width 220ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow 220ms cubic-bezier(0.23, 1, 0.32, 1)",
              }}
              className={`absolute inset-y-0 left-0 h-full border-r border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/95 ${
                !isSidebarPinned && isHovered
                  ? "shadow-2xl shadow-slate-900/15 dark:shadow-black/60"
                  : ""
              }`}
            >
              {renderSidebarContent(false)}
            </aside>
          </div>
        )}

        {/* Mobile Drawer Backdrop & Panel */}
        {isMobile && isDrawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px]"
            onClick={() => setIsDrawerOpen(false)}
          />
        )}

        {isMobile && (
          <aside
            style={{
              transform: isDrawerOpen ? "translateX(0)" : "translateX(-100%)",
            }}
            className="fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white shadow-stripe-lg transition-transform duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-950"
          >
            {renderSidebarContent(true)}
          </aside>
        )}

        {/* Main Workspace Content Column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-zinc-950">
          <NavHeader
            title={cineLabel}
            sectionLabel={MAIN_TAB_META[mainTab].label}
            subSectionLabel={activeSubSectionLabel}
            onPressSettings={() => setProfileVisible(true)}
            onPressMenu={isMobile ? () => setIsDrawerOpen(true) : undefined}
            themeMode={themeMode}
            onToggleTheme={toggleTheme}
          />

          {renderServerOfflineBanner()}

          <div className="flex flex-1 flex-col items-center overflow-y-auto overflow-x-hidden">
            <div
              style={{
                maxWidth: mainTab === "PROGRAMACIÓN" ? "98.5%" : contentMaxWidth,
                paddingLeft:
                  mainTab === "PROGRAMACIÓN"
                    ? isMobile
                      ? 10
                      : 16
                    : isMobile
                    ? 12
                    : isTablet
                    ? 16
                    : pagePadding,
                paddingRight:
                  mainTab === "PROGRAMACIÓN"
                    ? isMobile
                      ? 10
                      : 16
                    : isMobile
                    ? 12
                    : isTablet
                    ? 16
                    : pagePadding,
                paddingTop: mainTab === "PROGRAMACIÓN" ? 4 : isMobile ? 12 : 18,
                paddingBottom: mainTab === "PROGRAMACIÓN" ? 16 : (isMobile ? 16 : pagePadding) + 8,
              }}
              className="flex min-h-0 w-full flex-1 flex-col"
            >
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Complex Profile & Settings Modal */}
      <CineProfileModal
        visible={profileVisible}
        cineId={cineId}
        fallbackTitle={cineLabel}
        onClose={() => setProfileVisible(false)}
      />

      {/* Unlock Projection PIN Modal */}
      {showUnlockModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onClick={() => setShowUnlockModal(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-stripe-lg dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                  <LockOpen className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    Desbloquear Edición
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Ingresá el PIN técnico de proyección
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmUnlock} className="space-y-4">
              <input
                type="password"
                autoFocus
                value={unlockPin}
                onChange={(e) => {
                  setUnlockPin(e.target.value);
                  if (unlockError) setUnlockError(null);
                }}
                placeholder="••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center font-mono text-lg tracking-widest text-slate-900 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />

              {unlockError && (
                <p className="text-center text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {unlockError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
                >
                  Habilitar edición
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-stripe-lg dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Cerrar sesión
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
              ¿Estás seguro de que querés salir del panel operativo de {cineLabel}?
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={logoutDirect}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
              >
                Salir de la cuenta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Error Modal */}
      {sessionError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onClick={() => setSessionError(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-stripe-lg dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Aviso
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-zinc-300">
              {sessionError}
            </p>
            <button
              type="button"
              onClick={() => setSessionError(null)}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
