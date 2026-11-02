import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "@/lib/dbService";
import React, { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import {
  AlertTriangle,
  Calendar,
  FileText,
  Hash,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";

import { db, CINES_COLLECTION } from "../lib/firebaseConfig";
import { useAuthUser } from "../lib/useAuthUser";
import { Rma } from "../lib/types";
import SEOHead from "@/components/SEOHead";

function formatRmaDate(ts: any): string {
  if (!ts) return "Reciente";
  try {
    const d = ts?.toDate ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (isNaN(d.getTime())) return "Reciente";
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Reciente";
  }
}

export default function RmaTab({ readOnly = false }: { readOnly?: boolean }) {
  const { user, cineId, loading: sessionLoading, displayName } = useAuthUser();

  const [loading, setLoading] = useState(true);
  const [rmas, setRmas] = useState<Rma[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rmaNumber, setRmaNumber] = useState("");
  const [incidentNumber, setIncidentNumber] = useState("");
  const [details, setDetails] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [rmaToDelete, setRmaToDelete] = useState<Rma | null>(null);

  useEffect(() => {
    let unsub: any;

    (async () => {
      if (sessionLoading) {
        setLoading(true);
        return;
      }
      if (!user || !cineId) {
        setRmas([]);
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, CINES_COLLECTION, cineId, "rma"),
        orderBy("createdAt", "desc")
      );

      unsub = onSnapshot(
        q,
        (snap) => {
          const arr = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })) as Rma[];

          setRmas(arr);
          setLoading(false);
        },
        (err) => {
          console.error(err);
          setLoading(false);
          Alert.alert("RMA", "No se pudieron cargar los registros.");
        }
      );
    })();

    return () => unsub && unsub();
  }, [user, cineId, sessionLoading]);

  const filteredRmas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rmas;
    return rmas.filter(
      (r) =>
        (r.rmaNumber || "").toLowerCase().includes(q) ||
        (r.incidentNumber || "").toLowerCase().includes(q) ||
        (r.details || "").toLowerCase().includes(q) ||
        (r.createdName || "").toLowerCase().includes(q)
    );
  }, [rmas, searchTerm]);

  const openNew = () => {
    setRmaNumber("");
    setIncidentNumber("");
    setDetails("");
    setFormError(null);
    setSaving(false);
    setShowForm(true);
  };

  const addRma = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !cineId) return;

    if (!rmaNumber.trim()) {
      setFormError("Ingresá el número de RMA (obligatorio).");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const storedDisplayName =
        (await AsyncStorage.getItem("displayName")) ||
        displayName ||
        user.email?.split("@")[0] ||
        "Operador";

      await addDoc(collection(db, CINES_COLLECTION, cineId, "rma"), {
        rmaNumber: rmaNumber.trim(),
        incidentNumber: incidentNumber.trim() || null,
        details: details.trim() || null,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdName: storedDisplayName,
      });
      setShowForm(false);
      setRmaNumber("");
      setIncidentNumber("");
      setDetails("");
    } catch (err) {
      console.error(err);
      setFormError("No se pudo registrar el RMA. Intentá nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const removeRma = (r: Rma) => {
    setRmaToDelete(r);
    setShowDeleteConfirm(true);
  };

  const confirmRemoveRma = async () => {
    if (!rmaToDelete || !cineId) return;

    try {
      await deleteDoc(doc(db, CINES_COLLECTION, cineId, "rma", rmaToDelete.id));
      setShowDeleteConfirm(false);
      setRmaToDelete(null);
    } catch (e) {
      console.error(e);
      Alert.alert("RMA", "No se pudo eliminar.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-2.5">
        <Loader2 className="h-6 w-6 animate-spin text-rose-600 dark:text-rose-500" />
        <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
          Cargando tickets RMA…
        </span>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Gestión de RMA y Garantías | Cines"
        description="Seguimiento de devoluciones técnicas, garantías oficiales y estado de reparación de equipos de cine."
        pathname="/rma"
      />

      <main className="w-full pb-20">
        {/* Top Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/50">
              <Wrench className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Seguimiento de RMA y Garantías
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {rmas.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Control de piezas en garantía, incidentes técnicos y devoluciones
              </p>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-initial">
            <div className="relative w-full max-w-[230px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar RMA, incidente…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
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
                <span>Nuevo RMA</span>
              </button>
            )}
          </div>
        </div>

        {/* RMA Cards Grid */}
        {filteredRmas.length === 0 ? (
          <div className="animate-card-in flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              {searchTerm ? "Sin coincidencias" : "Sin RMAs registrados"}
            </h3>
            <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-zinc-400">
              {searchTerm
                ? "Probá con otro número de RMA o incidente."
                : "Todavía no hay solicitudes de garantía o devolución activas en este complejo."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredRmas.map((item, idx) => (
              <div
                key={item.id}
                style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                className="animate-card-in hover-lift group relative flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-300 dark:border-zinc-800/90 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div>
                  {/* Card Top Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 font-mono text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                        <Hash className="h-3 w-3" />
                        {item.rmaNumber}
                      </span>
                      {item.incidentNumber && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
                          INC: {item.incidentNumber}
                        </span>
                      )}
                    </div>

                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeRma(item)}
                        title="Eliminar RMA"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-80 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Details */}
                  <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 dark:border-zinc-800/70 dark:bg-zinc-950/60">
                    {item.details ? (
                      <p className="text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
                        {item.details}
                      </p>
                    ) : (
                      <p className="text-xs italic text-slate-400 dark:text-zinc-500">
                        Sin observaciones adicionales
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400 dark:border-zinc-800/80 dark:text-zinc-500">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-500 dark:text-zinc-400">
                    <User className="h-3 w-3" />
                    {item.createdName || "Operador"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatRmaDate(item.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Floating Quick-Add Pill */}
        {!readOnly && (
          <button
            type="button"
            onClick={openNew}
            className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-slate-900/25 ring-1 ring-white/10 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar RMA</span>
          </button>
        )}

        {/* ── DELETE CONFIRM MODAL ── */}
        {showDeleteConfirm && (
          <div className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
            <div className="animate-modal-in w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Eliminar registro RMA
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                {rmaToDelete
                  ? `¿Confirmás que querés dar de baja el RMA #${rmaToDelete.rmaNumber}?`
                  : "¿Eliminar este RMA?"}
              </p>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setRmaToDelete(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmRemoveRma}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Eliminar RMA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CREATE RMA MODAL ── */}
        {showForm && (
          <div className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs">
            <div className="animate-modal-in w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Registrar Nuevo RMA
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Alta de pieza en garantía o devolución técnica
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

              <form onSubmit={addRma} className="space-y-3.5 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      <Hash className="h-3 w-3 text-slate-400" />
                      <span>Número de RMA *</span>
                    </label>
                    <input
                      type="text"
                      value={rmaNumber}
                      onChange={(e) => setRmaNumber(e.target.value.toUpperCase())}
                      placeholder="Ej: RMA-2548"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      <FileText className="h-3 w-3 text-slate-400" />
                      <span>N° Incidente</span>
                    </label>
                    <input
                      type="text"
                      value={incidentNumber}
                      onChange={(e) => setIncidentNumber(e.target.value)}
                      placeholder="Opcional"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Detalles Técnicos / Observaciones
                  </label>
                  <textarea
                    rows={3}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Describí repuesto, serie, falla reportada o sala de origen…"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
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
                    <span>Guardar RMA</span>
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
