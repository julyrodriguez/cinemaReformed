import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Menu,
  Moon,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { applyTheme, getSavedTheme, saveTheme } from "@/lib/theme";

export type NewsItem = {
  id: string;
  tag: string;
  badgeColor: string;
  badgeBg: string;
  icon: string;
  title: string;
  message: string;
  detail?: string;
  ticker: string;
  date?: string;
};

const DEFAULT_NEWS: NewsItem[] = [
  {
    id: "control-mensual-parlantes",
    tag: "SONIDO 5.1",
    badgeColor: "#34D399",
    badgeBg: "rgba(52, 211, 153, 0.14)",
    icon: "speaker",
    title: "Proyección: Nueva Sección de Control Mensual de Parlantes (5.1)",
    message:
      "Proyección: Nueva planilla y plano acústico interactivo 5.1 por sala para el control mensual de parlantes y reportes HTML/PDF.",
    detail:
      "Se incorporó en Proyección la sección 'Control Mensual Parlantes' con plano interactivo 5.1 (SW1-SW4, L/C/R, LS1-LS7 y RS1-RS7), seguimiento de fallas mes a mes al estilo Cierre de Mes y generación de reporte corporativo en HTML y PDF.",
    ticker: "AUDIO:5.1 ▲",
    date: "Nuevo",
  },
  {
    id: "interfaz-renovada",
    tag: "NUEVA UI",
    badgeColor: "#FB7185",
    badgeBg: "rgba(244, 63, 94, 0.14)",
    icon: "sparkles",
    title: "Cinemark Renovado: Nueva Interfaz Corporativa",
    message:
      "Diseño minimalista renovado con mayor legibilidad, controles centrados y modo claro/oscuro de alto contraste.",
    detail:
      "Rediseñamos por completo la experiencia visual del panel operativo siguiendo estándares corporativos minimalistas, manteniendo intacta toda la lógica de proyección, programación, sincronización con servidor Docker y respaldo en Firebase.",
    ticker: "UI:V2.0 ▲",
    date: "Nuevo",
  },
  {
    id: "control-salas-promedio",
    tag: "SALAS",
    badgeColor: "#FBBF24",
    badgeBg: "rgba(245, 158, 11, 0.14)",
    icon: "chart-donut",
    title: "Control de Salas: Porcentaje Promedio General de Daños",
    message:
      "Control de Salas: Ahora en el encabezado del reporte figura el porcentaje promedio general de butacas rotas.",
    detail:
      "Tanto en la vista principal como en el encabezado y resumen del reporte PDF de Control de Salas, se muestra de forma destacada el porcentaje promedio general de daños sobre la capacidad total del complejo, junto con el desglose sala por sala.",
    ticker: "SALAS:PROM ▲",
    date: "Reciente",
  },
  {
    id: "eventos-editar-titulo",
    tag: "EVENTOS",
    badgeColor: "#A78BFA",
    badgeBg: "rgba(167, 139, 250, 0.14)",
    icon: "pencil-outline",
    title: "Eventos: Edición Directa del Nombre y Título",
    message:
      "Eventos: Al editar un evento ahora podés modificar directamente su nombre o título además de sala y duración.",
    detail:
      "En el formulario de edición de Eventos se incorporó la posibilidad de renombrar o corregir el título/película del evento sin necesidad de eliminarlo y volver a cargarlo.",
    ticker: "EVT:EDIT ▲",
    date: "Reciente",
  },
  {
    id: "dcp-sub-cas",
    tag: "DCP",
    badgeColor: "#34D399",
    badgeBg: "rgba(52, 211, 153, 0.14)",
    icon: "filmstrip",
    title: "DCP: Identificación SUB / CAS en Historial",
    message:
      "DCP: En el historial de copias retiradas ahora se visualiza si correspondía a versión subtitulada (SUB) o castellano (CAS).",
    detail:
      "En el historial de copias DCP retiradas ahora se visualiza claramente el badge de idioma correspondiente para una trazabilidad precisa.",
    ticker: "DCP:VERS ▲",
    date: "Nuevo",
  },
  {
    id: "programacion-toolbar",
    tag: "PROGRAMACIÓN",
    badgeColor: "#38BDF8",
    badgeBg: "rgba(56, 189, 248, 0.14)",
    icon: "calendar-clock",
    title: "Programación: Controles Superiores y Selector de Semanas",
    message:
      "Programación: Controles de ajuste y modo arriba; cambiador de semana alineado a la derecha sin alterar el centrado.",
    detail:
      "Se reubicó la barra de controles de ajuste de horario, alternador de vista y sincronización en la parte superior, alineando el cambiador de semana a la derecha de los días de forma independiente.",
    ticker: "PROG:SYNC ▲",
    date: "Nuevo",
  },
];

