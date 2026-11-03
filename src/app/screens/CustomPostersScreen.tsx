import React, { useState, useEffect, useMemo } from "react";
import { Alert } from "react-native";
import {
  ImagePlus,
  Plus,
  Upload,
  Link2,
  Trash2,
  Search,
  X,
  Check,
  Image as ImageIcon,
  Calendar,
  Building2,
  Sparkles,
} from "lucide-react";
import {
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  doc,
} from "@/lib/dbService";
import { useAuthUser } from "../../lib/useAuthUser";
import { db } from "../../lib/firebaseConfig";
import * as DocumentPicker from "expo-document-picker";

interface CustomPoster {
  id: string;
  title: string;
  imageUrl: string;
  createdAt: string;
  createdBy: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 3) << 4) | (b2 >> 4);
    const enc3 = i + 1 < len ? ((b2 & 15) << 2) | (b3 >> 6) : 64;
    const enc4 = i + 2 < len ? b3 & 63 : 64;

    base64 +=
      chars.charAt(enc1) +
      chars.charAt(enc2) +
      (enc3 === 64 ? "=" : chars.charAt(enc3)) +
      (enc4 === 64 ? "=" : chars.charAt(enc4));
  }
  return base64;
}

export default function CustomPostersScreen() {
  const { cineId } = useAuthUser();

  const [posters, setPosters] = useState<CustomPoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CustomPoster | null>(null);

  const [title, setTitle] = useState("");
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    base64: string;
    mimeType: string;
  } | null>(null);

  const loadPosters = async () => {
    try {
      setLoading(true);
      const colRef = collection(db, "cines", "global", "custom_posters");
      const snap = await getDocs(colRef);
      const list: CustomPoster[] = snap.docs.map((d: any) => {
        const data = d.data();
        const rawUrl = data.imageUrl || "";
        const apiBase = process.env.EXPO_PUBLIC_API_URL || "/api";
        const displayUrl = rawUrl.startsWith("http")
          ? rawUrl
          : `${apiBase}/custom_posters/${d.id}/image`;
        return {
          id: d.id,
          title: data.title || "Sin título",
          imageUrl: displayUrl,
          createdAt: data.createdAt || "",
          createdBy: data.createdBy || "",
        };
      });
      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setPosters(list);
    } catch (e) {
      console.error("Error loading custom posters:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosters();
  }, []);

  const filteredPosters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return posters;
    return posters.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.createdBy.toLowerCase().includes(q)
    );
  }, [posters, searchQuery]);

  const handlePickImage = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return;

      const asset = res.assets[0];
      const sizeMB = (asset.size || 0) / (1024 * 1024);

      if (sizeMB > 1.2) {
        Alert.alert(
          "Archivo muy pesado",
          "Por favor elige una imagen de póster de menos de 1MB para optimizar el rendimiento de la aplicación."
        );
        return;
      }

      let buffer: ArrayBuffer;
      const maybeFile = (asset as any).file as File | undefined;
      if (maybeFile && typeof maybeFile.arrayBuffer === "function") {
        buffer = await maybeFile.arrayBuffer();
      } else {
        const response = await fetch(asset.uri);
        buffer = await response.arrayBuffer();
      }

      const base64 = arrayBufferToBase64(buffer);
      const mimeType = asset.mimeType || "image/jpeg";

      setSelectedFile({
        name: asset.name,
        base64,
        mimeType,
      });
    } catch (e) {
      console.error("Error picking image:", e);
      Alert.alert("Error", "No se pudo cargar el archivo seleccionado.");
    }
  };

  const handleSavePoster = async () => {
    if (!title.trim()) {
      Alert.alert(
        "Campos incompletos",
        "Por favor ingresa el título de la película o evento."
      );
      return;
    }

    let finalImageUrl = "";
    if (uploadMode === "url") {
      if (!externalUrl.trim() || !externalUrl.trim().startsWith("http")) {
        Alert.alert(
          "URL requerida",
          "Por favor ingresa una URL válida (que comience con http:// o https://)."
        );
        return;
      }
      finalImageUrl = externalUrl.trim();
    } else {
      if (!selectedFile) {
        Alert.alert(
          "Archivo requerido",
          "Por favor selecciona una imagen de póster."
        );
        return;
      }
      finalImageUrl = `data:${selectedFile.mimeType};base64,${selectedFile.base64}`;
    }

    try {
      setSaving(true);
      const colRef = collection(db, "cines", "global", "custom_posters");

      await addDoc(colRef, {
        title: title.trim(),
        imageUrl: finalImageUrl,
        createdBy: cineId || "desconocido",
        createdAt: new Date().toISOString(),
      });

      setTitle("");
      setExternalUrl("");
      setSelectedFile(null);
      setShowAddForm(false);
      await loadPosters();
    } catch (e) {
      console.error("Error saving poster:", e);
      Alert.alert("Error", "Ocurrió un error al guardar el póster.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeletePoster = async () => {
    if (!deleteTarget) return;
    try {
      const docRef = doc(db, "cines", "global", "custom_posters", deleteTarget.id);
      await deleteDoc(docRef);
      setDeleteTarget(null);
      await loadPosters();
    } catch (e) {
      console.error("Error deleting poster:", e);
      Alert.alert("Error", "No se pudo eliminar el póster.");
    }
  };

  const previewUri =
    uploadMode === "file" && selectedFile
      ? `data:${selectedFile.mimeType};base64,${selectedFile.base64}`
      : uploadMode === "url" && externalUrl.trim().startsWith("http")
      ? externalUrl.trim()
      : null;

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 py-3 pb-24">
      {/* Compact Header Toolbar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs p-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-100 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <ImagePlus size={18} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                Catálogo Global de Pósters Custom
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {posters.length} registrados
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Imágenes para festivales, ciclos o funciones especiales que no figuran en TMDB
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar película o complejo…"
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-200 focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-500/20 hover:shadow-md hover:shadow-rose-500/30 active:scale-[0.97] transition-all cursor-pointer shrink-0"
          >
            <Plus
              size={14}
              strokeWidth={2.5}
              className="transition-transform duration-200 group-hover:rotate-90"
            />
            <span>Nuevo Póster</span>
          </button>
        </div>
      </div>

      {/* Poster Gallery */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-7 h-7 rounded-full border-2 border-slate-200 border-t-rose-600 animate-spin mb-2.5" />
          <span className="text-xs font-semibold">Cargando catálogo de pósters…</span>
        </div>
      ) : filteredPosters.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 p-12 text-center max-w-md mx-auto my-6 animate-card-in">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
            <ImageIcon size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-1">
            {searchQuery ? "Sin coincidencias" : "No hay pósters personalizados"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
            {searchQuery
              ? "Probá con otro término de búsqueda."
              : "Subí una imagen desde archivo o URL externa para vincularla automáticamente con el título."}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-rose-600 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              Cargar Primer Póster
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredPosters.map((item, idx) => (
            <div
              key={item.id}
              style={{ animationDelay: `${Math.min(idx * 25, 250)}ms` }}
              className="animate-card-in hover-lift group bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col justify-between"
            >
              <div className="relative aspect-[2/3] w-full bg-slate-100 dark:bg-zinc-950 overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ImageIcon size={28} />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  title="Eliminar póster"
                  className="absolute top-2 right-2 w-7 h-7 rounded-xl bg-slate-950/75 hover:bg-rose-600 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="p-2.5 flex flex-col justify-between flex-1 gap-1.5">
                <h4
                  title={item.title}
                  className="text-xs font-extrabold text-slate-900 dark:text-zinc-100 line-clamp-2 leading-snug"
                >
                  {item.title}
                </h4>
                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                  <span className="inline-flex items-center gap-1 font-bold uppercase truncate max-w-[95px]">
                    <Building2 size={10} />
                    {item.createdBy}
                  </span>
                  <span className="inline-flex items-center gap-0.5 shrink-0">
                    <Calendar size={10} />
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                        })
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Nuevo Póster */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-backdrop-in">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-modal-in">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-rose-400" />
                <h3 className="text-sm font-extrabold">Nuevo Póster Personalizado</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-7 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Origen de la Imagen
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setUploadMode("file")}
                      className={`inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        uploadMode === "file"
                          ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                          : "text-slate-500"
                      }`}
                    >
                      <Upload size={12} />
                      Subir Archivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode("url")}
                      className={`inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        uploadMode === "url"
                          ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                          : "text-slate-500"
                      }`}
                    >
                      <Link2 size={12} />
                      URL Web
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Título de la Película o Evento *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Festival de Cine Coreano 2026"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                {uploadMode === "file" ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Archivo de Imagen (Máx. 1MB) *
                    </label>
                    <button
                      type="button"
                      onClick={handlePickImage}
                      className="w-full px-3 py-2.5 rounded-xl border border-dashed border-rose-300 bg-rose-50/50 hover:bg-rose-50 text-rose-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ImagePlus size={15} />
                      <span className="truncate">
                        {selectedFile ? selectedFile.name : "Seleccionar imagen del equipo…"}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      URL directa de la imagen (https://...) *
                    </label>
                    <input
                      type="url"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      placeholder="https://ejemplo.com/poster.jpg"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Poster Aspect Preview */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center">
                <div className="w-32 aspect-[2/3] rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 overflow-hidden flex flex-col items-center justify-center text-slate-400 shadow-inner">
                  {previewUri ? (
                    <img
                      src={previewUri}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <ImageIcon size={22} className="mb-1 opacity-50" />
                      <span className="text-[10px] font-semibold">Vista previa 2:3</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-zinc-950 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSavePoster}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Check size={14} />
                {saving ? "Guardando…" : "Guardar Póster"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-backdrop-in">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-5 space-y-3 animate-modal-in">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 size={20} />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
              ¿Eliminar póster de "{deleteTarget.title}"?
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Esta acción quitará el póster personalizado para todos los complejos.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeletePoster}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
