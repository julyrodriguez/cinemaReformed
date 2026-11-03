// app/screens/ProgramacionTab.tsx

import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import React, { useMemo, useState, useEffect } from "react";
import { Alert, Platform } from "react-native";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Layers,
  Radio,
  Sparkles,
  Star,
  Upload,
  X,
  Clock,
  Film,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from "@/lib/dbService";
import dayjs from "dayjs";
import { toDate } from "@/shared/utils";

import { db, CINES_COLLECTION } from "../../lib/firebaseConfig";
import { useAuthUser } from "../../lib/useAuthUser";
import {
  generateProgramacionWorkbook,
  generateWeeklyProgramacionWorkbook,
  parseWeeklyProgrammingExcel,
  buildDailyProgramming,
} from "../../lib/programacion/excel";
import { parseWeeklyProgrammingPDF } from "../../lib/programacion/pdf";
import {
  WEEKDAY_LABELS,
  WeekdayKey,
  WeeklyMovieRow,
} from "../../lib/programacion/types";

/** Índice del día dentro de la semana de programación (jueves = 0) */
const DAY_OFFSETS: Record<WeekdayKey, number> = {
  jueves: 0,
  viernes: 1,
  sabado: 2,
  domingo: 3,
  lunes: 4,
  martes: 5,
  miercoles: 6,
};

const MONTH_LABELS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function buildDateLabel(startDate: Date | null, day: WeekdayKey): string {
  const label = WEEKDAY_LABELS[day];
  if (!startDate) return label;

  const offset = DAY_OFFSETS[day];
  const d = new Date(startDate);
  d.setDate(d.getDate() + offset);

  const dd = String(d.getDate()).padStart(2, "0");
  const month = MONTH_LABELS_ES[d.getMonth()];
  const yyyy = d.getFullYear();

  return `${label} ${dd} de ${month.charAt(0).toUpperCase() + month.slice(1)} de ${yyyy}`;
}

function buildFileName(startDate: Date | null, day: WeekdayKey): string {
  const label = WEEKDAY_LABELS[day];
  if (!startDate) return `Programacion ${label}.xlsx`;

  const offset = DAY_OFFSETS[day];
  const d = new Date(startDate);
  d.setDate(d.getDate() + offset);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `Programacion ${label} ${dd}-${mm}-${yyyy}.xlsx`;
}

const DAYS: WeekdayKey[] = [
  "jueves",
  "viernes",
  "sabado",
  "domingo",
  "lunes",
  "martes",
  "miercoles",
];

