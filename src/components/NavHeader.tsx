import React, { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  Moon,
  Sparkles,
  Sun,
  X,
  SlidersHorizontal,
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
    id: "interfaz-renovada",
    tag: "NUEVA UI",
    badgeColor: "#BE123C",
    badgeBg: "rgba(190, 18, 60, 0.1)",
    icon: "sparkles",
    title: "Cinemark Renovado: Nueva Interfaz Corporativa",
    message:
      "Diseño minimalista renovado con mayor legibilidad, barra lateral optimizada y modo claro/oscuro de alto contraste.",
    detail:
      "Rediseñamos por completo la experiencia visual del panel operativo siguiendo estándares corporativos minimalistas (estilo Stripe/Notion), manteniendo intacta toda la lógica de proyección, programación, sincronización con servidor Docker y respaldo en Firebase.",
    ticker: "UI:V2.0 ▲",
    date: "Nuevo",
  },
  {
    id: "control-salas-promedio",
    tag: "SALAS",
    badgeColor: "#D97706",
    badgeBg: "rgba(217, 119, 6, 0.12)",
    icon: "chart-donut",
    title: "Control de Salas: Porcentaje Promedio General de Daños",
    message:
      "Control de Salas: Ahora en el encabezado del reporte figura el porcentaje promedio general de butacas rotas del complejo.",
    detail:
      "Tanto en la vista principal como en el encabezado y resumen del reporte PDF de Control de Salas, se muestra de forma destacada el porcentaje promedio general de daños sobre la capacidad total del complejo, junto con el desglose sala por sala.",
    ticker: "SALAS:PROM ▲",
    date: "Reciente",
  },
  {
    id: "eventos-editar-titulo",
    tag: "EVENTOS",
    badgeColor: "#6D28D9",
    badgeBg: "rgba(109, 40, 217, 0.12)",
    icon: "pencil-outline",
    title: "Eventos: Edición Directa del Nombre y Título",
    message:
      "Eventos: Al editar un evento ahora podés modificar directamente su nombre o título además de la sala y duración.",
    detail:
      "En el formulario de edición de Eventos se incorporó la posibilidad de renombrar o corregir el título/película del evento sin necesidad de eliminarlo y volver a cargarlo.",
    ticker: "EVT:EDIT ▲",
    date: "Reciente",
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
  onPressSettings,
  onPressMenu,
  themeMode: themeModeProp,
  onToggleTheme,
  newsItems,
}: Props) {
  const [internalTheme, setInternalTheme] = useState<"light" | "dark">("light");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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

  const news = newsItems && newsItems.length > 0 ? newsItems : DEFAULT_NEWS;
  const currentNews = news[currentIndex] || news[0];

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % news.length);
  }, [news.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + news.length) % news.length);
  }, [news.length]);

  useEffect(() => {
    if (isHovered || news.length <= 1) return;
    const timer = setInterval(() => {
      handleNext();
    }, 6500);
    return () => clearInterval(timer);
  }, [isHovered, news.length, handleNext]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md transition-colors dark:border-zinc-800/80 dark:bg-zinc-950/90 lg:px-6">
        {/* Left: Mobile Menu + Breadcrumbs */}
        <div className="flex min-w-0 items-center gap-3">
          {onPressMenu && (
            <button
              type="button"
              onClick={onPressMenu}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
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

        {/* Center: Minimalist Stripe/Notion Announcement Pill (Desktop) */}
        <div className="mx-4 hidden max-w-2xl flex-1 items-center justify-center md:flex">
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => setModalVisible(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setModalVisible(true);
            }}
            className="group flex h-9 w-full items-center gap-2.5 rounded-full border border-slate-200/90 bg-slate-50/80 px-3 text-xs shadow-sm transition-all hover:border-slate-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {/* Tag pill */}
            <span
              style={{
                color: currentNews.badgeColor,
                backgroundColor: currentNews.badgeBg,
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            >
              <span
                style={{ backgroundColor: currentNews.badgeColor }}
                className="h-1.5 w-1.5 rounded-full"
              />
              {currentNews.tag}
            </span>

            {/* Message */}
            <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-zinc-300">
              {currentNews.message}
            </span>

            {/* Ticker Code */}
            <span className="hidden shrink-0 rounded bg-slate-200/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 lg:inline-block">
              {currentNews.ticker}
            </span>

            {/* Prev / Next Controls */}
            <div
              className="flex shrink-0 items-center gap-0.5 border-l border-slate-200 pl-2 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handlePrev}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Anterior novedad"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-1 font-mono text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                {currentIndex + 1}/{news.length}
              </span>
              <button
                type="button"
                onClick={handleNext}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Siguiente novedad"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Actions: Changelog button (mobile), Theme Toggle, Settings */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setModalVisible(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 md:hidden"
            title="Ver novedades"
          >
            <Sparkles className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            <span>Novedades</span>
          </button>

          {onPressSettings && (
            <button
              type="button"
              onClick={onPressSettings}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Ajustes del complejo"
              aria-label="Ajustes del complejo"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleTheme}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
