import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  startAfter,
  startAt,
  endAt,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "@/lib/dbService";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Disc,
  Edit3,
  HardDrive,
  Languages,
  Loader2,
  MapPin,
  PackageCheck,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";

import { db, CINES_COLLECTION } from "../lib/firebaseConfig";
import { getCineConfig } from "../lib/cineConfig";
import { useAuthUser } from "../lib/useAuthUser";
import { Dcp } from "../lib/types";
import SEOHead from "@/components/SEOHead";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const formatDate = (isoStr: string) => {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  if (parts.length !== 3) return isoStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatDiscoLabel = (disco: string) => {
  if (!disco) return "";
  const val = disco.trim();
  const lower = val.toLowerCase();
  if (lower === "satelite" || lower === "satélite") return "Satélite";
  if (lower.startsWith("disco") || lower.startsWith("#")) return val;
  return `Disco #${val}`;
};

export default function DcpScreen({ readOnly = false }: { readOnly?: boolean }) {
  const { user, cineId, loading: sessionLoading } = useAuthUser();

  const [loading, setLoading] = useState(true);
  const [activos, setActivos] = useState<Dcp[]>([]);
  const [viewMode, setViewMode] = useState<"ACTIVOS" | "HISTORIAL">("ACTIVOS");
  const [activeSearch, setActiveSearch] = useState("");

  /* ── historial pagination & search ── */
  const [retirados, setRetirados] = useState<Dcp[]>([]);
  const [loadingRetirados, setLoadingRetirados] = useState(false);
  const [hasMoreRetirados, setHasMoreRetirados] = useState(false);
  const [lastRetRef, setLastRetRef] = useState<any>(null);
  const [historialSearch, setHistorialSearch] = useState("");
  const searchTimer = useRef<any>(null);
  const HISTORIAL_PAGE = 12;

  /* ── form state ── */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formNombre, setFormNombre] = useState("");
  const [formNumeroDisco, setFormNumeroDisco] = useState("");
  const [formEsSatelite, setFormEsSatelite] = useState(false);
  const [formUbicacion, setFormUbicacion] = useState("TMS");
  const [formCargadoPor, setFormCargadoPor] = useState("");
  const [formSub, setFormSub] = useState(true);
  const [formCas, setFormCas] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  /* ── ubicación options & persisted names ── */
  const [ubicacionOptions, setUbicacionOptions] = useState<string[]>(["TMS"]);
  const [nombresCargadores, setNombresCargadores] = useState<string[]>([]);

  /* ── confirmations ── */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dcpToDelete, setDcpToDelete] = useState<Dcp | null>(null);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [dcpToRetire, setDcpToRetire] = useState<Dcp | null>(null);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDateISO, setCustomDateISO] = useState(todayISO());

  useEffect(() => {
    if (!cineId) return;
    (async () => {
      try {
        const config = await getCineConfig(cineId);
        if (config && config.salasCount > 0) {
          const salas = Array.from({ length: config.salasCount }, (_, i) => `Sala ${i + 1}`);
          setUbicacionOptions(["TMS", ...salas]);
        } else {
          setUbicacionOptions(["TMS"]);
        }
      } catch (e) {
        console.error("Error loading cine config for DCP:", e);
        setUbicacionOptions(["TMS"]);
      }
    })();
  }, [cineId]);

  useEffect(() => {
    if (!cineId) return;
    (async () => {
      try {
        const ref = doc(db, CINES_COLLECTION, cineId, "info", "dcpNombres");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const list = Array.isArray(data.nombres) ? (data.nombres as string[]) : [];
          setNombresCargadores(list);
        }
      } catch (e) {
        console.error("Error loading DCP nombres:", e);
      }
    })();
  }, [cineId]);

  const persistNombre = async (nombre: string) => {
    if (!cineId || !nombre.trim()) return;
    const trimmed = nombre.trim();
    if (nombresCargadores.includes(trimmed)) return;

    const updated = [...nombresCargadores, trimmed];
    setNombresCargadores(updated);

    try {
      const ref = doc(db, CINES_COLLECTION, cineId, "info", "dcpNombres");
      await setDoc(ref, { nombres: updated }, { merge: true });
    } catch (e) {
      console.error("Error persisting DCP nombre:", e);
    }
  };

  useEffect(() => {
    let unsub: any;

    (async () => {
      if (sessionLoading) {
        setLoading(true);
        return;
      }
      if (!user || !cineId) {
        setActivos([]);
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, CINES_COLLECTION, cineId, "dcp"),
        where("retirado", "==", false)
      );

      unsub = onSnapshot(
        q,
        (snap) => {
          const all = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })) as Dcp[];

          all.sort((a, b) => {
            const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tB - tA;
          });

          setActivos(all);
          setLoading(false);
        },
        (err) => {
          console.error("Activos listener err:", err);
          setLoading(false);
        }
      );
    })();

    return () => unsub && unsub();
  }, [user, cineId, sessionLoading]);

  const loadRetirados = async (isLoadMore = false, term = "") => {
    if (!cineId) return;

    try {
      setLoadingRetirados(true);
      const col = collection(db, CINES_COLLECTION, cineId, "dcp");
      const searchKey = term.trim().toUpperCase();
      let currentLastRef = isLoadMore ? lastRetRef : null;
      let accumulated: Dcp[] = [];
      let docsFetched = 0;
      let shouldKeepFetching = true;
      let iterations = 0;

      while (shouldKeepFetching && iterations < 8) {
        iterations++;
        let q;

        if (searchKey) {
          q = query(
            col,
            orderBy("nombre"),
            startAt(searchKey),
            endAt(searchKey + "\uf8ff"),
            ...(currentLastRef ? [startAfter(currentLastRef)] : []),
            limit(30)
          );
        } else {
          q = query(
            col,
            orderBy("fechaSalida", "desc"),
            ...(currentLastRef ? [startAfter(currentLastRef)] : []),
            limit(HISTORIAL_PAGE)
          );
        }

        const snap = await getDocs(q);
        if (snap.empty) {
          shouldKeepFetching = false;
          break;
        }

        docsFetched = snap.docs.length;
        currentLastRef = snap.docs[snap.docs.length - 1];

        const allFetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Dcp));
        const retiredItems = allFetched.filter((x) => x.retirado === true);
        accumulated = [...accumulated, ...retiredItems];

        const pageSize = searchKey ? 30 : HISTORIAL_PAGE;
        if (accumulated.length >= HISTORIAL_PAGE || docsFetched < pageSize) {
          shouldKeepFetching = false;
        }
      }

      if (isLoadMore) {
        setRetirados((prev) => {
          const map = new Map(prev.map((i) => [i.id, i]));
          accumulated.forEach((i) => map.set(i.id, i));
          return Array.from(map.values());
        });
      } else {
        setRetirados(accumulated);
      }

      setLastRetRef(currentLastRef);

      const pageSize = searchKey ? 30 : HISTORIAL_PAGE;
      setHasMoreRetirados(docsFetched === pageSize && accumulated.length > 0);
    } catch (e: any) {
      console.error("Historial error:", e);
    } finally {
      setLoadingRetirados(false);
    }
  };

  const handleSearchHistorial = (text: string) => {
    setHistorialSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadRetirados(false, text);
    }, 350);
  };

  const filteredActivos = useMemo(() => {
    const q = activeSearch.trim().toLowerCase();
    if (!q) return activos;
    return activos.filter(
      (item) =>
        (item.nombre || "").toLowerCase().includes(q) ||
        (item.numeroDisco || "").toLowerCase().includes(q) ||
        (item.ubicacion || "").toLowerCase().includes(q) ||
        (item.createdName || "").toLowerCase().includes(q)
    );
  }, [activos, activeSearch]);

  const openNew = () => {
    setEditingId(null);
    setFormNombre("");
    setFormNumeroDisco("");
    setFormEsSatelite(false);
    setFormUbicacion("TMS");
    setFormCargadoPor("");
    setFormSub(true);
    setFormCas(true);
    setFormError(null);
    setSaving(false);
    setShowForm(true);
  };

  const openEdit = (d: Dcp) => {
    setEditingId(d.id);
    setFormNombre(d.nombre);
    setFormUbicacion(d.ubicacion);
    setFormCargadoPor(d.createdName || "");
    setFormSub(d.sub !== false);
    setFormCas(d.cas !== false);

    const dLow = (d.numeroDisco || "").toLowerCase().trim();
    if (dLow === "satelite" || dLow === "satélite") {
      setFormEsSatelite(true);
      setFormNumeroDisco("");
    } else {
      setFormEsSatelite(false);
      setFormNumeroDisco(d.numeroDisco);
    }

    setFormError(null);
    setSaving(false);
    setShowForm(true);
  };

  const addDcp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !cineId) return;
    setFormError(null);

    if (!formNombre.trim()) {
      setFormError("Ingresá el título de la película / DCP.");
      return;
    }
    if (!formEsSatelite) {
      if (!formNumeroDisco.trim()) {
        setFormError("Ingresá el número de disco o seleccioná 'Satélite'.");
        return;
      }
      if (!/^\d+$/.test(formNumeroDisco.trim())) {
        setFormError("El número de disco solo debe contener dígitos numéricos.");
        return;
      }
    }
    if (!formCargadoPor.trim()) {
      setFormError("Indicá quién realizó la ingesta/carga del DCP.");
      return;
    }

    setSaving(true);
    try {
      const cargadoPor = formCargadoPor.trim();

      const changes = {
        nombre: formNombre.trim().toUpperCase(),
        numeroDisco: formEsSatelite ? "Satelite" : formNumeroDisco.trim(),
        ubicacion: formUbicacion,
        sub: formSub,
        cas: formCas,
        createdName: cargadoPor,
      };

      if (editingId) {
        await updateDoc(doc(db, CINES_COLLECTION, cineId, "dcp", editingId), changes);
      } else {
        await addDoc(collection(db, CINES_COLLECTION, cineId, "dcp"), {
          ...changes,
          fechaLlegada: todayISO(),
          fechaSalida: null,
          retirado: false,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        });
      }

      await persistNombre(cargadoPor);
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setFormError("No se pudo guardar la información del DCP.");
    } finally {
      setSaving(false);
    }
  };

  const retirarDcp = (d: Dcp) => {
    setDcpToRetire(d);
    setShowCustomDate(false);
    setCustomDateISO(todayISO());
    setShowRetireConfirm(true);
  };

  const confirmRetirar = async (fechaSalida: string) => {
    if (!dcpToRetire || !cineId) return;
    try {
      await updateDoc(doc(db, CINES_COLLECTION, cineId, "dcp", dcpToRetire.id), {
        retirado: true,
        fechaSalida,
      });
      setShowRetireConfirm(false);
      setShowCustomDate(false);
      setDcpToRetire(null);
      if (viewMode === "HISTORIAL") {
        loadRetirados(false, historialSearch);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("DCP", "No se pudo marcar como retirado.");
    }
  };

  const revertirDcp = async (d: Dcp) => {
    if (readOnly || !cineId) return;
    if (!window.confirm(`¿Devolver "${d.nombre}" a la lista de DCPs activos en complejo?`)) {
      return;
    }
    try {
      await updateDoc(doc(db, CINES_COLLECTION, cineId, "dcp", d.id), {
        retirado: false,
        fechaSalida: null,
      });
      setRetirados((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e) {
      console.error("ERROR REVERTIR:", e);
      Alert.alert("DCP", "No se pudo revertir el retiro.");
    }
  };

  const confirmRemoveDcp = async () => {
    if (!dcpToDelete || !cineId) return;
    try {
      await deleteDoc(doc(db, CINES_COLLECTION, cineId, "dcp", dcpToDelete.id));
      setRetirados((prev) => prev.filter((x) => x.id !== dcpToDelete.id));
      setShowDeleteConfirm(false);
      setDcpToDelete(null);
    } catch (e) {
      console.error(e);
      Alert.alert("DCP", "No se pudo eliminar.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-2.5">
        <Loader2 className="h-6 w-6 animate-spin text-rose-600 dark:text-rose-500" />
        <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
          Cargando inventario DCP…
        </span>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Control de DCP y KDM | Cines"
        description="Monitoreo, ingesta y control de copias digitales DCP y llaves de seguridad KDM para salas de cine."
        pathname="/dcp"
      />

      <main className="w-full pb-20">
        {/* Top Command Bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-3">
            {/* Segmented Switcher */}
            <div className="inline-flex rounded-lg border border-slate-200/80 bg-slate-100/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => setViewMode("ACTIVOS")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  viewMode === "ACTIVOS"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                <Disc className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                <span>En Complejo</span>
                <span className="rounded-full bg-rose-100 px-1.5 py-0.2 font-mono text-[10px] font-extrabold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                  {activos.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode("HISTORIAL");
                  if (retirados.length === 0) {
                    loadRetirados(false, historialSearch);
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  viewMode === "HISTORIAL"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                <Archive className="h-3.5 w-3.5 text-slate-500" />
                <span>Historial Retirados</span>
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-initial">
            <div className="relative w-full max-w-[240px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={viewMode === "ACTIVOS" ? activeSearch : historialSearch}
                onChange={(e) =>
                  viewMode === "ACTIVOS"
                    ? setActiveSearch(e.target.value)
                    : handleSearchHistorial(e.target.value)
                }
                placeholder={
                  viewMode === "ACTIVOS"
                    ? "Filtrar disco, película, sala…"
                    : "Buscar en historial…"
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              {(viewMode === "ACTIVOS" ? activeSearch : historialSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    if (viewMode === "ACTIVOS") {
                      setActiveSearch("");
                    } else {
                      setHistorialSearch("");
                      loadRetirados(false, "");
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={openNew}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Ingresar DCP</span>
              </button>
            )}
          </div>
        </div>

        {/* ── VIEW 1: ACTIVOS ── */}
        {viewMode === "ACTIVOS" && (
          <>
            {filteredActivos.length === 0 ? (
              <div className="animate-card-in flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
                  <HardDrive className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  {activeSearch ? "Sin coincidencias" : "Sin DCPs activos en complejo"}
                </h3>
                <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-zinc-400">
                  {activeSearch
                    ? "Probá con otro nombre o número de disco."
                    : "Registrá la llegada de discos físicos o descargas por satélite para llevar control de ingesta."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredActivos.map((item, idx) => {
                  const isSat =
                    (item.numeroDisco || "").toLowerCase().includes("satelite") ||
                    (item.numeroDisco || "").toLowerCase().includes("satélite");
                  const hasSub = item.sub !== false;
                  const hasCas = item.cas !== false;

                  return (
                    <div
                      key={item.id}
                      style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                      className="animate-card-in hover-lift group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-300 dark:border-zinc-800/90 dark:bg-zinc-900 dark:hover:border-zinc-700"
                    >
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-rose-600" />

                      <div>
                        {/* Title + Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-2 text-xs font-extrabold uppercase tracking-tight text-slate-900 dark:text-zinc-100">
                            {item.nombre}
                          </h3>

                          {!readOnly && (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                title="Editar DCP"
                                className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDcpToDelete(item);
                                  setShowDeleteConfirm(true);
                                }}
                                title="Eliminar DCP"
                                className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Chips Row */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                              isSat
                                ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300"
                                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                            }`}
                          >
                            {isSat ? (
                              <Radio className="h-3 w-3" />
                            ) : (
                              <HardDrive className="h-3 w-3" />
                            )}
                            {formatDiscoLabel(item.numeroDisco)}
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {item.ubicacion}
                          </span>

                          {hasSub && (
                            <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
                              SUB
                            </span>
                          )}
                          {hasCas && (
                            <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
                              CAS
                            </span>
                          )}
                        </div>

                        {/* Arrival & Operator */}
                        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5 text-[11px] dark:border-zinc-800/70 dark:bg-zinc-950/60">
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                            <ArrowDownLeft className="h-3 w-3" />
                            Llegó: {formatDate(item.fechaLlegada)}
                          </span>
                          {item.createdName && (
                            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-zinc-400">
                              <User className="h-3 w-3" />
                              {item.createdName}
                            </span>
                          )}
                        </div>
                      </div>

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => retirarDcp(item)}
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-600 dark:bg-zinc-800 dark:hover:bg-rose-600"
                        >
                          <PackageCheck className="h-3.5 w-3.5" />
                          <span>Marcar como retirado</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── VIEW 2: HISTORIAL RETIRADOS ── */}
        {viewMode === "HISTORIAL" && (
          <>
            {loadingRetirados && retirados.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-rose-600" />
                <span className="text-xs text-slate-500">Consultando historial…</span>
              </div>
            ) : retirados.length === 0 ? (
              <div className="animate-card-in flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
                <Archive className="mb-2 h-6 w-6 text-slate-400" />
                <p className="text-xs font-medium text-slate-500">
                  {historialSearch ? "Sin resultados en el historial" : "Sin DCPs retirados"}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {retirados.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{ animationDelay: `${Math.min(idx * 25, 200)}ms` }}
                      className="animate-card-in flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white/80 p-3.5 opacity-90 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/70"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-2 text-xs font-bold uppercase text-slate-600 dark:text-zinc-300">
                            {item.nombre}
                          </h3>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                setDcpToDelete(item);
                                setShowDeleteConfirm(true);
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                            {formatDiscoLabel(item.numeroDisco)}
                          </span>
                          <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-medium text-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                            {item.ubicacion}
                          </span>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[11px] dark:border-zinc-800 dark:bg-zinc-950">
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <ArrowDownLeft className="h-3 w-3" />
                            {formatDate(item.fechaLlegada)}
                          </span>
                          {item.fechaSalida && (
                            <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                              <ArrowUpRight className="h-3 w-3" />
                              Salió: {formatDate(item.fechaSalida)}
                            </span>
                          )}
                        </div>
                      </div>

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => revertirDcp(item)}
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Devolver a activos</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {hasMoreRetirados && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      disabled={loadingRetirados}
                      onClick={() => loadRetirados(true, historialSearch)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      {loadingRetirados && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>Cargar más retirados</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Floating Quick-Add Pill */}
        {!readOnly && (
          <button
            type="button"
            onClick={openNew}
            className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-slate-900/25 ring-1 ring-white/10 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500"
          >
            <Plus className="h-4 w-4" />
            <span>Ingresar DCP</span>
          </button>
        )}

        {/* ── RETIRE CONFIRM MODAL ── */}
        {showRetireConfirm && (
          <div className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
            <div className="animate-modal-in w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                <PackageCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Retirar DCP del complejo
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                {dcpToRetire
                  ? `Seleccioná la fecha de salida para "${dcpToRetire.nombre}".`
                  : "Seleccioná la fecha de retiro."}
              </p>

              {!showCustomDate ? (
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => confirmRetirar(todayISO())}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Retirar con fecha de hoy ({formatDate(todayISO())})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomDate(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    <span>Elegir otra fecha de salida…</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRetireConfirm(false);
                      setDcpToRetire(null);
                    }}
                    className="flex w-full items-center justify-center rounded-lg px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Fecha de salida
                    </label>
                    <input
                      type="date"
                      value={customDateISO}
                      onChange={(e) => setCustomDateISO(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCustomDate(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      Volver
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmRetirar(customDateISO || todayISO())}
                      className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Confirmar retiro
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DELETE CONFIRM MODAL ── */}
        {showDeleteConfirm && (
          <div className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
            <div className="animate-modal-in w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Eliminar DCP
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                {dcpToDelete
                  ? `¿Confirmás que querés eliminar permanentemente "${dcpToDelete.nombre}"?`
                  : "¿Eliminar este DCP?"}
              </p>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDcpToDelete(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmRemoveDcp}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CREATE / EDIT DCP MODAL ── */}
        {showForm && (
          <div className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs">
            <div className="animate-modal-in flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                    <Disc className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      {editingId ? "Editar Registro DCP" : "Ingresar Nuevo DCP"}
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Control de discos físicos, transmisión satelital e idiomas
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={addDcp} className="flex-1 space-y-4 overflow-y-auto p-5">
                {/* Movie Name */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Película / Nombre del DCP *
                  </label>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value.toUpperCase())}
                    placeholder="Ej: GLADIADOR 2"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold uppercase text-slate-900 placeholder:font-normal placeholder:normal-case placeholder:text-slate-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>

                {/* Medium Type + Disk Number */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Medio de Recepción *
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-slate-100/70 p-1 dark:border-zinc-800 dark:bg-zinc-950">
                      <button
                        type="button"
                        onClick={() => setFormEsSatelite(false)}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition-all ${
                          !formEsSatelite
                            ? "bg-white text-slate-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                            : "text-slate-500 hover:text-slate-800 dark:text-zinc-400"
                        }`}
                      >
                        <HardDrive className="h-3.5 w-3.5 text-rose-600" />
                        <span>Disco Físico</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormEsSatelite(true);
                          setFormNumeroDisco("");
                        }}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition-all ${
                          formEsSatelite
                            ? "bg-sky-600 text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:text-zinc-400"
                        }`}
                      >
                        <Radio className="h-3.5 w-3.5" />
                        <span>Satélite</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      {formEsSatelite ? "Identificador Satelital" : "Número de Disco *"}
                    </label>
                    <input
                      type="text"
                      disabled={formEsSatelite}
                      value={formEsSatelite ? "Transmisión Satélite" : formNumeroDisco}
                      onChange={(e) => setFormNumeroDisco(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="Ej: 14"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono text-xs text-slate-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* Location Grid */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Ubicación de Ingesta (TMS o Sala) *
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ubicacionOptions.map((loc) => {
                      const active = formUbicacion === loc;
                      return (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setFormUbicacion(loc)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all ${
                            active
                              ? "border-rose-600 bg-rose-600 text-white shadow-xs"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                          }`}
                        >
                          {loc}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Languages (SUB / CAS) */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    <Languages className="h-3.5 w-3.5 text-slate-400" />
                    <span>Versiones de Idioma Incluidas</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        label: "SUB (Subtitulada)",
                        checked: formSub,
                        onChange: setFormSub,
                      },
                      {
                        label: "CAS (Castellano)",
                        checked: formCas,
                        onChange: setFormCas,
                      },
                    ].map((lang) => (
                      <button
                        key={lang.label}
                        type="button"
                        onClick={() => lang.onChange(!lang.checked)}
                        className={`flex items-center justify-between rounded-xl border p-2.5 text-left text-xs font-bold transition-all ${
                          lang.checked
                            ? "border-indigo-500/70 bg-indigo-50/70 text-indigo-900 dark:border-indigo-500/60 dark:bg-indigo-950/40 dark:text-indigo-200"
                            : "border-slate-200 bg-slate-50/50 text-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500"
                        }`}
                      >
                        <span>{lang.label}</span>
                        <CheckCircle2
                          className={`h-4 w-4 ${
                            lang.checked ? "text-indigo-600 dark:text-indigo-400" : "opacity-30"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Operator Name + Quick Chips */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Cargado por (Operador) *
                  </label>
                  <input
                    type="text"
                    value={formCargadoPor}
                    onChange={(e) => setFormCargadoPor(e.target.value)}
                    placeholder="Nombre del operador"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />

                  {nombresCargadores.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-400">
                        Recientes:
                      </span>
                      {nombresCargadores.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setFormCargadoPor(n)}
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                            formCargadoPor === n
                              ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {formError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400">
                    {formError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    disabled={saving}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{editingId ? "Guardar Cambios" : "Registrar DCP"}</span>
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