// Get start of movie week (Thursday) for a given date in yyyy-mm-dd
function getMovieWeekStart(date: Date): string {
  const localDate = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  if (localDate.getUTCHours() < 6) {
    localDate.setTime(localDate.getTime() - 24 * 60 * 60 * 1000);
  }
  const dayNum = localDate.getUTCDay();
  const daysToSubtract = dayNum <= 3 ? dayNum + 3 : dayNum - 4;
  const thurDate = new Date(localDate.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
  const yyyy = thurDate.getUTCFullYear();
  const mm = String(thurDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(thurDate.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Get start of movie week (Thursday) for the current date
function getMovieWeekStartForNow(): string {
  const localDate = new Date(Date.now() - 3 * 60 * 60 * 1000);
  if (localDate.getUTCHours() < 6) {
    localDate.setTime(localDate.getTime() - 24 * 60 * 60 * 1000);
  }
  const dayNum = localDate.getUTCDay();
  const daysToSubtract = dayNum <= 3 ? dayNum + 3 : dayNum - 4;
  const thurDate = new Date(localDate.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
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

function isMarketingTag(tag: string): boolean {
  if (!tag) return true;
  const t = tag.toUpperCase().trim();
  return (
    t.includes("CONTENIDO ALTERNATIVO") ||
    t.includes("CON RESTRICCIONES") ||
    t.includes("SIN PROMOCIONES") ||
    t === ""
  );
}

function mapApiSessionsToWeeklyRows(sessions: any[]): WeeklyMovieRow[] {
  const groupMap: Record<
    string,
    {
      sala: number;
      pelicula: string;
      calificacion: string;
      horariosPorDia: Record<WeekdayKey, string[]>;
    }
  > = {};

  sessions.forEach((session: any) => {
    const salaNum = Number(session.theaterRoom);
    if (isNaN(salaNum)) return;

    const formatStr = (session.sessionFormat || "").toUpperCase().includes("3D") ? "3D" : "2D";
    const langName = (session.language?.name || session.language || "").toUpperCase();
    let langStr = "CAS";
    if (langName.includes("SUB") || langName.includes("ING") || langName.includes("ORIG")) {
      langStr = "SUB";
    }

    const pelicula = `${session.movieName} ${formatStr} ${langStr}`.toUpperCase();
    const groupKey = `${salaNum}_${pelicula}`;
    const currentRating = session.rating || session.calificacion || session.tags?.[0]?.label || "";

    if (!groupMap[groupKey]) {
      groupMap[groupKey] = {
        sala: salaNum,
        pelicula,
        calificacion: currentRating,
        horariosPorDia: {
          jueves: [],
          viernes: [],
          sabado: [],
          domingo: [],
          lunes: [],
          martes: [],
          miercoles: [],
        },
      };
    } else {
      const existing = groupMap[groupKey].calificacion;
      if (!existing || (isMarketingTag(existing) && !isMarketingTag(currentRating))) {
        groupMap[groupKey].calificacion = currentRating;
      }
    }

    let dtStr = session.sessionDateTime || "";
    if (dtStr && !dtStr.includes("T") && dtStr.includes(" ")) {
      dtStr = dtStr.replace(" ", "T");
    }
    const utcDate = new Date(dtStr);
    const arDate = new Date(utcDate.getTime());
    if (arDate.getUTCHours() < 6) {
      arDate.setTime(arDate.getTime() - 24 * 60 * 60 * 1000);
    }

    const dayNum = arDate.getUTCDay();
    const dayMap: Record<number, WeekdayKey> = {
      0: "domingo",
      1: "lunes",
      2: "martes",
      3: "miercoles",
      4: "jueves",
      5: "viernes",
      6: "sabado",
    };
    const sessionDay = dayMap[dayNum];

    const hours = String(arDate.getUTCHours()).padStart(2, "0");
    const mins = String(arDate.getUTCMinutes()).padStart(2, "0");
    const inicio = `${hours}:${mins}`;

    const durationMins = (session.runTime || 120) + 15;
    const endMins = (arDate.getUTCHours() * 60 + arDate.getUTCMinutes() + durationMins) % 1440;
    const endH = Math.floor(endMins / 60);
    const endM = endMins % 60;
    const fin = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    const timeRangeStr = `${inicio} - ${fin}`;

    if (!groupMap[groupKey].horariosPorDia[sessionDay].includes(timeRangeStr)) {
      groupMap[groupKey].horariosPorDia[sessionDay].push(timeRangeStr);
    }
  });

  const result = Object.values(groupMap);
  result.forEach((row) => {
    (Object.keys(row.horariosPorDia) as WeekdayKey[]).forEach((day) => {
      row.horariosPorDia[day].sort((a, b) => {
        const timeA = a.split(" - ")[0];
        const timeB = b.split(" - ")[0];
        const minA = Number(timeA.split(":")[0]) * 60 + Number(timeA.split(":")[1]);
        const minB = Number(timeB.split(":")[0]) * 60 + Number(timeB.split(":")[1]);
        const adjA = minA < 360 ? minA + 1440 : minA;
        const adjB = minB < 360 ? minB + 1440 : minB;
        return adjA - adjB;
      });
    });
  });

  return result.sort((a, b) => {
    if (a.sala !== b.sala) return a.sala - b.sala;
    return a.pelicula.localeCompare(b.pelicula);
  });
}

function getCinematicWeekdayKey(date: Date): WeekdayKey {
  let d = dayjs(date);
  if (d.hour() < 6) {
    d = d.subtract(1, "day");
  }
  const dayNum = d.day();
  const map: Record<number, WeekdayKey> = {
    0: "domingo",
    1: "lunes",
    2: "martes",
    3: "miercoles",
    4: "jueves",
    5: "viernes",
    6: "sabado",
  };
  return map[dayNum];
}

function addMinutesToTimeStr(timeStr: string, minsToAdd: number): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const totalMins = (h * 60 + m + minsToAdd) % 1440;
  const newH = Math.floor(totalMins / 60);
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function buildEventWeeklyRows(eventos: any[], weekStart: string): WeeklyMovieRow[] {
  const rowsMap: Record<string, WeeklyMovieRow> = {};

  eventos.forEach((evt) => {
    if (!evt.sala || evt.sala.trim() === "") return;
    if (evt.duracion === undefined || evt.duracion === null || String(evt.duracion).trim() === "") return;

    const eventDate = toDate(evt.diaHora);
    const eventWeekStart = getMovieWeekStart(eventDate);
    if (eventWeekStart !== weekStart) return;

    const eventDayKey = getCinematicWeekdayKey(eventDate);
    const startHours = String(eventDate.getHours()).padStart(2, "0");
    const startMins = String(eventDate.getMinutes()).padStart(2, "0");
    const inicio = `${startHours}:${startMins}`;
    const duration = Number(evt.duracion);
    const fin = addMinutesToTimeStr(inicio, duration);

    const timeRangeStr = `${inicio} - ${fin}`;
    const peliculaName = `[EVENTO] ${evt.pelicula || "EVENTO"}`.toUpperCase();
    const key = `${evt.sala}_${peliculaName}`;

    if (!rowsMap[key]) {
      rowsMap[key] = {
        sala: Number(evt.sala),
        pelicula: peliculaName,
        calificacion: "",
        horariosPorDia: {
          jueves: [],
          viernes: [],
          sabado: [],
          domingo: [],
          lunes: [],
          martes: [],
          miercoles: [],
        },
      };
    }

    rowsMap[key].horariosPorDia[eventDayKey].push(timeRangeStr);
  });

  return Object.values(rowsMap);
}

export default function ProgramacionTab() {
  const { cineId } = useAuthUser();

  const [sourceMode, setSourceMode] = useState<"file" | "api">("file");
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() => getMovieWeekStartForNow());

  const availableWeeks = useMemo(() => {
    const list: string[] = [];
    const currentThur = getMovieWeekStartForNow();
    const [y, m, d] = currentThur.split("-");
    const thurDate = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));

    for (let i = -4; i < 6; i++) {
      const nextThur = new Date(thurDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const yyyy = nextThur.getUTCFullYear();
      const mm = String(nextThur.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(nextThur.getUTCDate()).padStart(2, "0");
      list.push(`${yyyy}-${mm}-${dd}`);
    }
    return list;
  }, []);

  const [weeklyUri, setWeeklyUri] = useState<string | null>(null);
  const [weeklyName, setWeeklyName] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<WeekdayKey>("jueves");
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Fecha de inicio de semana
  const [fechaInicioSemana, setFechaInicioSemana] = useState(() => {
    const d = dayjs();
    const diff = d.day() - 4; // 4 = Jueves
    const thur = diff >= 0 ? d.subtract(diff, "day") : d.subtract(7 + diff, "day");
    return thur.format("YYYY-MM-DD");
  });

  const [loadedWeeklyRows, setLoadedWeeklyRows] = useState<any[] | null>(null);
  const [loadedWeeklyType, setLoadedWeeklyType] = useState<"excel" | "pdf" | "api" | null>(null);

  const [savedWeekly, setSavedWeekly] = useState<{
    startDate: string;
    savedAt: string;
    weeklyRows: any[];
  } | null>(null);
  const [useSavedWeekly, setUseSavedWeekly] = useState(false);
  const [, setLoadingSavedWeekly] = useState(false);

  async function loadLatestSavedWeekly() {
    if (!cineId) return;
    try {
      setLoadingSavedWeekly(true);
      const docRef = doc(db, CINES_COLLECTION, cineId, "programacion_semanal", "actual");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setSavedWeekly({
          startDate: data.startDate,
          savedAt: data.savedAt,
          weeklyRows: data.weeklyRows || [],
        });
      } else {
        setSavedWeekly(null);
      }
    } catch (err) {
      console.error("[Weekly] Error al cargar programación guardada:", err);
    } finally {
      setLoadingSavedWeekly(false);
    }
  }

  useEffect(() => {
    loadLatestSavedWeekly();
  }, [cineId]);

  useEffect(() => {
    if (!cineId) return;

    const ref = collection(db, CINES_COLLECTION, cineId, "eventos");
    const unsubscribe = onSnapshot(
      ref,
      (snapshot: any) => {
        const list: any[] = [];
        snapshot.forEach((docSnap: any) => {
          list.push({
            id: docSnap.id,
            ...docSnap.data(),
          });
        });
        setEventos(list);
      },
      (error: any) => {
        console.error("[ProgramacionTab] Error loading eventos:", error);
      }
    );

    return () => unsubscribe();
  }, [cineId]);

  const [creditosList, setCreditosList] = useState<any[]>([]);
  const [includeCreditos, setIncludeCreditos] = useState(false);

  useEffect(() => {
    if (!cineId) return;

    const ref = collection(db, CINES_COLLECTION, cineId, "creditos");
    const unsubscribe = onSnapshot(
      ref,
      (snapshot: any) => {
        const list: any[] = [];
        snapshot.forEach((docSnap: any) => {
          list.push({
            id: docSnap.id,
            ...docSnap.data(),
          });
        });
        setCreditosList(list);
      },
      (error: any) => {
        console.error("[ProgramacionTab] Error loading creditos:", error);
      }
    );

    return () => unsubscribe();
  }, [cineId]);

  const [summary, setSummary] = useState<{
    entrada: number;
    salida: number;
    fileName: string;
  } | null>(null);
  const [useFloors, setUseFloors] = useState(false);
  const [numFloors, setNumFloors] = useState(2);
  const [floorRanges, setFloorRanges] = useState([
    { from: "1", to: "4" },
    { from: "5", to: "8" },
    { from: "9", to: "12" },
    { from: "13", to: "16" },
  ]);

  const canGenerate = useMemo(() => {
    if (useSavedWeekly) {
      return !!savedWeekly && !loading;
    }
    return !!weeklyUri && !loading;
  }, [useSavedWeekly, savedWeekly, weeklyUri, loading]);

  const previewData = useMemo(() => {
    const rowsToUse = useSavedWeekly ? savedWeekly?.weeklyRows || [] : loadedWeeklyRows || [];
    const weekStart = useSavedWeekly ? savedWeekly?.startDate || fechaInicioSemana : fechaInicioSemana;
    const eventRows = buildEventWeeklyRows(eventos, weekStart);
    return buildDailyProgramming(
      [...rowsToUse, ...eventRows],
      selectedDay,
      WEEKDAY_LABELS[selectedDay],
      creditosList,
      includeCreditos
    );
  }, [useSavedWeekly, savedWeekly, loadedWeeklyRows, selectedDay, eventos, fechaInicioSemana, creditosList, includeCreditos]);

  async function pickWeeklyFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/octet-stream",
          "application/pdf",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return;
      const file = res.assets?.[0];
      if (!file?.uri) return;

      const isPdf = file.name?.toLowerCase().endsWith(".pdf") || file.mimeType === "application/pdf";

      setWeeklyUri(file.uri);
      setWeeklyName(file.name ?? (isPdf ? "sessionByScreen.pdf" : "archivo-semanal.xlsx"));
      setSummary(null);
      setUseSavedWeekly(false);
      setStatusText(isPdf ? "Cargando y procesando PDF..." : "Cargando y procesando Excel...");

      setLoading(true);
      if (isPdf) {
        const { rows, startDate } = await parseWeeklyProgrammingPDF(file.uri);
        if (rows && rows.length > 0) {
          setLoadedWeeklyRows(rows);
          setLoadedWeeklyType("pdf");
          if (startDate) {
            setFechaInicioSemana(dayjs(startDate).format("YYYY-MM-DD"));
            setStatusText(`PDF cargado correctamente. Fecha detectada: ${dayjs(startDate).format("DD/MM/YYYY")}`);
          } else {
            const d = dayjs();
            const diff = d.day() - 4;
            const thur = diff >= 0 ? d.subtract(diff, "day") : d.subtract(7 + diff, "day");
            setFechaInicioSemana(thur.format("YYYY-MM-DD"));
            setStatusText("PDF cargado. No se detectó fecha en el encabezado.");
          }
        } else {
          setLoadedWeeklyRows(null);
          setStatusText("El archivo PDF no tiene un formato compatible.");
        }
      } else {
        const { rows, startDate } = await parseWeeklyProgrammingExcel(file.uri);
        if (rows && rows.length > 0) {
          setLoadedWeeklyRows(rows);
          setLoadedWeeklyType("excel");
          if (startDate) {
            setFechaInicioSemana(dayjs(startDate).format("YYYY-MM-DD"));
            setStatusText(`Excel cargado correctamente. Fecha detectada: ${dayjs(startDate).format("DD/MM/YYYY")}`);
          } else {
            const d = dayjs();
            const diff = d.day() - 4;
            const thur = diff >= 0 ? d.subtract(diff, "day") : d.subtract(7 + diff, "day");
            setFechaInicioSemana(thur.format("YYYY-MM-DD"));
            setStatusText("Excel cargado. No se detectó fecha en el encabezado.");
          }
        } else {
          setLoadedWeeklyRows(null);
          setStatusText("El archivo Excel no tiene un formato compatible.");
        }
      }
    } catch {
      Alert.alert("Error", "No se pudo procesar el archivo seleccionado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadFromApi() {
    if (!cineId) return;
    try {
      setLoading(true);
      setStatusText("Obteniendo showtimes desde la API...");

      const docRef = doc(db, CINES_COLLECTION, cineId, "showtimes", selectedWeekStart);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        Alert.alert(
          "Sin datos",
          `No hay showtimes guardados para la semana ${selectedWeekStart}. Por favor sincronizá la programación primero en la sección correspondiente.`
        );
        return;
      }

      const sessions = snap.data()?.sessions || [];
      if (sessions.length === 0) {
        Alert.alert("Sin datos", `La programación para la semana ${selectedWeekStart} está vacía.`);
        return;
      }

      setStatusText("Procesando programación de la API...");
      const rows = mapApiSessionsToWeeklyRows(sessions);

      if (rows && rows.length > 0) {
        setLoadedWeeklyRows(rows);
        setLoadedWeeklyType("api");
        setFechaInicioSemana(selectedWeekStart);
        setWeeklyName(`API Programación ${selectedWeekStart}`);
        setWeeklyUri("api");
        setUseSavedWeekly(false);
        setSummary(null);
        setStatusText(`Programación API cargada correctamente. Se detectaron ${rows.length} películas.`);
      } else {
        setLoadedWeeklyRows(null);
        setStatusText("No se encontraron sesiones válidas en la programación.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Ocurrió un error al cargar la programación desde la API.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!useSavedWeekly && !weeklyUri) return;
    try {
      setLoading(true);
      setSummary(null);
      setStatusText("Procesando datos...");

      let weeklyRows: WeeklyMovieRow[] = [];
      let dateLabelToUse = WEEKDAY_LABELS[selectedDay];
      let startDateToUse: Date | null = null;

      let shouldSaveAutomatically = false;
      let rowsToSave: any[] = [];
      let startDateToSave = "";

      if (useSavedWeekly && savedWeekly) {
        weeklyRows = savedWeekly.weeklyRows;
        const parsedStartDate = dayjs(savedWeekly.startDate).toDate();
        startDateToUse = parsedStartDate;
        dateLabelToUse = buildDateLabel(parsedStartDate, selectedDay);
      } else if (loadedWeeklyRows && loadedWeeklyRows.length > 0) {
        weeklyRows = loadedWeeklyRows;
        const parsedStartDate = dayjs(fechaInicioSemana).toDate();
        startDateToUse = parsedStartDate;
        dateLabelToUse = buildDateLabel(parsedStartDate, selectedDay);

        shouldSaveAutomatically = true;
        rowsToSave = loadedWeeklyRows;
        startDateToSave = fechaInicioSemana;
      } else if (weeklyUri) {
        const isPdf = weeklyName?.toLowerCase().endsWith(".pdf") || false;
        const { rows, startDate } = isPdf
          ? await parseWeeklyProgrammingPDF(weeklyUri)
          : await parseWeeklyProgrammingExcel(weeklyUri);
        weeklyRows = rows;
        startDateToUse = startDate;
        if (startDate) {
          dateLabelToUse = buildDateLabel(startDate, selectedDay);
        }

        shouldSaveAutomatically = true;
        rowsToSave = rows;
        startDateToSave = startDate ? dayjs(startDate).format("YYYY-MM-DD") : fechaInicioSemana;
      }

      if (!weeklyRows.length) {
        Alert.alert("Sin datos", "La programación no contiene datos válidos.");
        return;
      }

      const weekStartStr =
        startDateToSave ||
        (startDateToUse instanceof Date ? dayjs(startDateToUse).format("YYYY-MM-DD") : startDateToUse) ||
        fechaInicioSemana;
      const eventRows = buildEventWeeklyRows(eventos, weekStartStr);
      const generated = await generateProgramacionWorkbook({
        weeklyRows: [...weeklyRows, ...eventRows],
        day: selectedDay,
        dateLabel: dateLabelToUse,
        floorConfig: useFloors
          ? {
              active: true,
              count: parseInt(numFloors.toString(), 10) || 2,
              ranges: floorRanges.slice(0, parseInt(numFloors.toString(), 10)).map((r) => ({
                from: parseInt(r.from.toString(), 10) || 0,
                to: parseInt(r.to.toString(), 10) || 0,
              })),
            }
          : undefined,
        includeCreditos,
        creditosList,
      });

      let finalFileName = generated.fileName;
      if (startDateToUse) {
        finalFileName = buildFileName(startDateToUse, selectedDay);
        if (includeCreditos) {
          finalFileName = finalFileName.replace("Programacion ", "Programacion con Creditos ");
        }
      }

      setSummary({
        entrada: generated.data.entrada.length,
        salida: generated.data.salida.length,
        fileName: finalFileName,
      });

      setStatusText("Generación exitosa");

      if (shouldSaveAutomatically && cineId && rowsToSave.length > 0) {
        try {
          const docRef = doc(db, CINES_COLLECTION, cineId, "programacion_semanal", "actual");
          const dateDocRef = doc(db, CINES_COLLECTION, cineId, "programacion_semanal", startDateToSave);
          const sanitizedRows = JSON.parse(JSON.stringify(rowsToSave));
          const payload = {
            startDate: startDateToSave,
            weeklyRows: sanitizedRows,
            savedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await setDoc(docRef, payload);
          await setDoc(dateDocRef, payload);

          setSavedWeekly({
            startDate: payload.startDate,
            savedAt: payload.savedAt,
            weeklyRows: payload.weeklyRows,
          });
          setUseSavedWeekly(true);

          setWeeklyUri(null);
          setWeeklyName(null);
          setLoadedWeeklyRows(null);
          setLoadedWeeklyType(null);

          await loadLatestSavedWeekly();
          setStatusText("Generación exitosa. Reporte guardado para futuros usos.");
        } catch (saveError) {
          console.error("[Weekly Save Automatic] Error al guardar en la BD:", saveError);
        }
      }

      if (Platform.OS === "web") {
        if (generated.webArrayBuffer) {
          const blob = new Blob([generated.webArrayBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = finalFileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        return;
      }

      if (generated.uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(generated.uri);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Ocurrió un problema al generar el Excel.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateWeekly() {
    if (!useSavedWeekly && !weeklyUri) return;
    try {
      setLoading(true);
      setSummary(null);
      setStatusText("Generando reporte semanal...");

      let weeklyRows: WeeklyMovieRow[] = [];
      let startDateToUse: Date | null = null;

      let shouldSaveAutomatically = false;
      let rowsToSave: any[] = [];
      let startDateToSave = "";

      if (useSavedWeekly && savedWeekly) {
        weeklyRows = savedWeekly.weeklyRows;
        startDateToUse = dayjs(savedWeekly.startDate).toDate();
      } else if (loadedWeeklyRows && loadedWeeklyRows.length > 0) {
        weeklyRows = loadedWeeklyRows;
        startDateToUse = dayjs(fechaInicioSemana).toDate();
        shouldSaveAutomatically = true;
        rowsToSave = loadedWeeklyRows;
        startDateToSave = fechaInicioSemana;
      } else if (weeklyUri) {
        const isPdf = weeklyName?.toLowerCase().endsWith(".pdf") || false;
        const { rows, startDate } = isPdf
          ? await parseWeeklyProgrammingPDF(weeklyUri)
          : await parseWeeklyProgrammingExcel(weeklyUri);
        weeklyRows = rows;
        startDateToUse = startDate;
        shouldSaveAutomatically = true;
        rowsToSave = rows;
        startDateToSave = startDate ? dayjs(startDate).format("YYYY-MM-DD") : fechaInicioSemana;
      }

      if (!weeklyRows.length) {
        Alert.alert("Sin datos", "La programación no contiene datos válidos.");
        return;
      }

      const weekStartStr =
        startDateToSave ||
        (startDateToUse instanceof Date ? dayjs(startDateToUse).format("YYYY-MM-DD") : startDateToUse) ||
        fechaInicioSemana;
      const eventRows = buildEventWeeklyRows(eventos, weekStartStr);
      const generated = await generateWeeklyProgramacionWorkbook({
        weeklyRows: [...weeklyRows, ...eventRows],
        startDate: startDateToUse,
        floorConfig: useFloors
          ? {
              active: true,
              count: parseInt(numFloors.toString(), 10) || 2,
              ranges: floorRanges.slice(0, parseInt(numFloors.toString(), 10)).map((r) => ({
                from: parseInt(r.from.toString(), 10) || 0,
                to: parseInt(r.to.toString(), 10) || 0,
              })),
            }
          : undefined,
        includeCreditos,
        creditosList,
      });

      if (shouldSaveAutomatically && cineId && rowsToSave.length > 0) {
        try {
          const docRef = doc(db, CINES_COLLECTION, cineId, "programacion_semanal", "actual");
          const dateDocRef = doc(db, CINES_COLLECTION, cineId, "programacion_semanal", startDateToSave);
          const sanitizedRows = JSON.parse(JSON.stringify(rowsToSave));
          const payload = {
            startDate: startDateToSave,
            weeklyRows: sanitizedRows,
            savedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await setDoc(docRef, payload);
          await setDoc(dateDocRef, payload);

          setSavedWeekly({
            startDate: payload.startDate,
            savedAt: payload.savedAt,
            weeklyRows: payload.weeklyRows,
          });
          setUseSavedWeekly(true);

          setWeeklyUri(null);
          setWeeklyName(null);
          setLoadedWeeklyRows(null);
          setLoadedWeeklyType(null);

          await loadLatestSavedWeekly();
        } catch (saveError) {
          console.error("[Weekly Save Automatic] Error al guardar en la BD:", saveError);
        }
      }

      setStatusText("Generación semanal exitosa");

      if (Platform.OS === "web") {
        if (generated.webArrayBuffer) {
          const blob = new Blob([generated.webArrayBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = generated.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        return;
      }

      if (generated.uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(generated.uri);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Ocurrió un problema al generar el Excel semanal.");
    } finally {
      setLoading(false);
    }
  }

  const currentWeek = getMovieWeekStartForNow();
  const currentIndex = availableWeeks.indexOf(selectedWeekStart);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < availableWeeks.length - 1;

  let weekBadgeText = "";
  if (selectedWeekStart === currentWeek) {
    weekBadgeText = "Actual";
  } else if (selectedWeekStart > currentWeek) {
    weekBadgeText = "Preventa";
  } else if (selectedWeekStart < currentWeek) {
    weekBadgeText = "Pasada";
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 py-3 pb-24 space-y-4">
      {/* Dynamic Warning Alert Banner */}
      <div className="flex items-center justify-center gap-2.5 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold shadow-xs animate-pulse">
        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-center">
          ⚠️ ATENCIÓN: Si hubo cambios de programación debe descargar el reporte nuevo, por favor consulte a sus encargados.
        </span>
      </div>

      {/* Manual Accordion Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden transition-all duration-200">
        <button
          type="button"
          onClick={() => setShowManual(!showManual)}
          className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <BookOpen size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                Manual de Instrucciones e Impresión
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Pasos para exportar desde Vista y configurar la impresión en papel
              </p>
            </div>
          </div>
          <div className="text-slate-400 dark:text-zinc-500">
            {showManual ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {showManual && (
          <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-zinc-800 space-y-3 text-xs text-slate-600 dark:text-zinc-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-zinc-800/80">
                <div className="flex items-center gap-2 font-black text-rose-600 dark:text-rose-400 mb-1.5 text-xs">
                  <span className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center text-[10px] font-black">
                    1
                  </span>
                  Exportación desde Vista
                </div>
                <ul className="space-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                  <li>• Reporte: "Weekly sessions by screen" o "Función por pantalla semanal".</li>
                  <li>• Fechas: Rango de Jueves a Jueves.</li>
                  <li>• Idioma: Seleccionar Inglés (opción superior a la fecha).</li>
                  <li>• Exportar: Menú superior a "Excel Data Only" o "PDF".</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-zinc-800/80">
                <div className="flex items-center gap-2 font-black text-rose-600 dark:text-rose-400 mb-1.5 text-xs">
                  <span className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center text-[10px] font-black">
                    2
                  </span>
                  Generación en esta App
                </div>
                <ul className="space-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                  <li>• Cargar el archivo generado en "Origen de Datos".</li>
                  <li>• O bien seleccionar "Programación API" para descarga directa.</li>
                  <li>• Elegir el día y configurar "División por Pisos" si se requiere.</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-zinc-800/80">
                <div className="flex items-center gap-2 font-black text-rose-600 dark:text-rose-400 mb-1.5 text-xs">
                  <span className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center text-[10px] font-black">
                    3
                  </span>
                  Configuración de Impresora
                </div>
                <ul className="space-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                  <li>• Abrir Excel y habilitar edición.</li>
                  <li>• Orientación: Horizontal | Papel: A4 | Ajustar hoja a una página.</li>
                  <li>• Doble Cara: Si activaste pisos, seleccionar "Voltear por el lado largo".</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Generator Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs p-4 sm:p-5 space-y-5">
        {/* Source Mode Section */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <FileSpreadsheet size={15} className="text-rose-600 dark:text-rose-400" />
                1. Origen de Datos de Programación
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Seleccioná si cargarás un archivo semanal o descargarás de la API
              </p>
            </div>

            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200/70 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setSourceMode("file")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  sourceMode === "file"
                    ? "bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                <Upload size={13} />
                Archivo (PDF/Excel)
              </button>
              <button
                type="button"
                onClick={() => setSourceMode("api")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  sourceMode === "api"
                    ? "bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                <Radio size={13} />
                Programación API
              </button>
            </div>
          </div>

          {sourceMode === "file" ? (
            <div className="space-y-3">
              <div
                onClick={pickWeeklyFile}
                className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 transition-all ${
                  weeklyName
                    ? "border-emerald-400 dark:border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : "border-slate-200 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-rose-500/50 bg-slate-50/50 dark:bg-zinc-950/40"
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    weeklyName
                      ? "bg-emerald-500 text-white"
                      : "bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 group-hover:text-rose-600 dark:group-hover:text-rose-400"
                  }`}
                >
                  {weeklyName?.toLowerCase().endsWith(".pdf") ? (
                    <FileText size={22} />
                  ) : (
                    <FileSpreadsheet size={22} />
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-8">
                  <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                    {weeklyName || "Seleccionar Archivo Semanal (Excel o PDF)"}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {weeklyName
                      ? "Archivo cargado y procesado correctamente"
                      : "Formatos soportados: .xlsx, .xls o .pdf exportado desde Vista"}
                  </p>
                </div>

                {weeklyUri && weeklyUri !== "api" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setWeeklyUri(null);
                      setWeeklyName(null);
                      setLoadedWeeklyRows(null);
                      setLoadedWeeklyType(null);
                      setStatusText("");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-200 flex items-center justify-center transition-colors"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">
                  Seleccionar Semana de Programación:
                </span>

                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button
                    type="button"
                    disabled={!canGoPrev}
                    onClick={() => setSelectedWeekStart(availableWeeks[currentIndex - 1])}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="px-3 py-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 min-w-[210px] text-center">
                    <span className="text-xs font-black text-slate-800 dark:text-zinc-200">
                      {formatWeekRange(selectedWeekStart)}
                    </span>
                    {weekBadgeText && (
                      <span className="ml-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                        ({weekBadgeText})
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!canGoNext}
                    onClick={() => setSelectedWeekStart(availableWeeks[currentIndex + 1])}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLoadFromApi}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs tracking-wider uppercase transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Radio size={14} />
                {loading ? "Obteniendo datos..." : "📡 Cargar desde API"}
              </button>
            </div>
          )}

          {/* Success Status Chip */}
          {loadedWeeklyRows && (
            <div className="mt-2.5 p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-black uppercase">
                    Reporte semanal detectado ({loadedWeeklyType === "api" ? "API" : loadedWeeklyType?.toUpperCase()})
                  </span>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-medium">
                    Se extrajeron {loadedWeeklyRows.length} películas · Cargado a las {dayjs().format("HH:mm")} hs
                  </p>
                </div>
              </div>

              {weeklyUri === "api" && (
                <button
                  type="button"
                  onClick={() => {
                    setWeeklyUri(null);
                    setWeeklyName(null);
                    setLoadedWeeklyRows(null);
                    setLoadedWeeklyType(null);
                    setStatusText("");
                  }}
                  className="px-2 py-1 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Saved Weekly Card (if present) */}
        {savedWeekly && (
          <div
            onClick={() => {
              if (weeklyUri && !useSavedWeekly) return;
              setUseSavedWeekly(!useSavedWeekly);
            }}
            className={`cursor-pointer p-3.5 rounded-2xl border transition-all ${
              useSavedWeekly
                ? "border-rose-500/60 bg-rose-50/50 dark:bg-rose-950/20"
                : "border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-950/30 hover:border-slate-300 dark:hover:border-zinc-700"
            } ${weeklyUri ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    useSavedWeekly
                      ? "bg-rose-600 text-white"
                      : "bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                  }`}
                >
                  <Calendar size={14} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                      Último Reporte Guardado en Nube
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500">
                      ({dayjs(savedWeekly.savedAt).format("DD/MM/YYYY HH:mm")})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {useSavedWeekly
                      ? "✓ Usando reporte guardado en base de datos. No se requiere subir archivo."
                      : "Hacé click para usar la programación previamente guardada"}
                  </p>
                </div>
              </div>

              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                  useSavedWeekly
                    ? "bg-rose-600 border-rose-600 text-white"
                    : "border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                }`}
              >
                {useSavedWeekly && <span className="text-xs font-black">✓</span>}
              </div>
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-slate-100 dark:bg-zinc-800" />

        {/* Day Selector Section */}
        <div>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-zinc-100 flex items-center gap-2 mb-2.5">
            <Clock size={15} className="text-rose-600 dark:text-rose-400" />
            2. Día de Programación a Generar
          </h2>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {DAYS.map((day) => {
              const active = selectedDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`flex-1 min-w-[70px] sm:min-w-[80px] py-2 px-2.5 rounded-xl text-center text-xs font-bold transition-all ${
                    active
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-zinc-800 border border-slate-200/60 dark:border-zinc-800"
                  }`}
                >
                  <span className="block uppercase text-[11px] font-black tracking-wider">
                    {WEEKDAY_LABELS[day].substring(0, 3)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100 dark:bg-zinc-800" />

        {/* Floors & Credits Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Floors Toggle */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 block">
                    División por Pisos
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                    Separa salas en el dorso para imprimir
                  </span>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useFloors}
                  onChange={(e) => setUseFloors(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-300 dark:bg-zinc-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
              </label>
            </div>

            {useFloors && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">
                    Cantidad de Pisos:
                  </span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNumFloors(n)}
                        className={`w-7 h-7 rounded-lg text-xs font-black transition-colors ${
                          numFloors === n
                            ? "bg-indigo-600 text-white"
                            : "bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {Array.from({ length: numFloors }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs"
                    >
                      <span className="font-bold text-slate-700 dark:text-zinc-300 text-[11px]">
                        Piso {i + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">Salas:</span>
                        <input
                          type="number"
                          value={floorRanges[i].from}
                          onChange={(e) => {
                            const n = [...floorRanges];
                            n[i].from = e.target.value;
                            setFloorRanges(n);
                          }}
                          className="w-12 text-center py-0.5 rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 font-bold text-xs text-slate-800 dark:text-zinc-200"
                        />
                        <span className="text-[10px] text-slate-400">a</span>
                        <input
                          type="number"
                          value={floorRanges[i].to}
                          onChange={(e) => {
                            const n = [...floorRanges];
                            n[i].to = e.target.value;
                            setFloorRanges(n);
                          }}
                          className="w-12 text-center py-0.5 rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 font-bold text-xs text-slate-800 dark:text-zinc-200"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Credits Toggle */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-amber-500" />
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 block">
                    Imprimir con Créditos
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                    Columna de créditos con hora reloj calculada
                  </span>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCreditos}
                  onChange={(e) => setIncludeCreditos(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-300 dark:bg-zinc-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            {includeCreditos && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800/80">
                <p className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed font-medium">
                  💡 <span className="font-bold">Aclaración:</span> Los minutos de créditos para el cálculo se toman automáticamente de lo registrado por el equipo de Proyección.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Generation Buttons */}
        <div className="pt-2 space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              disabled={!canGenerate || loading}
              onClick={handleGenerate}
              className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs tracking-wider uppercase transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download size={15} />
              {loading
                ? "Generando Excel..."
                : includeCreditos
                ? `Generar Excel Día con Créditos (${selectedDay.toUpperCase()})`
                : `Generar Excel Día (${selectedDay.toUpperCase()})`}
            </button>

            <button
              type="button"
              disabled={!canGenerate || loading}
              onClick={handleGenerateWeekly}
              className="py-3 px-4 rounded-xl border border-emerald-500/80 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/60 font-black text-xs tracking-wider uppercase transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              {includeCreditos ? "Descargar Semana con Créditos" : "Descargar Semana Completa"}
            </button>
          </div>

          {statusText && (
            <p className="text-center text-xs font-bold text-rose-600 dark:text-rose-400">
              {statusText}
            </p>
          )}
        </div>
      </div>

      {/* Summary Card (If generated) */}
      {summary && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
              Reporte de Generación Exitosa
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
              OK
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800 text-center">
              <span className="text-xl font-black text-slate-900 dark:text-zinc-100">{summary.entrada}</span>
              <span className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">
                Entradas
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800 text-center">
              <span className="text-xl font-black text-rose-600 dark:text-rose-400">{summary.salida}</span>
              <span className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">
                Salidas
              </span>
            </div>
          </div>

          <p className="text-[11px] text-center text-slate-400 dark:text-zinc-500 font-mono truncate">
            {summary.fileName}
          </p>
        </div>
      )}

      {/* Preview Section */}
      {(useSavedWeekly ? !!savedWeekly : !!loadedWeeklyRows) && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film size={16} className="text-rose-600 dark:text-rose-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-zinc-100">
                Vista Previa: {WEEKDAY_LABELS[selectedDay]}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPreview ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {showPreview && (
            <div>
              {previewData.entrada.length === 0 && previewData.salida.length === 0 ? (
                <p className="text-center text-xs text-slate-400 dark:text-zinc-500 py-8">
                  Sin funciones programadas para este día en el reporte.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* ENTRADAS */}
                  <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/50 px-3 py-2 text-center font-black text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                      Entradas (Ingresos)
                    </div>
                    <div className="grid grid-cols-12 bg-slate-100 dark:bg-zinc-950 px-3 py-1.5 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800">
                      <div className="col-span-2 text-center">Inicio</div>
                      <div className="col-span-2 text-center">Sala</div>
                      <div className="col-span-6 pl-2">Película</div>
                      <div className="col-span-2 text-center">Calif</div>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                      {previewData.entrada.map((show, idx) => (
                        <div
                          key={`in-${idx}`}
                          className="grid grid-cols-12 px-3 py-2 items-center hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                        >
                          <div className="col-span-2 text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {show.inicio}
                          </div>
                          <div className="col-span-2 text-center font-extrabold text-slate-800 dark:text-zinc-200">
                            {show.sala}
                          </div>
                          <div className="col-span-6 pl-2 font-semibold text-slate-900 dark:text-zinc-100 truncate">
                            {show.pelicula}
                          </div>
                          <div className="col-span-2 text-center text-[10px] text-slate-500 dark:text-zinc-400">
                            {show.calificacion || "-"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SALIDAS */}
                  <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/50 px-3 py-2 text-center font-black text-xs text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                      Salidas (Egresos)
                    </div>
                    <div className="grid grid-cols-12 bg-slate-100 dark:bg-zinc-950 px-3 py-1.5 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800">
                      <div className="col-span-2 text-center">Sala</div>
                      {includeCreditos ? (
                        <>
                          <div className="col-span-2 text-center text-amber-600 dark:text-amber-400">Créditos</div>
                          <div className="col-span-2 text-center">Fin</div>
                          <div className="col-span-6 pl-2">Película</div>
                        </>
                      ) : (
                        <>
                          <div className="col-span-3 text-center">Fin</div>
                          <div className="col-span-7 pl-2">Película</div>
                        </>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                      {previewData.salida.map((show, idx) => (
                        <div
                          key={`out-${idx}`}
                          className="grid grid-cols-12 px-3 py-2 items-center hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                        >
                          <div className="col-span-2 text-center font-extrabold text-slate-800 dark:text-zinc-200">
                            {show.sala}
                          </div>
                          {includeCreditos ? (
                            <>
                              <div className="col-span-2 text-center font-bold text-amber-600 dark:text-amber-400 font-mono text-[11px]">
                                {show.creditosHoraReloj || "-"}
                              </div>
                              <div className="col-span-2 text-center font-bold text-rose-600 dark:text-rose-400 font-mono">
                                {show.fin}
                              </div>
                              <div className="col-span-6 pl-2 font-semibold text-slate-900 dark:text-zinc-100 truncate">
                                {show.pelicula}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="col-span-3 text-center font-bold text-rose-600 dark:text-rose-400 font-mono">
                                {show.fin}
                              </div>
                              <div className="col-span-7 pl-2 font-semibold text-slate-900 dark:text-zinc-100 truncate">
                                {show.pelicula}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
