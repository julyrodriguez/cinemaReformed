import {
  Timestamp,
  updateDoc,
  doc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit as qLimit,
  getDocs,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "@/lib/dbService";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Coffee,
  Disc,
  Edit3,
  Film,
  KeyRound,
  Layers,
  Loader2,
  Plus,
  Popcorn,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { crearEvento } from "../lib/eventos";
import { buildSalasFromCount, getCineConfig } from "../lib/cineConfig";
import { CINES_COLLECTION, db } from "../lib/firebaseConfig";
import { useAuthUser } from "../lib/useAuthUser";
import SEOHead from "@/components/SEOHead";
import {
  formatDateInput,
  formatTimeInput,
  parseWebDate,
  parseWebTime,
  horaCorta,
  todayAt,
  toDate,
  pad2,
  DIAS_SEMANA_FULL,
  MESES_ABBR,
} from "@/shared/utils";

type Evento = {
  id: string;
  pelicula: string;
  sala: string;
  diaHora: Date;
  kdm?: boolean;
  dcp?: boolean;
  desayuno?: boolean;
  combo?: boolean;
  createdAt?: any;
  duracion?: number;
};

const PAGE = 12;

export default function EventosScreen() {
  const { cineId, loading: sessionLoading } = useAuthUser();

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const [salasCount, setSalasCount] = useState(12);
  const [salasLoading, setSalasLoading] = useState(true);

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Evento | null>(null);

  const [cFechaWeb, setCFechaWeb] = useState(formatDateInput(todayAt(11)));
  const [cHoraWeb, setCHoraWeb] = useState(formatTimeInput(todayAt(11)));

  const [editFechaWeb, setEditFechaWeb] = useState(formatDateInput(todayAt(11)));
  const [editHoraWeb, setEditHoraWeb] = useState(formatTimeInput(todayAt(11)));

  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const colRef = useMemo(() => {
    if (!cineId) return null;
    return collection(db, CINES_COLLECTION, cineId, "eventos");
  }, [cineId]);

  const SALAS = useMemo(() => buildSalasFromCount(salasCount), [salasCount]);
  const isSalaValida = (s: string) => {
    if (!s) return false;
    const parts = s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length === 0) return false;
    return parts.every((part) => SALAS.includes(part));
  };

  const abrirConfirmarBorrado = (item: Evento) => {
    setDeleteItem(item);
    setDeleteVisible(true);
  };

  const cerrarConfirmarBorrado = () => {
    setDeleteVisible(false);
    setDeleteItem(null);
  };

  const loadCineConfig = async () => {
    if (!cineId) {
      setSalasLoading(false);
      return;
    }

    try {
      setSalasLoading(true);
      const cfg = await getCineConfig(cineId);
      const nextCount = cfg?.salasCount && cfg.salasCount > 0 ? cfg.salasCount : 12;
      setSalasCount(nextCount);
    } catch (e) {
      console.error(e);
      setSalasCount(12);
    } finally {
      setSalasLoading(false);
    }
  };

  const loadFirstPage = async () => {
    if (sessionLoading) {
      setLoading(true);
      return;
    }

    if (!cineId || !colRef) {
      setEventos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const threshold = new Date(now.getTime() - 60 * 60 * 1000);

      const qy = query(
        colRef,
        where("diaHora", ">=", threshold),
        orderBy("diaHora", "asc"),
        qLimit(PAGE)
      );

      const snap = await getDocs(qy);

      const rows = snap.docs.map((d) => {
        const data = d.data() as any;
        const diaHora = toDate(data.diaHora);

        return {
          id: d.id,
          pelicula: data.pelicula || "",
          sala: String(data.sala ?? ""),
          kdm: !!data.kdm,
          dcp: !!data.dcp,
          desayuno: !!data.desayuno,
          combo: !!data.combo,
          diaHora,
          duracion:
            data.duracion !== undefined && data.duracion !== null
              ? Number(data.duracion)
              : undefined,
        } as Evento;
      });

      setEventos(rows);
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === PAGE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || !lastDocRef.current || !cineId || !colRef) return;

    try {
      const now = new Date();
      const threshold = new Date(now.getTime() - 60 * 60 * 1000);

      const qy = query(
        colRef,
        where("diaHora", ">=", threshold),
        orderBy("diaHora", "asc"),
        startAfter(lastDocRef.current),
        qLimit(PAGE)
      );

      const snap = await getDocs(qy);

      const extra = snap.docs.map((d) => {
        const data = d.data() as any;
        const diaHora = toDate(data.diaHora);

        return {
          id: d.id,
          pelicula: data.pelicula || "",
          sala: String(data.sala ?? ""),
          kdm: !!data.kdm,
          dcp: !!data.dcp,
          desayuno: !!data.desayuno,
          combo: !!data.combo,
          diaHora,
          duracion:
            data.duracion !== undefined && data.duracion !== null
              ? Number(data.duracion)
              : undefined,
        } as Evento;
      });

      setEventos((prev) => prev.concat(extra));
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === PAGE);
    } catch (e) {
      console.error(e);
    }
  };

  const ejecutarBorrado = async () => {
    if (!deleteItem || !cineId) return;

    try {
      await deleteDoc(doc(db, CINES_COLLECTION, cineId, "eventos", deleteItem.id));
      cerrarConfirmarBorrado();
      await loadFirstPage();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCineConfig();
  }, [cineId]);

  useEffect(() => {
    loadFirstPage();
  }, [cineId, sessionLoading]);

  // ── Create Event State ──
  const [createVisible, setCreateVisible] = useState(false);
  const [cPelicula, setCPelicula] = useState("");
  const [cSala, setCSala] = useState("");
  const [cDuracion, setCDuracion] = useState("");
  const [cIsMultiSelect, setCIsMultiSelect] = useState(false);
  const [cFechaHora, setCFechaHora] = useState<Date>(todayAt(11));
  const [cKdm, setCKdm] = useState(false);
  const [cDcp, setCDcp] = useState(false);
  const [cDesayuno, setCDesayuno] = useState(false);
  const [cCombo, setCCombo] = useState(false);
  const [createError, setCreateError] = useState("");
  const [saving, setSaving] = useState(false);

  const abrirCrear = () => {
    const base = todayAt(11);
    setCPelicula("");
    setCSala("");
    setCDuracion("");
    setCIsMultiSelect(false);
    setCFechaHora(base);
    setCFechaWeb(formatDateInput(base));
    setCHoraWeb(formatTimeInput(base));
    setCKdm(false);
    setCDcp(false);
    setCDesayuno(false);
    setCCombo(false);
    setCreateError("");
    setSaving(false);
    setCreateVisible(true);
  };

  const cerrarCrear = () => {
    setCreateVisible(false);
    setCreateError("");
    setSaving(false);
  };

  const onChangeFechaWeb = (text: string) => {
    setCFechaWeb(text);
    const parsedDate = parseWebDate(text);
    if (!parsedDate) return;

    const merged = new Date(cFechaHora);
    merged.setFullYear(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate()
    );
    setCFechaHora(merged);
  };

  const onChangeHoraWeb = (text: string) => {
    setCHoraWeb(text);
    const parsedTime = parseWebTime(text);
    if (!parsedTime) return;

    const merged = new Date(cFechaHora);
    merged.setHours(parsedTime.h, parsedTime.min, 0, 0);
    setCFechaHora(merged);
  };

  const guardarNuevoEvento = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setCreateError("");

    if (!cPelicula.trim()) {
      setCreateError("Ingresá el título de la película o evento.");
      return;
    }

    if (!isSalaValida(cSala)) {
      setCreateError(`Seleccioná al menos una sala entre 1 y ${salasCount} o AC.`);
      return;
    }

    if (!parseWebDate(cFechaWeb)) {
      setCreateError("Fecha inválida. Usá formato YYYY-MM-DD.");
      return;
    }
    if (!parseWebTime(cHoraWeb)) {
      setCreateError("Hora inválida. Usá formato HH:mm.");
      return;
    }

    if (cDuracion.trim() && isNaN(Number(cDuracion))) {
      setCreateError("La duración debe ser un número en minutos.");
      return;
    }

    if (!cineId) {
      setCreateError("Sesión no lista. Reintentá en unos segundos.");
      return;
    }

    setSaving(true);
    try {
      await crearEvento(
        {
          diaHora: cFechaHora,
          pelicula: cPelicula.trim(),
          sala: cSala.trim(),
          kdm: cKdm,
          dcp: cDcp,
          desayuno: cDesayuno,
          combo: cCombo,
          duracion: cDuracion.trim() ? Number(cDuracion) : undefined,
        },
        cineId
      );

      cerrarCrear();
      await loadFirstPage();
    } catch (err: any) {
      setCreateError(err?.message ?? "No se pudo crear el evento.");
    } finally {
      setSaving(false);
    }
  };

  // ── Edit Event State ──
  const [editVisible, setEditVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPelicula, setEditPelicula] = useState("");
  const [editSala, setEditSala] = useState("");
  const [editDuracion, setEditDuracion] = useState("");
  const [editIsMultiSelect, setEditIsMultiSelect] = useState(false);
  const [editKdm, setEditKdm] = useState(false);
  const [editDcp, setEditDcp] = useState(false);
  const [editDesayuno, setEditDesayuno] = useState(false);
  const [editCombo, setEditCombo] = useState(false);
  const [editFechaHora, setEditFechaHora] = useState<Date>(todayAt(11));
  const [editError, setEditError] = useState("");

  const abrirEdicion = (item: Evento) => {
    const fecha = item.diaHora instanceof Date ? item.diaHora : toDate(item.diaHora);

    setEditId(item.id);
    setEditPelicula(item.pelicula || "");
    const roomStr = String(item.sala ?? "");
    setEditSala(roomStr);
    setEditDuracion(
      item.duracion !== undefined && item.duracion !== null ? String(item.duracion) : ""
    );
    setEditIsMultiSelect(roomStr.includes(","));
    setEditKdm(!!item.kdm);
    setEditDcp(!!item.dcp);
    setEditDesayuno(!!item.desayuno);
    setEditCombo(!!item.combo);
    setEditFechaHora(fecha);
    setEditFechaWeb(formatDateInput(fecha));
    setEditHoraWeb(formatTimeInput(fecha));
    setEditError("");
    setSaving(false);
    setEditVisible(true);
  };

  const cerrarEdicion = () => {
    setEditVisible(false);
    setEditId(null);
    setEditPelicula("");
    setEditError("");
    setSaving(false);
  };

  const onChangeEditFechaWeb = (text: string) => {
    setEditFechaWeb(text);
    const parsedDate = parseWebDate(text);
    if (!parsedDate) return;

    const merged = new Date(editFechaHora);
    merged.setFullYear(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate()
    );
    setEditFechaHora(merged);
  };

  const onChangeEditHoraWeb = (text: string) => {
    setEditHoraWeb(text);
    const parsedTime = parseWebTime(text);
    if (!parsedTime) return;

    const merged = new Date(editFechaHora);
    merged.setHours(parsedTime.h, parsedTime.min, 0, 0);
    setEditFechaHora(merged);
  };

  const guardarEdicion = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editId || !cineId) return;

    setEditError("");

    if (!editPelicula.trim()) {
      setEditError("El título o nombre del evento es obligatorio.");
      return;
    }

    if (!isSalaValida(editSala)) {
      setEditError(`Seleccioná al menos una sala entre 1 y ${salasCount} o AC.`);
      return;
    }

    if (!parseWebDate(editFechaWeb)) {
      setEditError("Fecha inválida. Usá formato YYYY-MM-DD.");
      return;
    }
    if (!parseWebTime(editHoraWeb)) {
      setEditError("Hora inválida. Usá formato HH:mm.");
      return;
    }

    if (editDuracion.trim() && isNaN(Number(editDuracion))) {
      setEditError("La duración debe ser un número de minutos.");
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, CINES_COLLECTION, cineId, "eventos", editId), {
        pelicula: editPelicula.trim(),
        sala: editSala,
        kdm: editKdm,
        dcp: editDcp,
        desayuno: editDesayuno,
        combo: editCombo,
        diaHora: Timestamp.fromDate(editFechaHora),
        timestamp: editFechaHora.getTime(),
        duracion: editDuracion.trim() ? Number(editDuracion) : null,
      });

      cerrarEdicion();
      await loadFirstPage();
    } catch (err: any) {
      setEditError(err?.message ?? "No se pudo actualizar.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSalaSelection = (
    salaItem: string,
    currentVal: string,
    isMulti: boolean,
    setter: (v: string) => void
  ) => {
    if (isMulti) {
      const currentRooms = currentVal
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      let newRooms: string[];
      if (currentRooms.includes(salaItem)) {
        newRooms = currentRooms.filter((x) => x !== salaItem);
      } else {
        newRooms = [...currentRooms, salaItem];
      }
      newRooms.sort((a, b) => {
        if (a === "AC") return 1;
        if (b === "AC") return -1;
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (isNaN(numA) && isNaN(numB)) return a.localeCompare(b);
        if (isNaN(numA)) return 1;
        if (isNaN(numB)) return -1;
        return numA - numB;
      });
      setter(newRooms.join(", "));
    } else {
      setter(salaItem);
    }
  };

  if (loading || salasLoading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-2.5">
        <Loader2 className="h-6 w-6 animate-spin text-rose-600 dark:text-rose-500" />
        <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
          Cargando agenda de eventos…
        </span>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Eventos y Funciones Especiales | Cines"
        description="Gestión, programación y seguimiento de eventos corporativos, avant-premieres y funciones especiales en salas de cine."
        pathname="/eventos"
      />

      <main className="mx-auto w-full max-w-5xl pb-24 pt-1">
        {/* Top Header Bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/50">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                  Agenda de Eventos y Funciones Especiales
                </h1>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {eventos.length} {eventos.length === 1 ? "próximo" : "próximos"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Seguimiento en tiempo real de KDMs, copias DCP, catering y asignación de salas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={abrirCrear}
            className="group inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700"
          >
            <CalendarPlus className="h-3.5 w-3.5 transition-transform duration-150 group-hover:scale-110" />
            <span>Programar Evento</span>
          </button>
        </div>

        {/* Subtle Feature Callout */}
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-violet-200/70 bg-violet-50/60 px-3.5 py-2 text-xs text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/25 dark:text-violet-200">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              <Sparkles className="h-2.5 w-2.5" /> Nuevo
            </span>
            <span className="font-medium">
              Podés indicar la <strong>duración en minutos</strong> al crear o editar cada evento para reflejarla automáticamente en la grilla de programación.
            </span>
          </div>
        </div>

        {/* Events List */}
        {eventos.length === 0 ? (
          <div className="animate-card-in flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
              <Calendar className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Sin eventos programados
            </h3>
            <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-zinc-400">
              No hay funciones privadas, avant-premieres ni eventos activos cargados para los próximos días.
            </p>
            <button
              type="button"
              onClick={abrirCrear}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Crear primer evento</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {eventos.map((item, index) => {
              const d = item.diaHora instanceof Date ? item.diaHora : toDate(item.diaHora);
              const valid = !isNaN(d.getTime());
              const dia = DIAS_SEMANA_FULL[d.getDay()];
              const mes = MESES_ABBR[d.getMonth()];
              const hora = valid ? horaCorta(d) : "--:--";
              const salasArr = String(item.sala || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

              return (
                <div
                  key={item.id}
                  style={{ animationDelay: `${Math.min(index * 35, 280)}ms` }}
                  className="animate-card-in hover-lift group relative flex flex-col justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-300 dark:border-zinc-800/90 dark:bg-zinc-900 dark:hover:border-zinc-700 sm:flex-row sm:items-center"
                >
                  {/* Left: Date Ticket + Main Info */}
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    {/* Architectural Date Ticket */}
                    <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/90 py-2 text-center dark:border-zinc-800 dark:bg-zinc-950">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {dia?.slice(0, 3)}
                      </span>
                      <span className="my-0.5 text-xl font-extrabold leading-none tracking-tight text-slate-900 dark:text-zinc-100">
                        {valid ? pad2(d.getDate()) : "—"}
                      </span>
                      <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-zinc-400">
                        {mes}
                      </span>
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-rose-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                        {hora}
                      </span>
                    </div>

                    {/* Title + Badges */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-slate-900 dark:text-zinc-100">
                          {item.pelicula}
                        </h3>
                        {item.duracion ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300">
                            <Clock className="h-2.5 w-2.5" />
                            {item.duracion} min
                          </span>
                        ) : null}
                      </div>

                      {/* 4-Pill Status Matrix */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {/* KDM */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                            item.kdm
                              ? "border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                          }`}
                        >
                          <KeyRound className="h-3 w-3" />
                          {item.kdm ? "KDM OK" : "Pendiente KDM"}
                        </span>

                        {/* DCP */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                            item.dcp
                              ? "border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                          }`}
                        >
                          <Disc className="h-3 w-3" />
                          {item.dcp ? "DCP OK" : "Pendiente DCP"}
                        </span>

                        {/* Desayuno */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                            item.desayuno
                              ? "border-sky-200 bg-sky-50/80 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300"
                              : "border-slate-200/80 bg-slate-50 text-slate-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500"
                          }`}
                        >
                          <Coffee className="h-3 w-3" />
                          {item.desayuno ? "Con desayuno" : "Sin desayuno"}
                        </span>

                        {/* Combo */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                            item.combo
                              ? "border-sky-200 bg-sky-50/80 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300"
                              : "border-slate-200/80 bg-slate-50 text-slate-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500"
                          }`}
                        >
                          <Popcorn className="h-3 w-3" />
                          {item.combo ? "Con combo" : "Sin combo"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Room Badge + Quick Actions */}
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5 dark:border-zinc-800/80 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                    <div className="flex flex-col items-start sm:items-center">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                        {salasArr.length > 1 ? "SALAS" : "SALA"}
                      </span>
                      {salasArr.length > 1 ? (
                        <div className="mt-1 flex max-w-[110px] flex-wrap justify-center gap-1">
                          {salasArr.map((s, idx) => (
                            <span
                              key={idx}
                              className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-mono text-xs font-extrabold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-300"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-mono text-2xl font-black leading-none text-rose-600 dark:text-rose-400">
                          {item.sala || "—"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => abrirEdicion(item)}
                        title="Editar evento"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirConfirmarBorrado(item)}
                        title="Eliminar evento"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <span>Cargar más eventos</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── DELETE CONFIRM MODAL ── */}
        {deleteVisible && (
          <div className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
            <div className="animate-modal-in w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Eliminar evento
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                {deleteItem
                  ? `¿Confirmás que querés eliminar "${deleteItem.pelicula}" (Sala ${deleteItem.sala})? Esta acción no se puede deshacer.`
                  : "¿Querés eliminar este evento?"}
              </p>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={cerrarConfirmarBorrado}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={ejecutarBorrado}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CREATE / EDIT MODAL ── */}
        {(createVisible || editVisible) && (
          <div className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs">
            <div className="animate-modal-in flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                    <Film className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      {createVisible ? "Programar Nuevo Evento" : "Editar Evento"}
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Configurá sala, horario, duración y requerimientos técnicos
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={createVisible ? cerrarCrear : cerrarEdicion}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <form
                onSubmit={createVisible ? guardarNuevoEvento : guardarEdicion}
                className="flex-1 space-y-4 overflow-y-auto p-5"
              >
                {/* Title + Duration Row */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Película o Evento *
                    </label>
                    <input
                      type="text"
                      value={createVisible ? cPelicula : editPelicula}
                      onChange={(e) =>
                        createVisible
                          ? setCPelicula(e.target.value)
                          : setEditPelicula(e.target.value)
                      }
                      placeholder="Ej: Avant Premiere Batman / Evento Corp."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Duración (min)
                    </label>
                    <input
                      type="number"
                      value={createVisible ? cDuracion : editDuracion}
                      onChange={(e) =>
                        createVisible
                          ? setCDuracion(e.target.value)
                          : setEditDuracion(e.target.value)
                      }
                      placeholder="Ej: 120"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* Date & Time Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Fecha de Función *
                    </label>
                    <input
                      type="date"
                      value={createVisible ? cFechaWeb : editFechaWeb}
                      onChange={(e) =>
                        createVisible
                          ? onChangeFechaWeb(e.target.value)
                          : onChangeEditFechaWeb(e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Horario (24h) *
                    </label>
                    <input
                      type="time"
                      value={createVisible ? cHoraWeb : editHoraWeb}
                      onChange={(e) =>
                        createVisible
                          ? onChangeHoraWeb(e.target.value)
                          : onChangeEditHoraWeb(e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* Room Selector */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Asignación de Sala (1–{salasCount} o AC) *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (createVisible) {
                          const next = !cIsMultiSelect;
                          setCIsMultiSelect(next);
                          if (!next) {
                            const first = cSala
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean)[0];
                            setCSala(first || "");
                          }
                        } else {
                          const next = !editIsMultiSelect;
                          setEditIsMultiSelect(next);
                          if (!next) {
                            const first = editSala
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean)[0];
                            setEditSala(first || "");
                          }
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-rose-400"
                    >
                      <Layers className="h-3 w-3" />
                      <span>
                        {(createVisible ? cIsMultiSelect : editIsMultiSelect)
                          ? "Modo sala única"
                          : "Seleccionar varias salas"}
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
                    {SALAS.map((s) => {
                      const currentVal = createVisible ? cSala : editSala;
                      const isMulti = createVisible ? cIsMultiSelect : editIsMultiSelect;
                      const selected = isMulti
                        ? currentVal
                            .split(",")
                            .map((x) => x.trim())
                            .includes(s)
                        : s === currentVal;

                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            toggleSalaSelection(
                              s,
                              currentVal,
                              isMulti,
                              createVisible ? setCSala : setEditSala
                            )
                          }
                          className={`flex h-8 items-center justify-center rounded-lg border text-xs font-bold transition-all ${
                            selected
                              ? "border-rose-600 bg-rose-600 text-white shadow-xs"
                              : "border-slate-200 bg-slate-50/70 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {s === "AC" ? "AC" : `S${s}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2x2 Interactive Requirements Matrix */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Checklist Técnico y Catering
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        label: "Tenemos KDM",
                        sub: "Llave activa",
                        icon: KeyRound,
                        checked: createVisible ? cKdm : editKdm,
                        onChange: createVisible ? setCKdm : setEditKdm,
                      },
                      {
                        label: "Tenemos DCP",
                        sub: "Copia en ingesta",
                        icon: Disc,
                        checked: createVisible ? cDcp : editDcp,
                        onChange: createVisible ? setCDcp : setEditDcp,
                      },
                      {
                        label: "Lleva Desayuno",
                        sub: "Servicio catering",
                        icon: Coffee,
                        checked: createVisible ? cDesayuno : editDesayuno,
                        onChange: createVisible ? setCDesayuno : setEditDesayuno,
                      },
                      {
                        label: "Lleva Combo",
                        sub: "Candy bar",
                        icon: Popcorn,
                        checked: createVisible ? cCombo : editCombo,
                        onChange: createVisible ? setCCombo : setEditCombo,
                      },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => opt.onChange(!opt.checked)}
                          className={`flex items-center justify-between rounded-xl border p-2.5 text-left transition-all ${
                            opt.checked
                              ? "border-emerald-500/70 bg-emerald-50/60 text-emerald-900 dark:border-emerald-600/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                              : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100/70 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                                opt.checked
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200/70 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <div className="text-xs font-bold leading-tight">{opt.label}</div>
                              <div className="text-[10px] opacity-75">{opt.sub}</div>
                            </div>
                          </div>
                          <CheckCircle2
                            className={`h-4 w-4 transition-transform ${
                              opt.checked
                                ? "scale-100 text-emerald-600 dark:text-emerald-400"
                                : "scale-90 opacity-25"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(createVisible ? createError : editError) && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400">
                    {createVisible ? createError : editError}
                  </div>
                )}

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3.5 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={createVisible ? cerrarCrear : cerrarEdicion}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{createVisible ? "Crear Evento" : "Guardar Cambios"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
