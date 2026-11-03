import * as DocumentPicker from "expo-document-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  doc,
  getDoc,
} from "@/lib/dbService";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import {
  Megaphone,
  FileSpreadsheet,
  PlugZap,
  ChevronLeft,
  ChevronRight,
  Printer,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Film,
  ArrowRightLeft,
  LogOut,
  Calendar,
  CheckCircle2,
  Building2,
} from "lucide-react";
import dayjs from "dayjs";

import { getCineConfig } from "../../lib/cineConfig";
import { CINES_COLLECTION, db } from "../../lib/firebaseConfig";
import { compareMarketingWeeks } from "../../lib/marketing/compare";
import { parseMarketingExcelFromArrayBuffer } from "../../lib/marketing/excel";
import { buildMarketingPrintHtml } from "../../lib/marketing/print";
import {
  EventoForPrint,
  MarketingCompareResult,
  MarketingParsedRow,
} from "../../lib/marketing/types";
import { useAuthUser } from "../../lib/useAuthUser";
import { DIAS_SEMANA_SHORT, MESES_ABBR, toDate } from "@/shared/utils";

function getMovieWeekStartForNow(): string {
  const localDate = new Date(Date.now() - 3 * 60 * 60 * 1000);
  if (localDate.getUTCHours() < 6) {
    localDate.setTime(localDate.getTime() - 24 * 60 * 60 * 1000);
  }
  const dayNum = localDate.getUTCDay();
  const daysToSubtract = dayNum <= 3 ? dayNum + 3 : dayNum - 4;
  const thurDate = new Date(
    localDate.getTime() - daysToSubtract * 24 * 60 * 60 * 1000
  );
  const yyyy = thurDate.getUTCFullYear();
  const mm = String(thurDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(thurDate.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatWeekRange(weekStart: string): string {
  if (!weekStart) return "";
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const startD = start.getUTCDate();
  const startM = start.getUTCMonth() + 1;
  const endD = end.getUTCDate();
  const endM = end.getUTCMonth() + 1;
  return `Semana del ${startD}/${startM} al ${endD}/${endM}`;
}

const mapShowtimesToMarketingRows = (
  sessions: any[],
  weekStart: string
): MarketingParsedRow[] => {
  const rows: MarketingParsedRow[] = [];
  sessions.forEach((session: any) => {
    const sala = Number(session.theaterRoom);
    if (isNaN(sala)) return;

    const formatStr = (session.sessionFormat || "").toUpperCase().includes("3D")
      ? "3D"
      : "2D";
    const langName = (
      session.language?.name ||
      session.language ||
      ""
    ).toUpperCase();
    let langStr = "CAS";
    if (
      langName.includes("SUB") ||
      langName.includes("ING") ||
      langName.includes("ORIG")
    ) {
      langStr = "SUB";
    }
    const movieTitle = `${session.movieName} ${formatStr} ${langStr}`.toUpperCase();

    const displayDate =
      session.sessionDisplayDate ||
      (session.sessionDateTime ? session.sessionDateTime.substring(0, 10) : "");
    const isJueves = displayDate === weekStart;
    const hora =
      isJueves && session.sessionDateTime
        ? session.sessionDateTime.substring(11, 16)
        : null;

    rows.push({
      sala,
      pelicula: movieTitle,
      hora,
    });
  });
  return rows;
};

type LoadedSheet = {
  name: string;
  rows: MarketingParsedRow[];
};

export default function MarketingTab() {
  const { cineId } = useAuthUser();

  const [prevSheet, setPrevSheet] = useState<LoadedSheet | null>(null);
  const [currSheet, setCurrSheet] = useState<LoadedSheet | null>(null);
  const [result, setResult] = useState<MarketingCompareResult | null>(null);

  const [salasCount, setSalasCount] = useState(12);
  const [loadingSalas, setLoadingSalas] = useState(true);

  const [loadingPick, setLoadingPick] = useState<"prev" | "curr" | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const [showManual, setShowManual] = useState(false);
  const [eventos, setEventos] = useState<EventoForPrint[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(true);

  const [sourceMode, setSourceMode] = useState<"excel" | "programacion">(
    "programacion"
  );
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() =>
    getMovieWeekStartForNow()
  );
  const [statusText, setStatusText] = useState("");
  const [loading, setLoading] = useState(false);

  const availableWeeks = useMemo(() => {
    const list: string[] = [];
    const currentThur = getMovieWeekStartForNow();
    const [y, m, d] = currentThur.split("-");
    const thurDate = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));

    for (let i = -4; i < 6; i++) {
      const nextThur = new Date(
        thurDate.getTime() + i * 7 * 24 * 60 * 60 * 1000
      );
      const yyyy = nextThur.getUTCFullYear();
      const mm = String(nextThur.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(nextThur.getUTCDate()).padStart(2, "0");
      list.push(`${yyyy}-${mm}-${dd}`);
    }
    return list;
  }, []);

  const handleModeChange = (mode: "excel" | "programacion") => {
    setSourceMode(mode);
    setPrevSheet(null);
    setCurrSheet(null);
    setResult(null);
    setStatusText("");
  };

  const canCompare =
    sourceMode === "programacion"
      ? !loading && !loadingSalas && !!cineId
      : !!prevSheet && !!currSheet && !loadingSalas;

  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      if (!cineId) {
        setSalasCount(12);
        setLoadingSalas(false);
        return;
      }
      try {
        setLoadingSalas(true);
        const cfg = await getCineConfig(cineId);
        if (cancelled) return;
        const count =
          cfg?.salasCount &&
          Number.isFinite(cfg.salasCount) &&
          cfg.salasCount > 0
            ? Math.floor(cfg.salasCount)
            : 12;
        setSalasCount(count);
      } catch (e) {
        console.error("Marketing config error:", e);
        if (!cancelled) setSalasCount(12);
      } finally {
        if (!cancelled) setLoadingSalas(false);
      }
    }
    loadConfig();
    return () => {
      cancelled = true;
    };
  }, [cineId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchEventos() {
      if (!cineId) {
        setEventos([]);
        setLoadingEventos(false);
        return;
      }
      try {
        setLoadingEventos(true);
        const now = new Date();
        const threshold = new Date(now.getTime() - 60 * 60 * 1000);
        const colRef = collection(db, CINES_COLLECTION, cineId, "eventos");
        const qy = query(
          colRef,
          where("diaHora", ">=", threshold),
          orderBy("diaHora", "asc")
        );
        const snap = await getDocs(qy);
        if (cancelled) return;

        const rows: EventoForPrint[] = snap.docs.map((d: any) => {
          const data = d.data() as any;
          const diaHora = toDate(data.diaHora);
          const valid = diaHora instanceof Date && !isNaN(diaHora.getTime());

          const diaSemana = valid ? DIAS_SEMANA_SHORT[diaHora.getDay()] : "???";
          const dia = valid ? diaHora.getDate() : 0;
          const mes = valid ? MESES_ABBR[diaHora.getMonth()] : "???";
          const hh = valid
            ? String(diaHora.getHours()).padStart(2, "0")
            : "--";
          const mm = valid
            ? String(diaHora.getMinutes()).padStart(2, "0")
            : "--";

          return {
            pelicula: data.pelicula || "Sin título",
            sala: String(data.sala ?? "AC"),
            fecha: `${diaSemana} ${dia} ${mes}`,
            hora: `${hh}:${mm}`,
          };
        });
        setEventos(rows);
      } catch (e) {
        console.error("Marketing fetchEventos error:", e);
        if (!cancelled) setEventos([]);
      } finally {
        if (!cancelled) setLoadingEventos(false);
      }
    }
    fetchEventos();
    return () => {
      cancelled = true;
    };
  }, [cineId]);

  async function pickExcel(which: "prev" | "curr") {
    try {
      setLoadingPick(which);
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return;
      const asset = res.assets[0];
      const name =
        asset.name ?? (which === "prev" ? "semana-anterior" : "semana-actual");

      let buffer: ArrayBuffer;
      const maybeFile = (asset as any).file as File | undefined;
      if (maybeFile && typeof maybeFile.arrayBuffer === "function") {
        buffer = await maybeFile.arrayBuffer();
      } else {
        const response = await fetch(asset.uri);
        buffer = await response.arrayBuffer();
      }

      const rows = parseMarketingExcelFromArrayBuffer(buffer);
      if (!rows.length) {
        Alert.alert(
          "Archivo sin datos",
          "No encontré filas válidas con Sala y Película."
        );
        return;
      }

      const loaded = { name, rows };
      if (which === "prev") setPrevSheet(loaded);
      else setCurrSheet(loaded);
      setResult(null);
    } catch (e: any) {
      Alert.alert(
        "Error leyendo Excel",
        e?.message ??
          "No pude leer el archivo. Verificá que tenga datos de Sala y Película."
      );
    } finally {
      setLoadingPick(null);
    }
  }

  async function handleCompare() {
    if (sourceMode === "excel") {
      if (!prevSheet || !currSheet) return;
      try {
        const compared = compareMarketingWeeks(
          prevSheet.rows,
          currSheet.rows,
          salasCount
        );
        setResult(compared);
      } catch (e: any) {
        Alert.alert(
          "Error al comparar",
          e?.message ?? "No se pudo comparar los excels."
        );
      }
    } else {
      if (!cineId) return;
      try {
        setLoading(true);
        setStatusText("Buscando programación de la semana...");
        const previousWeekStart = dayjs(selectedWeekStart)
          .subtract(7, "day")
          .format("YYYY-MM-DD");

        const newDocRef = doc(
          db,
          CINES_COLLECTION,
          cineId,
          "showtimes",
          selectedWeekStart
        );
        const newSnap = await getDoc(newDocRef);

        if (!newSnap.exists()) {
          Alert.alert(
            "Sin datos",
            `No hay showtimes guardados para la semana ${selectedWeekStart}. Por favor sincronizá la programación primero.`
          );
          setLoading(false);
          setStatusText("");
          return;
        }

        const newResultRows = newSnap.data()?.sessions || [];
        const oldDocRef = doc(
          db,
          CINES_COLLECTION,
          cineId,
          "showtimes",
          previousWeekStart
        );
        const oldSnap = await getDoc(oldDocRef);
        const oldResultRows = oldSnap.exists()
          ? oldSnap.data()?.sessions || []
          : [];

        const currRows = mapShowtimesToMarketingRows(
          newResultRows,
          selectedWeekStart
        );
        const prevRows = mapShowtimesToMarketingRows(
          oldResultRows,
          previousWeekStart
        );

        setPrevSheet({
          name: `API (${formatWeekRange(previousWeekStart)})`,
          rows: prevRows,
        });
        setCurrSheet({
          name: `API (${formatWeekRange(selectedWeekStart)})`,
          rows: currRows,
        });

        const compared = compareMarketingWeeks(prevRows, currRows, salasCount);
        setResult(compared);
        setStatusText(
          `Comparación finalizada · ${currRows.length} sesiones analizadas.`
        );
      } catch (e: any) {
        console.error(e);
        Alert.alert(
          "Error de comparación",
          e?.message ??
            "Ocurrió un error al procesar y comparar las programaciones."
        );
        setStatusText("Error en la comparación.");
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleExportPdf() {
    if (!result) return;
    try {
      setLoadingPdf(true);
      const html = buildMarketingPrintHtml(
        result,
        {
          semanaAnteriorLabel: prevSheet?.name ?? "Semana anterior",
          semanaActualLabel: currSheet?.name ?? "Semana actual",
          generadoPor: "mkt@usuario.local",
        },
        eventos
      );

      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank", "width=1200,height=900");
        if (!printWindow) {
          throw new Error(
            "El navegador bloqueó la ventana de impresión. Permití popups e intentá de nuevo."
          );
        }
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        const doPrint = () => {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 500);
        };

        if (printWindow.document.readyState === "complete") {
          doPrint();
        } else {
          printWindow.onload = doPrint;
        }
        return;
      }

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Plan MKT - PDF",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF generado", `Se generó el PDF en:\n${uri}`);
      }
    } catch (e: any) {
      Alert.alert(
        "Error al generar PDF",
        e?.message ?? "No pude generar el PDF."
      );
    } finally {
      setLoadingPdf(false);
    }
  }

  const quickStats = useMemo(() => {
    if (!result) return null;
    return result.summary;
  }, [result]);

  const currentIndex = availableWeeks.indexOf(selectedWeekStart);
  const canGoPrev = currentIndex > 0;
  const canGoNext =
    currentIndex !== -1 && currentIndex < availableWeeks.length - 1;
  const currentWeek = getMovieWeekStartForNow();
  const weekTag =
    selectedWeekStart === currentWeek
      ? "Actual"
      : selectedWeekStart > currentWeek
      ? "Preventa"
      : "Pasada";

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 py-3 pb-24 space-y-4">
      {/* Top Header & Source Switcher */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-100 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Megaphone size={18} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                Plan Semanal de Marketing y Cartelera
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <Building2 size={10} />
                {loadingSalas ? "…" : `${salasCount} Salas`}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Comparador automático de movimientos de pósters, ingresos, bajas y aperturas de jueves
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200/70 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => handleModeChange("programacion")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                sourceMode === "programacion"
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <PlugZap
                size={13}
                className={
                  sourceMode === "programacion"
                    ? "text-rose-600"
                    : "text-slate-400"
                }
              />
              Programación (API)
            </button>

            <button
              type="button"
              onClick={() => handleModeChange("excel")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                sourceMode === "excel"
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <FileSpreadsheet
                size={13}
                className={
                  sourceMode === "excel" ? "text-emerald-600" : "text-slate-400"
                }
              />
              Excels Vista
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowManual(!showManual)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-300 text-[11px] font-bold hover:bg-slate-100 cursor-pointer"
          >
            <BookOpen size={13} />
            <span>Guía</span>
            {showManual ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Collapsible Quick Manual */}
      {showManual && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 animate-card-in">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-rose-600 text-white text-[10px] font-black mb-1.5">
              1
            </span>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-zinc-100">
              Elegir Origen de Datos
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Usá "Programación (API)" para comparar directamente los showtimes sincronizados o subí los Excels "Weekly sessions by screen" de Vista.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-rose-600 text-white text-[10px] font-black mb-1.5">
              2
            </span>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-zinc-100">
              Comparar Semanas
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              El motor detecta automáticamente qué pósters se mantienen en su sala, cuáles rotan de sala y cuáles salen de cartelera.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-rose-600 text-white text-[10px] font-black mb-1.5">
              3
            </span>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-zinc-100">
              Imprimir Plan PDF
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Generá la hoja de ruta imprimible lista para el equipo con primera función de jueves y eventos programados.
            </p>
          </div>
        </div>
      )}

      {/* Control Panel Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-xs p-4">
        {sourceMode === "programacion" ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-900 dark:text-zinc-100">
                  Semana Cinematográfica a Analizar
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {weekTag}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Se compara automáticamente contra los 7 días previos para detectar altas, bajas y rotaciones de sala.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Week Stepper */}
              <div className="inline-flex items-center bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-1 gap-1">
                <button
                  type="button"
                  disabled={!canGoPrev}
                  onClick={() => {
                    setSelectedWeekStart(availableWeeks[currentIndex - 1]);
                    setResult(null);
                    setStatusText("");
                  }}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-slate-700 disabled:opacity-35 cursor-pointer"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="px-3 text-xs font-extrabold text-slate-900 dark:text-zinc-100 min-w-[185px] text-center">
                  {formatWeekRange(selectedWeekStart)}
                </span>
                <button
                  type="button"
                  disabled={!canGoNext}
                  onClick={() => {
                    setSelectedWeekStart(availableWeeks[currentIndex + 1]);
                    setResult(null);
                    setStatusText("");
                  }}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-slate-700 disabled:opacity-35 cursor-pointer"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <button
                type="button"
                disabled={!canCompare}
                onClick={handleCompare}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold shadow-sm shadow-rose-500/20 cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={14} />
                {loading ? "Analizando…" : "Comparar Semanas"}
              </button>

              {result && (
                <button
                  type="button"
                  disabled={loadingPdf}
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  <Printer size={14} />
                  {loadingPdf ? "Generando…" : "Imprimir / PDF"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => pickExcel("prev")}
                className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  prevSheet
                    ? "bg-emerald-50/60 border-emerald-300"
                    : "bg-slate-50 border-dashed border-slate-300 hover:bg-slate-100"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0">
                  <FileSpreadsheet size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    1. Semana Anterior
                  </span>
                  <span className="block text-xs font-extrabold text-slate-900 truncate">
                    {loadingPick === "prev"
                      ? "Cargando archivo…"
                      : prevSheet
                      ? prevSheet.name
                      : "Seleccionar Excel Semana Anterior"}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {prevSheet
                      ? `${prevSheet.rows.length} filas válidas`
                      : "Formatos .xlsx, .xls, .csv"}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => pickExcel("curr")}
                className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  currSheet
                    ? "bg-emerald-50/60 border-emerald-300"
                    : "bg-slate-50 border-dashed border-slate-300 hover:bg-slate-100"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shrink-0">
                  <FileSpreadsheet size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    2. Semana Actual / Entrante
                  </span>
                  <span className="block text-xs font-extrabold text-slate-900 truncate">
                    {loadingPick === "curr"
                      ? "Cargando archivo…"
                      : currSheet
                      ? currSheet.name
                      : "Seleccionar Excel Semana Actual"}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {currSheet
                      ? `${currSheet.rows.length} filas válidas`
                      : "Formatos .xlsx, .xls, .csv"}
                  </span>
                </div>
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={!canCompare}
                onClick={handleCompare}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-40"
              >
                <Sparkles size={14} />
                Comparar Archivos Excel
              </button>
              {result && (
                <button
                  type="button"
                  disabled={loadingPdf}
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  <Printer size={14} />
                  Imprimir / PDF
                </button>
              )}
            </div>
          </div>
        )}

        {statusText && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>{statusText}</span>
          </div>
        )}
      </div>

      {/* KPI Summary Cards */}
      {quickStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-card-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Pósters que se mantienen
              </span>
              <div className="text-xl font-black text-emerald-600 mt-0.5">
                {quickStats.totalDejar}
              </div>
              <span className="text-[11px] text-slate-500">
                Continúan en la misma sala
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Salen de Cartelera
              </span>
              <div className="text-xl font-black text-rose-600 mt-0.5">
                {quickStats.postersRetirarGlobales.length}
              </div>
              <span className="text-[11px] text-slate-500">
                Devolver a depósito MKT
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <LogOut size={20} />
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Nuevos / Rotaciones
              </span>
              <div className="text-xl font-black text-indigo-600 mt-0.5">
                {quickStats.totalColocar}
              </div>
              <span className="text-[11px] text-slate-500">
                Colocar o mover de sala
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ArrowRightLeft size={20} />
            </div>
          </div>
        </div>
      )}

      {/* Main Comparison Grid */}
      {quickStats && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left 7 cols: Nuevos / Movimientos + Salen */}
          <div className="lg:col-span-7 space-y-4">
            {quickStats.postersNuevosGlobales.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 p-4 space-y-2.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <ArrowRightLeft size={15} className="text-indigo-600" />
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Ingresos y Movimientos de Pósters
                  </h3>
                </div>
                <div className="space-y-2">
                  {quickStats.postersNuevosGlobales.map((item, idx) => {
                    const hasMovement =
                      !!item.possibleSourceSalas &&
                      item.possibleSourceSalas.length > 0;
                    return (
                      <div
                        key={`new-${item.pelicula}-${idx}`}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-slate-900">
                            {item.pelicula}
                          </div>
                          <div className="text-[11px] font-bold text-indigo-600 mt-0.5">
                            Colocar x{item.cantidad} →{" "}
                            {item.cantidad === 1 ? "Sala" : "Salas"}{" "}
                            {item.salas.join(", ")}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {hasMovement ? (
                              <>
                                Mover desde sala{" "}
                                <strong>
                                  {item.possibleSourceSalas!.join("/")}
                                </strong>
                                {item.cantidad >
                                item.possibleSourceSalas!.length
                                  ? ` · Bajar ${
                                      item.cantidad -
                                      item.possibleSourceSalas!.length
                                    } de MKT`
                                  : item.possibleSourceSalas!.length >
                                    item.cantidad
                                  ? ` · Devolver ${
                                      item.possibleSourceSalas!.length -
                                      item.cantidad
                                    } a MKT`
                                  : ""}
                              </>
                            ) : (
                              "Estreno / Póster nuevo (bajar de depósito MKT)"
                            )}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 border ${
                            hasMovement
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200"
                          }`}
                        >
                          {hasMovement ? "MOVIMIENTO" : "NUEVO"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {quickStats.postersRetirarGlobales.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 p-4 space-y-2.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <LogOut size={15} className="text-rose-600" />
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Salen de Cartelera (Retirar)
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quickStats.postersRetirarGlobales.map((item, idx) => (
                    <div
                      key={`ret-${item.pelicula}-${idx}`}
                      className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200/70"
                    >
                      <div className="text-xs font-extrabold text-slate-900">
                        {item.pelicula}
                      </div>
                      <div className="text-[10px] font-bold text-rose-700 mt-0.5">
                        Retirar x{item.cantidad} de Sala{" "}
                        {item.salas.join(", ")} → Devolver a MKT
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right 5 cols: Primera Función del Jueves + Eventos */}
          <div className="lg:col-span-5 space-y-4">
            {result?.ponerEnCarteleraPorSala &&
              Object.keys(result.ponerEnCarteleraPorSala).length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Film size={15} className="text-rose-600" />
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                      Primera Función del Jueves
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {Object.entries(result.ponerEnCarteleraPorSala)
                      .sort((a, b) => Number(a[0]) - Number(b[0]))
                      .map(([sala, pelicula]) => (
                        <div
                          key={`cart-${sala}`}
                          className="py-1.5 flex items-center gap-2.5"
                        >
                          <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                            {sala}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {pelicula || "Sin dato"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* Eventos Próximos */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 p-4 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-amber-600" />
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Eventos Próximos en Complejo
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  {eventos.length} activos
                </span>
              </div>
              {eventos.length > 0 ? (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {eventos.map((ev, idx) => (
                    <div
                      key={`ev-${idx}`}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {ev.pelicula}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 shrink-0">
                        {ev.sala.toUpperCase() === "AC"
                          ? "A confirmar"
                          : `Sala ${ev.sala}`}{" "}
                        · {ev.fecha} {ev.hora}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-2">
                  {loadingEventos
                    ? "Cargando eventos…"
                    : "No hay eventos próximos programados."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Per-Room Breakdown Grid */}
      {result && result.salas.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider px-1">
            Detalle de Películas por Sala ({result.salas.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {result.salas.map((sala) => (
              <div
                key={sala.sala}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 p-3.5 space-y-2.5 hover-lift"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-black flex items-center justify-center">
                      {sala.sala}
                    </span>
                    <span className="text-xs font-extrabold text-slate-900">
                      Sala {sala.sala}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {sala.funciones.length} títulos
                  </span>
                </div>

                {result.ponerEnCarteleraPorSala?.[String(sala.sala)] && (
                  <div className="p-2 rounded-xl bg-rose-50/70 border border-rose-200/60">
                    <span className="block text-[9px] font-extrabold uppercase text-rose-600">
                      1° Función Jueves
                    </span>
                    <span className="text-[11px] font-bold text-slate-900 line-clamp-1">
                      {result.ponerEnCarteleraPorSala[String(sala.sala)]}
                    </span>
                  </div>
                )}

                <div className="space-y-1">
                  {sala.funciones.length ? (
                    sala.funciones.map((item, idx) => (
                      <div
                        key={`${item.pelicula}-${idx}`}
                        className="text-[11px] font-semibold text-slate-700 flex items-start gap-1.5"
                      >
                        <span className="text-rose-500 font-bold">•</span>
                        <span className="line-clamp-1">{item.pelicula}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      Sin funciones detectadas
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
