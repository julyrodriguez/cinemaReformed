import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDocs,
  limit as qLimit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  serverTimestamp,
  startAfter,
  updateDoc,
} from "@/lib/dbService";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import {
  CheckCircle2,
  Clock,
  Edit3,
  Film,
  Lightbulb,
  LightbulbOff,
  Loader2,
  Minus,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { db, CINES_COLLECTION } from "../lib/firebaseConfig";
import { useAuthUser } from "../lib/useAuthUser";
import SEOHead from "@/components/SEOHead";

interface Credito {
  id: string;
  pelicula: string;
  peliculaLower?: string;
  horaCredito: string;
  horaApaga1?: string | null;
  horaPrende1?: string | null;
  horaApaga2?: string | null;
  horaPrende2?: string | null;
  createdAt?: any;
  createdBy?: string | null;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function removeAccents(str: string): string {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeHHMMSS(input: string): string | null {
  const parts = input.trim().split(":");
  if (parts.length !== 3) return null;
  const [hStr, mStr, sStr] = parts;
  const h = Number(hStr),
    m = Number(mStr),
    s = Number(sStr);

  if (
    [h, m, s].some(Number.isNaN) ||
    m < 0 ||
    m > 59 ||
    s < 0 ||
    s > 59 ||
    h < 0
  ) {
    return null;
  }

  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function normalizeSearchText(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchCreditos(items: Credito[], queryStr: string): Credito[] {
  const rawQuery = queryStr.trim();
  if (!rawQuery) return [];

  const normQuery = normalizeSearchText(rawQuery);
  if (!normQuery) return [];

  const queryTokens = normQuery.split(" ").filter((t) => t.length > 0);
  const normQueryCompact = normQuery.replace(/\s+/g, "");

  const scoredResults: { item: Credito; score: number }[] = [];

  for (const item of items) {
    const rawTitle = item.pelicula || "";
    const normTitle = normalizeSearchText(rawTitle);
    if (!normTitle) continue;

    const normTitleCompact = normTitle.replace(/\s+/g, "");

    const directSubstring = normTitle.includes(normQuery);
    const allTokensMatch =
      queryTokens.length > 0 && queryTokens.every((token) => normTitle.includes(token));
    const compactMatch =
      normQueryCompact.length >= 2 && normTitleCompact.includes(normQueryCompact);

    if (!directSubstring && !allTokensMatch && !compactMatch) {
      continue;
    }

    let score = 0;

    if (normTitle === normQuery || normTitleCompact === normQueryCompact) {
      score += 1000;
    } else if (
      normTitle.startsWith(normQuery) ||
      normTitleCompact.startsWith(normQueryCompact)
    ) {
      score += 800;
    } else if (directSubstring) {
      score += 600;
    } else if (compactMatch) {
      score += 500;
    } else {
      score += 400;
    }

    const titleWords = normTitle.split(" ").filter(Boolean);
    let wordMatches = 0;
    for (const token of queryTokens) {
      if (titleWords.some((tw) => tw === token)) {
        wordMatches += 2;
      } else if (titleWords.some((tw) => tw.startsWith(token))) {
        wordMatches += 1;
      }
    }
    score += wordMatches * 25;

    const lengthDiff = Math.abs(normTitle.length - normQuery.length);
    score -= Math.min(lengthDiff * 0.5, 50);

    scoredResults.push({ item, score });
  }

  scoredResults.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const tA =
      a.item.createdAt?.toMillis?.() ??
      (typeof a.item.createdAt === "number" ? a.item.createdAt : 0);
    const tB =
      b.item.createdAt?.toMillis?.() ??
      (typeof b.item.createdAt === "number" ? b.item.createdAt : 0);
    return tB - tA;
  });

  return scoredResults.map((r) => r.item);
}

export default function CreditosScreen({ readOnly = false }: { readOnly?: boolean }) {
  const { user, cineId, loading: sessionLoading } = useAuthUser();

  const [items, setItems] = useState<Credito[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const allCreditosCache = useRef<Credito[] | null>(null);
  const loadingAllRef = useRef<Promise<Credito[]> | null>(null);

  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Credito[]>([]);
  const searchTimer = useRef<any>(null);

  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formPelicula, setFormPelicula] = useState("");
  const [formHoraFin, setFormHoraFin] = useState("");
  const [enablePC1, setEnablePC1] = useState(false);
  const [formApaga1, setFormApaga1] = useState("");
  const [formPrende1, setFormPrende1] = useState("");
  const [enablePC2, setEnablePC2] = useState(false);
  const [formApaga2, setFormApaga2] = useState("");
  const [formPrende2, setFormPrende2] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Credito | null>(null);

  const colRef = useMemo(() => {
    if (!cineId) return null;
    return collection(db, CINES_COLLECTION, cineId, "creditos");
  }, [cineId]);
  const PAGE = 12;

  const mapDoc = (d: QueryDocumentSnapshot<DocumentData>): Credito => {
    const data = d.data();
    return {
      id: d.id,
      pelicula: data.pelicula ?? "",
      peliculaLower: data.peliculaLower ?? undefined,
      horaCredito: data.horaCredito ?? "00:00:00",
      horaApaga1: data.horaApaga1 ?? null,
      horaPrende1: data.horaPrende1 ?? null,
      horaApaga2: data.horaApaga2 ?? null,
      horaPrende2: data.horaPrende2 ?? null,
      createdAt: data.createdAt ?? null,
      createdBy: data.createdBy ?? null,
    };
  };

  const fetchAllCreditos = async (): Promise<Credito[]> => {
    if (allCreditosCache.current) {
      return allCreditosCache.current;
    }
    if (!cineId || !colRef) return [];
    if (loadingAllRef.current) {
      return loadingAllRef.current;
    }

    loadingAllRef.current = (async () => {
      try {
        const snap = await getDocs(colRef);
        const list = snap.docs.map(mapDoc);
        allCreditosCache.current = list;
        return list;
      } catch (e) {
        console.error("[creditos] Error al cargar todos los créditos:", e);
        return [];
      } finally {
        loadingAllRef.current = null;
      }
    })();

    return loadingAllRef.current;
  };

  const loadFirstPage = async () => {
    if (sessionLoading) {
      setLoading(true);
      return;
    }
    if (!cineId || !colRef) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qy = query(colRef, orderBy("createdAt", "desc"), qLimit(PAGE));
      const snap = await getDocs(qy);
      const data = snap.docs.map(mapDoc);
      setItems(data);
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === PAGE);
      fetchAllCreditos().catch(() => {});
    } catch (e) {
      console.error(e);
      Alert.alert("Créditos", "No se pudo cargar la lista.");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || !lastDocRef.current || !cineId || !colRef) return;
    try {
      const qy = query(
        colRef,
        orderBy("createdAt", "desc"),
        startAfter(lastDocRef.current),
        qLimit(PAGE)
      );
      const snap = await getDocs(qy);
      const extra = snap.docs.map(mapDoc);
      setItems((prev) => prev.concat(extra));
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === PAGE);
    } catch (e) {
      console.error(e);
      Alert.alert("Créditos", "No se pudo cargar más.");
    }
  };

  useEffect(() => {
    allCreditosCache.current = null;
    loadFirstPage();
  }, [cineId, sessionLoading, colRef]);

  const runSearch = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed || !cineId || !colRef) {
      setSearching(false);
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const all = await fetchAllCreditos();
      const matched = searchCreditos(all, trimmed);
      setSearchResults(matched);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const onChangeSearch = (t: string) => {
    setSearch(t);
    if (!t.trim()) {
      setSearching(false);
      setSearchResults([]);
      clearTimeout(searchTimer.current);
      return;
    }
    setSearching(true);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(t), 180);
  };

  const resetForm = () => {
    setFormPelicula("");
    setFormHoraFin("");
    setEnablePC1(false);
    setFormApaga1("");
    setFormPrende1("");
    setEnablePC2(false);
    setFormApaga2("");
    setFormPrende2("");
    setFormError(null);
    setSaving(false);
  };

  const openCreate = () => {
    setEditingId(null);
    resetForm();
    setOpenModal(true);
  };

  const openEdit = (it: Credito) => {
    setEditingId(it.id);
    setFormPelicula(it.pelicula);
    setFormHoraFin(it.horaCredito || "");

    const hasPC1 = Boolean(it.horaApaga1 || it.horaPrende1);
    const hasPC2 = Boolean(it.horaApaga2 || it.horaPrende2);

    setEnablePC1(hasPC1);
    setFormApaga1(it.horaApaga1 || "");
    setFormPrende1(it.horaPrende1 || "");
    setEnablePC2(hasPC2);
    setFormApaga2(it.horaApaga2 || "");
    setFormPrende2(it.horaPrende2 || "");
    setFormError(null);
    setSaving(false);
    setOpenModal(true);
  };

  const saveItem = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    if (!formPelicula.trim()) {
      setFormError("Ingresá el nombre de la película.");
      return;
    }

    const pelicula = removeAccents(formPelicula).trim();
    const peliculaLower = pelicula.toLowerCase();

    const horaFinNorm = normalizeHHMMSS(formHoraFin);
    if (!horaFinNorm) {
      setFormError("Hora final inválida: usá el formato HH:mm:ss (ej: 01:54:50).");
      return;
    }

    let apaga1: string | null = null;
    let prende1: string | null = null;

    if (enablePC1) {
      const a1 = normalizeHHMMSS(formApaga1);
      const p1 = normalizeHHMMSS(formPrende1);
      if (!a1 || !p1) {
        setFormError("Postcrédito 1: completá 'Apagan' y 'Prenden' en formato HH:mm:ss.");
        return;
      }
      apaga1 = a1;
      prende1 = p1;
    }

    let apaga2: string | null = null;
    let prende2: string | null = null;

    if (enablePC2) {
      const a2 = normalizeHHMMSS(formApaga2);
      const p2 = normalizeHHMMSS(formPrende2);
      if (!a2 || !p2) {
        setFormError("Postcrédito 2: completá 'Apagan' y 'Prenden' en formato HH:mm:ss.");
        return;
      }
      apaga2 = a2;
      prende2 = p2;
    }

    const payload: any = {
      pelicula,
      peliculaLower,
      horaCredito: horaFinNorm,
      horaApaga1: apaga1 ?? null,
      horaPrende1: prende1 ?? null,
      horaApaga2: apaga2 ?? null,
      horaPrende2: prende2 ?? null,
      horas: [
        horaFinNorm,
        ...(apaga1 ? [apaga1] : []),
        ...(prende1 ? [prende1] : []),
        ...(apaga2 ? [apaga2] : []),
        ...(prende2 ? [prende2] : []),
      ],
    };

    setSaving(true);
    try {
      if (!cineId) return;
      if (editingId) {
        await updateDoc(doc(db, CINES_COLLECTION, cineId, "creditos", editingId), payload);
      } else {
        await addDoc(collection(db, CINES_COLLECTION, cineId, "creditos"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user?.uid ?? null,
        });
      }
      allCreditosCache.current = null;
      if (search.trim().length > 0) runSearch(search);
      else loadFirstPage();
      setOpenModal(false);
    } catch (err: any) {
      console.error(err);
      setFormError(err?.message ?? "No se pudo guardar el crédito.");
    } finally {
      setSaving(false);
    }
  };

  const ejecutarBorrado = async () => {
    if (!deleteItem || !cineId) return;
    const id = deleteItem.id;

    try {
      await deleteDoc(doc(db, CINES_COLLECTION, cineId, "creditos", id));
      if (allCreditosCache.current) {
        allCreditosCache.current = allCreditosCache.current.filter((x) => x.id !== id);
      }
      if (search.trim().length > 0) {
        setSearchResults((prev) => prev.filter((x) => x.id !== id));
      } else {
        setItems((prev) => prev.filter((x) => x.id !== id));
      }
      setDeleteVisible(false);
      setDeleteItem(null);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e?.message ?? "No se pudo eliminar");
    }
  };

  const showingSearch = search.trim().length > 0;
  const data = showingSearch ? searchResults : items;

  if (loading) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-2.5">
        <Loader2 className="h-6 w-6 animate-spin text-rose-600 dark:text-rose-500" />
        <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
          Cargando tiempos de créditos…
        </span>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Créditos y Postcréditos | Cines"
        description="Base de datos y buscador inteligente de tiempos de créditos finales y postcréditos para encendido de luces de sala en proyección."
        pathname="/creditos"
      />

      <main className="w-full pb-20">
        {/* Top Command Bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900/50">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Créditos y Poscréditos
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {showingSearch
                    ? searching
                      ? "Buscando…"
                      : `${data.length} resultado${data.length === 1 ? "" : "s"}`
                    : `${data.length} recientes`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Tiempos exactos de encendido y apagado de luces de sala (HH:mm:ss)
              </p>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-initial">
            <div className="relative w-full max-w-[260px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => onChangeSearch(e.target.value)}
                placeholder="Buscar película…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSearchResults([]);
                    setSearching(false);
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
                onClick={openCreate}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nuevo Crédito</span>
              </button>
            )}
          </div>
        </div>

        {/* Grid of Credit Cards */}
        {data.length === 0 ? (
          <div className="animate-card-in flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
              <Film className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              {showingSearch ? "Sin resultados para tu búsqueda" : "Sin créditos cargados"}
            </h3>
            <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-zinc-400">
              {showingSearch
                ? "Verificá el nombre de la película o cargá el nuevo registro."
                : "Registrá los tiempos de luces finales y postcréditos de las películas en cartelera."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.map((item, idx) => {
              const hasPC1 = Boolean(item.horaApaga1 || item.horaPrende1);
              const hasPC2 = Boolean(item.horaApaga2 || item.horaPrende2);

              return (
                <div
                  key={item.id}
                  style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                  className="animate-card-in hover-lift group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-300 dark:border-zinc-800/90 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  {/* Top Accent Line */}
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-rose-600 via-amber-500 to-emerald-500 opacity-75" />

                  {/* Header */}
                  <div className="mb-3 flex items-start justify-between gap-2 pt-0.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Film className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                      <h3 className="truncate text-xs font-extrabold uppercase tracking-tight text-slate-900 dark:text-zinc-100">
                        {item.pelicula}
                      </h3>
                    </div>

                    {!readOnly && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          title="Editar crédito"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteItem(item);
                            setDeleteVisible(true);
                          }}
                          title="Eliminar crédito"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Cue Sheet Rows */}
                  <div className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 dark:border-zinc-800/70 dark:bg-zinc-950/60">
                    {/* Row 1: Final */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                        Crédito Final
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <Lightbulb className="h-3 w-3" />
                        {item.horaCredito || "—"}
                      </span>
                    </div>

                    {/* Row 2: Postcrédito 1 */}
                    <div className="flex items-center justify-between gap-2 border-t border-slate-200/60 pt-1.5 dark:border-zinc-800/60">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                        Postcrédito 1
                      </span>
                      {hasPC1 ? (
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {item.horaApaga1 && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                              <LightbulbOff className="h-2.5 w-2.5" />
                              {item.horaApaga1}
                            </span>
                          )}
                          {item.horaPrende1 && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <Lightbulb className="h-2.5 w-2.5" />
                              {item.horaPrende1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-zinc-600">
                          <Minus className="h-2.5 w-2.5" /> No aplica
                        </span>
                      )}
                    </div>

                    {/* Row 3: Postcrédito 2 */}
                    <div className="flex items-center justify-between gap-2 border-t border-slate-200/60 pt-1.5 dark:border-zinc-800/60">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                        Postcrédito 2
                      </span>
                      {hasPC2 ? (
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {item.horaApaga2 && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                              <LightbulbOff className="h-2.5 w-2.5" />
                              {item.horaApaga2}
                            </span>
                          )}
                          {item.horaPrende2 && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <Lightbulb className="h-2.5 w-2.5" />
                              {item.horaPrende2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-zinc-600">
                          <Minus className="h-2.5 w-2.5" /> No aplica
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!showingSearch && hasMore && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={loadMore}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <span>Cargar más créditos</span>
            </button>
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
                Eliminar crédito
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                {deleteItem
                  ? `¿Confirmás que querés borrar los tiempos de "${deleteItem.pelicula}"?`
                  : "¿Querés borrar este crédito?"}
              </p>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteVisible(false);
                    setDeleteItem(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={ejecutarBorrado}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CREATE / EDIT CREDITO MODAL ── */}
        {openModal && (
          <div className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs">
            <div className="animate-modal-in flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      {editingId ? "Editar Crédito y Poscrédito" : "Nuevo Crédito y Poscrédito"}
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Programación de encendido/apagado de luces (HH:mm:ss)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={saveItem} className="flex-1 space-y-3.5 overflow-y-auto p-5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Película *
                  </label>
                  <input
                    type="text"
                    value={formPelicula}
                    onChange={(e) => setFormPelicula(e.target.value)}
                    placeholder="Ej: DEADPOOL Y WOLVERINE"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    <Lightbulb className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Encendido en Crédito Final (HH:mm:ss) *</span>
                  </label>
                  <input
                    type="text"
                    value={formHoraFin}
                    onChange={(e) => setFormHoraFin(e.target.value)}
                    placeholder="01:54:50"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>

                {/* Postcrédito 1 Section */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <button
                    type="button"
                    onClick={() => setEnablePC1(!enablePC1)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                        Incluir Postcrédito 1
                      </span>
                    </div>
                    <CheckCircle2
                      className={`h-4 w-4 transition-colors ${
                        enablePC1 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-zinc-700"
                      }`}
                    />
                  </button>

                  {enablePC1 && (
                    <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-slate-200/70 pt-3 dark:border-zinc-800">
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          <LightbulbOff className="h-3 w-3" /> Apagan (HH:mm:ss)
                        </label>
                        <input
                          type="text"
                          value={formApaga1}
                          onChange={(e) => setFormApaga1(e.target.value)}
                          placeholder="02:01:00"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <Lightbulb className="h-3 w-3" /> Prenden (HH:mm:ss)
                        </label>
                        <input
                          type="text"
                          value={formPrende1}
                          onChange={(e) => setFormPrende1(e.target.value)}
                          placeholder="02:05:40"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Postcrédito 2 Section */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <button
                    type="button"
                    onClick={() => setEnablePC2(!enablePC2)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                        Incluir Postcrédito 2
                      </span>
                    </div>
                    <CheckCircle2
                      className={`h-4 w-4 transition-colors ${
                        enablePC2 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-zinc-700"
                      }`}
                    />
                  </button>

                  {enablePC2 && (
                    <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-slate-200/70 pt-3 dark:border-zinc-800">
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          <LightbulbOff className="h-3 w-3" /> Apagan (HH:mm:ss)
                        </label>
                        <input
                          type="text"
                          value={formApaga2}
                          onChange={(e) => setFormApaga2(e.target.value)}
                          placeholder="02:10:00"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <Lightbulb className="h-3 w-3" /> Prenden (HH:mm:ss)
                        </label>
                        <input
                          type="text"
                          value={formPrende2}
                          onChange={(e) => setFormPrende2(e.target.value)}
                          placeholder="02:14:30"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </div>
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
                    onClick={() => setOpenModal(false)}
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
                    <span>{editingId ? "Guardar Cambios" : "Crear Crédito"}</span>
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