type Props = {
  title?: string;
  subtitle?: string;
  sectionLabel?: string;
  subSectionLabel?: string;
  onPressSettings?: () => void;
  onPressMenu?: () => void;
  themeMode?: "light" | "dark";
  onToggleTheme?: () => void;
  newsItems?: NewsItem[];
};

export default function NavHeader({
  title,
  subtitle,
  sectionLabel,
  subSectionLabel,
  onPressSettings: _onPressSettings,
  onPressMenu,
  themeMode: themeModeProp,
  onToggleTheme,
  newsItems,
}: Props) {
  const [internalTheme, setInternalTheme] = useState<"light" | "dark">("light");
  const [modalVisible, setModalVisible] = useState(false);
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  useEffect(() => {
    setInternalTheme(getSavedTheme());
  }, []);

  const activeTheme = themeModeProp ?? internalTheme;
  const isDark = activeTheme === "dark";

  const handleToggleTheme = useCallback(() => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      const next = activeTheme === "light" ? "dark" : "light";
      setInternalTheme(next);
      applyTheme(next);
      saveTheme(next);
    }
  }, [onToggleTheme, activeTheme]);

  // Listener para ocultar la barra de novedades apenas se scrollea hacia abajo
  // y volver a mostrarla cuando se vuelve todo hacia arriba
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target;
      let st = 0;
      if (
        target === document ||
        target === document.documentElement ||
        target === document.body
      ) {
        st =
          window.scrollY ||
          document.documentElement.scrollTop ||
          document.body.scrollTop ||
          0;
      } else if (target && typeof (target as any).scrollTop === "number") {
        st = (target as HTMLElement).scrollTop;
      }

      // Apenas scrollea hacia abajo (> 10px) se oculta; si vuelve todo arriba (<= 5px) aparece
      if (st > 10) {
        setIsScrolledDown(true);
      } else if (st <= 5) {
        setIsScrolledDown(false);
      }
    };

    window.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, []);

  // Al cambiar de sección, restablecer la barra de novedades como visible
  useEffect(() => {
    setIsScrolledDown(false);
  }, [sectionLabel, subSectionLabel]);

  const news = newsItems && newsItems.length > 0 ? newsItems : DEFAULT_NEWS;
  const tickerItems = useMemo(() => [...news, ...news, ...news], [news]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md transition-colors dark:border-zinc-800/80 dark:bg-zinc-950/95 lg:px-6">
        {/* Left: Mobile Menu + Breadcrumbs (Ruta de donde estamos parados) */}
        <div className="flex min-w-0 items-center gap-3">
          {onPressMenu && (
            <button
              type="button"
              onClick={onPressMenu}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden cursor-pointer"
              aria-label="Abrir menú"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {title || "Cinemark"}
            </span>

            {(sectionLabel || subtitle) && (
              <>
                <span className="text-slate-300 dark:text-zinc-700">/</span>
                <span className="truncate text-xs font-semibold text-slate-600 dark:text-zinc-400">
                  {sectionLabel || subtitle}
                </span>
              </>
            )}

            {subSectionLabel && (
              <>
                <span className="hidden text-slate-300 dark:text-zinc-700 sm:inline">/</span>
                <span className="hidden truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-zinc-800/90 dark:text-zinc-200 sm:inline">
                  {subSectionLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right Actions: Dark Mode Toggle */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleToggleTheme}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
            title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            aria-label="Cambiar tema"
          >
            {isDark ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Claro</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-slate-600" />
                <span className="hidden sm:inline">Oscuro</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Wall Street Stock Market Style Ticker Tape (se oculta al scrollear hacia abajo y reaparece arriba del todo) */}
      <div
        className={`sticky top-14 z-20 w-full shrink-0 overflow-hidden select-none transition-all duration-300 ease-in-out ${
          isScrolledDown
            ? "max-h-0 h-0 opacity-0 border-b-0 pointer-events-none"
            : "max-h-7 h-7 opacity-100 border-b border-slate-800/90 dark:border-zinc-800/90 bg-slate-950 dark:bg-black text-slate-100"
        }`}
      >
        <div className="flex h-7 w-full items-center overflow-hidden">
          {/* Left Fixed Badge: NOVEDADES */}
          <button
            type="button"
            onClick={() => setModalVisible(true)}
            className="z-20 flex h-full shrink-0 items-center gap-1.5 border-r border-slate-800 dark:border-zinc-800 bg-slate-950 dark:bg-black px-2.5 text-[10px] font-black tracking-wider text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
            title="Ver registro completo de novedades"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="font-mono text-[10px] font-black tracking-wider text-emerald-400">
              NOVEDADES
            </span>
          </button>

          {/* Infinite Scrolling Ticker Track */}
          <div className="relative flex-1 overflow-hidden h-full flex items-center">
            {/* Gradient fade on left inside the track */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-r from-slate-950 dark:from-black to-transparent" />

            <div className="animate-ticker">
              {/* Copy A */}
              <div className="flex items-center shrink-0">
                {tickerItems.map((item, idx) => (
                  <button
                    key={`ticker-a-${item.id}-${idx}`}
                    type="button"
                    onClick={() => setModalVisible(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-0.5 text-left transition-colors hover:bg-white/10 dark:hover:bg-white/5 cursor-pointer"
                    title="Clic para ver detalle"
                  >
                    <span
                      className="inline-flex items-center gap-0.5 font-mono text-[10px] font-black tracking-tight"
                      style={{ color: item.badgeColor }}
                    >
                      <span>▲</span>
                      <span>{item.ticker.replace(" ▲", "")}</span>
                    </span>

                    <span className="font-bold text-[11px] text-white dark:text-zinc-200 tracking-tight">
                      {item.tag}:
                    </span>

                    <span className="text-[11px] text-slate-300 dark:text-zinc-400 font-normal">
                      {item.message}
                    </span>

                    <span className="text-slate-600 dark:text-zinc-700 text-xs mx-1.5 select-none">
                      ✦
                    </span>
                  </button>
                ))}
              </div>

              {/* Copy B (identical copy for continuous, seamless infinite loop) */}
              <div className="flex items-center shrink-0" aria-hidden="true">
                {tickerItems.map((item, idx) => (
                  <button
                    key={`ticker-b-${item.id}-${idx}`}
                    type="button"
                    onClick={() => setModalVisible(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-0.5 text-left transition-colors hover:bg-white/10 dark:hover:bg-white/5 cursor-pointer"
                    tabIndex={-1}
                  >
                    <span
                      className="inline-flex items-center gap-0.5 font-mono text-[10px] font-black tracking-tight"
                      style={{ color: item.badgeColor }}
                    >
                      <span>▲</span>
                      <span>{item.ticker.replace(" ▲", "")}</span>
                    </span>

                    <span className="font-bold text-[11px] text-white dark:text-zinc-200 tracking-tight">
                      {item.tag}:
                    </span>

                    <span className="text-[11px] text-slate-300 dark:text-zinc-400 font-normal">
                      {item.message}
                    </span>

                    <span className="text-slate-600 dark:text-zinc-700 text-xs mx-1.5 select-none">
                      ✦
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Gradient fade on right edge inside track */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-slate-950 dark:from-black to-transparent" />
          </div>
        </div>
      </div>

      {/* Modal de Novedades y Actualizaciones */}
      {modalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
          onClick={() => setModalVisible(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-stripe-lg dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    Novedades y Actualizaciones
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Registro de mejoras del sistema operativo de proyección
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalVisible(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {news.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:bg-zinc-950"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      style={{
                        color: item.badgeColor,
                        backgroundColor: item.badgeBg,
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    >
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={12}
                        color={item.badgeColor}
                      />
                      {item.tag}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-200/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {item.ticker}
                      </span>
                      {item.date && (
                        <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                          {item.date}
                        </span>
                      )}
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                    {item.detail || item.message}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <button
                type="button"
                onClick={() => setModalVisible(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
