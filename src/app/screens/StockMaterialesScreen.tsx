import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Alert, Platform } from "react-native";
import {
  Package,
  Plus,
  Upload,
  Link2,
  Trash2,
  Search,
  X,
  Check,
  Image as ImageIcon,
  ImageOff,
  Film,
  Sparkles,
  AlertTriangle,
  Eye,
  Archive,
  Edit3,
  Minus,
  ArrowRightLeft,
  Layers,
  Frame,
  UserSquare2,
  RefreshCw,
} from "lucide-react";
import {
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  setDoc,
  doc,
  httpsCallable,
} from "@/lib/dbService";
import { useAuthUser } from "../../lib/useAuthUser";
import { db, functions, CINES_COLLECTION } from "../../lib/firebaseConfig";
import * as DocumentPicker from "expo-document-picker";

export type MaterialCategory = "poster" | "banner" | "standee";
export type ImageSourceMode = "tmdb" | "url" | "none" | "upload";

export interface MaterialStockItem {
  id: string;
  categoria: MaterialCategory;
  titulo: string;
  notas?: string;
  posterUrl: string;
  imageSource?: ImageSourceMode;
  enBodega: number;
  enExposicion: number;
  updatedAt: string;
  updatedBy: string;
}

interface TmdbResult {
  id: number | string;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  isCustom?: boolean;
}

const CATEGORY_META: Record<
  MaterialCategory,
  {
    label: string;
    pluralLabel: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    accentColor: string;
  }
> = {
  poster: {
    label: "Póster",
    pluralLabel: "Pósters",
    badgeBg: "bg-blue-50 dark:bg-blue-500/15",
    badgeText: "text-blue-700 dark:text-blue-300",
    badgeBorder: "border-blue-200 dark:border-blue-500/30",
    accentColor: "#3b82f6",
  },
  banner: {
    label: "Banner",
    pluralLabel: "Banners",
    badgeBg: "bg-emerald-50 dark:bg-emerald-500/15",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    badgeBorder: "border-emerald-200 dark:border-emerald-500/30",
    accentColor: "#10b981",
  },
  standee: {
    label: "Standee",
    pluralLabel: "Standees",
    badgeBg: "bg-violet-50 dark:bg-violet-500/15",
    badgeText: "text-violet-700 dark:text-violet-300",
    badgeBorder: "border-violet-200 dark:border-violet-500/30",
    accentColor: "#8b5cf6",
  },
};

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

async function compressDataUriOnWeb(dataUri: string, maxWidth = 480, quality = 0.78): Promise<string> {
  if (Platform.OS !== "web" || typeof window === "undefined" || typeof document === "undefined") {
    return dataUri;
  }
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUri);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed || dataUri);
      } catch {
        resolve(dataUri);
      }
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}

function buildPosterDisplayUrl(posterPath: string | null | undefined): string {
  if (!posterPath) return "";
  const cleanPath = posterPath.trim();
  if (!cleanPath) return "";
  const apiBase = process.env.EXPO_PUBLIC_API_URL || "/api";
  const backendBase = process.env.EXPO_PUBLIC_BACKEND_URL || "";

  if (cleanPath.startsWith("data:")) {
    return cleanPath;
  }
  if (apiBase && cleanPath.includes(apiBase)) {
    return cleanPath;
  }
  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    return cleanPath;
  }
  const fullTmdb = `https://image.tmdb.org/t/p/w500${cleanPath}`;
  if (backendBase) {
    return `${backendBase}/api/cinemark/poster?url=${encodeURIComponent(fullTmdb)}`;
  }
  return fullTmdb;
}

export default function StockMaterialesScreen() {
  const { cineId, user } = useAuthUser();
  const userEmail = user?.email || cineId || "sistema";

  const [items, setItems] = useState<MaterialStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | MaterialCategory>("ALL");
  const [stockFilter, setStockFilter] = useState<"ALL" | "EXPOSICION" | "BODEGA" | "SIN_STOCK">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MaterialStockItem | null>(null);
  const [formCategory, setFormCategory] = useState<MaterialCategory>("poster");
  const [formTitulo, setFormTitulo] = useState("");
  const [formNotas, setFormNotas] = useState("");
  const [formStockTotal, setFormStockTotal] = useState("1");
  const [formEnExposicion, setFormEnExposicion] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);

  // Image selection inside Modal (Order: 1. tmdb, 2. url, 3. none, 4. upload)
  const [imageMode, setImageMode] = useState<ImageSourceMode>("tmdb");
  const [selectedPosterUrl, setSelectedPosterUrl] = useState("");
  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [searchingTmdb, setSearchingTmdb] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    dataUri: string;
  } | null>(null);

  // Quick Exposition Modal (to set exact X in exposition subtracting from bodega)
  const [expoModalItem, setExpoModalItem] = useState<MaterialStockItem | null>(null);
  const [expoInputVal, setExpoInputVal] = useState("");
  const [bodegaTotalInputVal, setBodegaTotalInputVal] = useState("");
  const [expoModalError, setExpoModalError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MaterialStockItem | null>(null);

  const loadMaterials = useCallback(async () => {
    if (!cineId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const colRef = collection(db, CINES_COLLECTION, cineId, "stock_materiales");
      const snap = await getDocs(colRef);
      const list: MaterialStockItem[] = snap.docs.map((d: any) => {
        const data = d.data() || {};
        const enBodega = Math.max(0, Number(data.enBodega ?? 0));
        const enExposicion = Math.max(0, Number(data.enExposicion ?? 0));
        return {
          id: d.id,
          categoria: (["poster", "banner", "standee"].includes(data.categoria)
            ? data.categoria
            : "poster") as MaterialCategory,
          titulo: data.titulo || "Sin título",
          notas: data.notas || "",
          posterUrl: data.posterUrl || "",
          imageSource: data.imageSource || (data.posterUrl ? "tmdb" : "none"),
          enBodega,
          enExposicion,
          updatedAt: data.updatedAt || "",
          updatedBy: data.updatedBy || "",
        };
      });
      list.sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
      setItems(list);
    } catch (err) {
      console.error("Error loading stock materiales:", err);
    } finally {
      setLoading(false);
    }
  }, [cineId]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  // Summary metrics
  const stats = useMemo(() => {
    let totalUnidades = 0;
    let totalBodega = 0;
    let totalExposicion = 0;
    const byCat: Record<MaterialCategory, { items: number; bodega: number; exposicion: number }> = {
      poster: { items: 0, bodega: 0, exposicion: 0 },
      banner: { items: 0, bodega: 0, exposicion: 0 },
      standee: { items: 0, bodega: 0, exposicion: 0 },
    };

    items.forEach((item) => {
      const bod = Math.max(0, item.enBodega);
      const exp = Math.max(0, item.enExposicion);
      totalBodega += bod;
      totalExposicion += exp;
      totalUnidades += bod + exp;
      if (byCat[item.categoria]) {
        byCat[item.categoria].items += 1;
        byCat[item.categoria].bodega += bod;
        byCat[item.categoria].exposicion += exp;
      }
    });

    return {
      totalItems: items.length,
      totalUnidades,
      totalBodega,
      totalExposicion,
      byCat,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory !== "ALL" && item.categoria !== selectedCategory) {
        return false;
      }
      const total = item.enBodega + item.enExposicion;
      if (stockFilter === "EXPOSICION" && item.enExposicion <= 0) return false;
      if (stockFilter === "BODEGA" && item.enBodega <= 0) return false;
      if (stockFilter === "SIN_STOCK" && total > 0) return false;

      if (!q) return true;
      return (
        item.titulo.toLowerCase().includes(q) ||
        (item.notas && item.notas.toLowerCase().includes(q)) ||
        CATEGORY_META[item.categoria].label.toLowerCase().includes(q)
      );
    });
  }, [items, selectedCategory, stockFilter, searchQuery]);

  // Open modal for New Material
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormCategory(selectedCategory === "ALL" ? "poster" : selectedCategory);
    setFormTitulo("");
    setFormNotas("");
    setFormStockTotal("1");
    setFormEnExposicion("0");
    setFormError(null);
    setImageMode("tmdb");
    setSelectedPosterUrl("");
    setTmdbQuery("");
    setTmdbResults([]);
    setExternalUrl("");
    setSelectedFile(null);
    setShowModal(true);
  };

  // Open modal for Edit Material
  const handleOpenEdit = (item: MaterialStockItem) => {
    setEditingItem(item);
    setFormCategory(item.categoria);
    setFormTitulo(item.titulo);
    setFormNotas(item.notas || "");
    const total = item.enBodega + item.enExposicion;
    setFormStockTotal(String(total));
    setFormEnExposicion(String(item.enExposicion));
    setFormError(null);

    const source = item.imageSource || (item.posterUrl ? "tmdb" : "none");
    setImageMode(source);
    setSelectedPosterUrl(item.posterUrl || "");
    setTmdbQuery(item.titulo);
    setTmdbResults([]);
    setExternalUrl(source === "url" ? item.posterUrl : "");
    setSelectedFile(
      source === "upload" && item.posterUrl
        ? { name: "Imagen cargada", dataUri: item.posterUrl }
        : null
    );
    setShowModal(true);
  };

  // Search TMDB + Local Custom Posters (same workflow as Banners y Marquesinas)
  const handleSearchTmdb = async () => {
    const queryText = (tmdbQuery.trim() || formTitulo.trim());
    if (!queryText) return;

    try {
      setSearchingTmdb(true);
      setTmdbResults([]);

      // 1. Custom posters from local database
      let localResults: TmdbResult[] = [];
      try {
        const colRef = collection(db, "cines", "global", "custom_posters");
        const snap = await getDocs(colRef);
        const term = queryText.toLowerCase().trim();
        localResults = snap.docs
          .map((d: any) => {
            const data = d.data() || {};
            const rawUrl = data.imageUrl || "";
            const apiBase = process.env.EXPO_PUBLIC_API_URL || "/api";
            const posterPath = rawUrl.startsWith("http")
              ? rawUrl
              : `${apiBase}/custom_posters/${d.id}/image`;
            return {
              id: d.id,
              title: data.title || "Sin título",
              poster_path: posterPath,
              isCustom: true,
            };
          })
          .filter((p: TmdbResult) => p.title.toLowerCase().includes(term));
      } catch (err) {
        console.error("Error querying local custom posters:", err);
      }

      // 2. TMDB search via cloud function
      let remoteResults: TmdbResult[] = [];
      try {
        const searchPosterFunc = httpsCallable<{ query: string }, { results: TmdbResult[] }>(
          functions,
          "searchMoviePoster"
        );
        const response = await searchPosterFunc({ query: queryText });
        remoteResults = response.data.results || [];
      } catch (err) {
        console.error("Error searching TMDB posters:", err);
      }

      const combined = [...localResults, ...remoteResults];
      setTmdbResults(combined);
    } catch (e) {
      console.error("Error searching poster:", e);
    } finally {
      setSearchingTmdb(false);
    }
  };

  const handleSelectTmdbResult = (movie: TmdbResult) => {
    const url = buildPosterDisplayUrl(movie.poster_path);
    setSelectedPosterUrl(url);
    if (!formTitulo.trim() && movie.title) {
      setFormTitulo(movie.title);
    }
  };

  const handlePickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return;
      const asset = res.assets[0];
      const sizeMB = (asset.size || 0) / (1024 * 1024);

      if (sizeMB > 1.5) {
        Alert.alert(
          "Archivo muy pesado",
          "Por favor elegí una imagen menor a 1.5MB para no sobrecargar el servidor."
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
      const rawDataUri = `data:${mimeType};base64,${base64}`;
      const optimizedUri = await compressDataUriOnWeb(rawDataUri, 480, 0.78);

      setSelectedFile({
        name: asset.name,
        dataUri: optimizedUri,
      });
      setSelectedPosterUrl(optimizedUri);
    } catch (e) {
      console.error("Error picking file:", e);
      Alert.alert("Error", "No se pudo cargar el archivo seleccionado.");
    }
  };

  // Computed preview and stock breakdown inside modal
  const parsedModalTotal = Math.max(0, parseInt(formStockTotal || "0", 10) || 0);
  const parsedModalExpo = Math.max(0, parseInt(formEnExposicion || "0", 10) || 0);
  const computedModalBodega = Math.max(0, parsedModalTotal - parsedModalExpo);

  const modalPreviewUrl = useMemo(() => {
    if (imageMode === "none") return "";
    if (imageMode === "url") {
      const clean = externalUrl.trim();
      return clean.startsWith("http://") || clean.startsWith("https://") ? clean : "";
    }
    if (imageMode === "upload") {
      return selectedFile?.dataUri || selectedPosterUrl || "";
    }
    return selectedPosterUrl;
  }, [imageMode, externalUrl, selectedFile, selectedPosterUrl]);

  const handleSaveMaterial = async () => {
    setFormError(null);
    if (!cineId) return;

    if (!formTitulo.trim()) {
      setFormError("Por favor ingresá el nombre o película del material.");
      return;
    }

    const totalNum = parseInt(formStockTotal, 10);
    const expoNum = parseInt(formEnExposicion || "0", 10);

    if (isNaN(totalNum) || totalNum < 0) {
      setFormError("El stock total debe ser un número mayor o igual a 0.");
      return;
    }
    if (isNaN(expoNum) || expoNum < 0) {
      setFormError("La cantidad en exposición debe ser mayor o igual a 0.");
      return;
    }
    if (expoNum > totalNum) {
      setFormError(
        `No podés poner ${expoNum} en exposición si el stock total es ${totalNum}.`
      );
      return;
    }

    let finalPosterUrl = "";
    if (imageMode === "none") {
      finalPosterUrl = "";
    } else if (imageMode === "url") {
      const clean = externalUrl.trim();
      if (!clean || (!clean.startsWith("http://") && !clean.startsWith("https://"))) {
        setFormError("Ingresá una URL válida (http:// o https://) o elegí 'Sin Imagen'.");
        return;
      }
      finalPosterUrl = clean;
    } else if (imageMode === "upload") {
      if (!selectedFile?.dataUri && !selectedPosterUrl) {
        setFormError("Seleccioná un archivo de imagen o cambiá a 'Sin Imagen'.");
        return;
      }
      finalPosterUrl = selectedFile?.dataUri || selectedPosterUrl;
    } else {
      // TMDB mode: allow saving even if no poster was chosen (falls back to sin imagen)
      finalPosterUrl = selectedPosterUrl || "";
    }

    const bodegaFinal = totalNum - expoNum;
    const payload = {
      categoria: formCategory,
      titulo: formTitulo.trim(),
      notas: formNotas.trim(),
      posterUrl: finalPosterUrl,
      imageSource: finalPosterUrl ? imageMode : ("none" as ImageSourceMode),
      enBodega: bodegaFinal,
      enExposicion: expoNum,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail,
    };

    try {
      setSaving(true);
      if (editingItem) {
        const docRef = doc(
          db,
          CINES_COLLECTION,
          cineId,
          "stock_materiales",
          editingItem.id
        );
        await setDoc(docRef, payload);
      } else {
        const colRef = collection(db, CINES_COLLECTION, cineId, "stock_materiales");
        await addDoc(colRef, payload);
      }
      setShowModal(false);
      await loadMaterials();
    } catch (e: any) {
      console.error("Error saving material stock:", e);
      setFormError(e?.message || "No se pudo guardar el material.");
    } finally {
      setSaving(false);
    }
  };

  // Move units between Bodega and Exposición:
  // Putting +delta in Exposición subtracts delta from Bodega!
  // Putting -delta in Exposición returns delta to Bodega!
  const handleAdjustExposicion = async (item: MaterialStockItem, deltaExpo: number) => {
    if (!cineId) return;
    const total = item.enBodega + item.enExposicion;
    const nextExpo = item.enExposicion + deltaExpo;
    if (nextExpo < 0 || nextExpo > total) return;
    const nextBodega = total - nextExpo;

    const updatedItem: MaterialStockItem = {
      ...item,
      enBodega: nextBodega,
      enExposicion: nextExpo,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail,
    };

    // Optimistic update
    setItems((prev) => prev.map((it) => (it.id === item.id ? updatedItem : it)));
    setUpdatingId(item.id);
    try {
      const docRef = doc(db, CINES_COLLECTION, cineId, "stock_materiales", item.id);
      await setDoc(docRef, {
        categoria: updatedItem.categoria,
        titulo: updatedItem.titulo,
        notas: updatedItem.notas || "",
        posterUrl: updatedItem.posterUrl || "",
        imageSource: updatedItem.imageSource || "none",
        enBodega: updatedItem.enBodega,
        enExposicion: updatedItem.enExposicion,
        updatedAt: updatedItem.updatedAt,
        updatedBy: updatedItem.updatedBy,
      });
    } catch (e) {
      console.error("Error updating exposition stock:", e);
      await loadMaterials();
    } finally {
      setUpdatingId(null);
    }
  };

  // Adjust Bodega directly (when new material arrives to warehouse or is discarded)
  const handleAdjustBodega = async (item: MaterialStockItem, deltaBodega: number) => {
    if (!cineId) return;
    const nextBodega = item.enBodega + deltaBodega;
    if (nextBodega < 0) return;

    const updatedItem: MaterialStockItem = {
      ...item,
      enBodega: nextBodega,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail,
    };

    setItems((prev) => prev.map((it) => (it.id === item.id ? updatedItem : it)));
    setUpdatingId(item.id);
    try {
      const docRef = doc(db, CINES_COLLECTION, cineId, "stock_materiales", item.id);
      await setDoc(docRef, {
        categoria: updatedItem.categoria,
        titulo: updatedItem.titulo,
        notas: updatedItem.notas || "",
        posterUrl: updatedItem.posterUrl || "",
        imageSource: updatedItem.imageSource || "none",
        enBodega: updatedItem.enBodega,
        enExposicion: updatedItem.enExposicion,
        updatedAt: updatedItem.updatedAt,
        updatedBy: updatedItem.updatedBy,
      });
    } catch (e) {
      console.error("Error updating bodega stock:", e);
      await loadMaterials();
    } finally {
      setUpdatingId(null);
    }
  };

  // Open Quick Exposition / Stock Modal
  const handleOpenExpoModal = (item: MaterialStockItem) => {
    setExpoModalItem(item);
    setExpoInputVal(String(item.enExposicion));
    setBodegaTotalInputVal(String(item.enBodega + item.enExposicion));
    setExpoModalError(null);
  };

  const handleSaveExpoModal = async () => {
    if (!expoModalItem || !cineId) return;
    setExpoModalError(null);

    const totalNum = parseInt(bodegaTotalInputVal, 10);
    const expoNum = parseInt(expoInputVal, 10);

    if (isNaN(totalNum) || totalNum < 0) {
      setExpoModalError("El stock total debe ser un número válido mayor o igual a 0.");
      return;
    }
    if (isNaN(expoNum) || expoNum < 0) {
      setExpoModalError("La cantidad en exposición debe ser mayor o igual a 0.");
      return;
    }
    if (expoNum > totalNum) {
      setExpoModalError(
        `No podés poner ${expoNum} en exposición porque superaría el stock total (${totalNum}).`
      );
      return;
    }

    const nextBodega = totalNum - expoNum;
    const updatedItem: MaterialStockItem = {
      ...expoModalItem,
      enBodega: nextBodega,
      enExposicion: expoNum,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail,
    };

    setUpdatingId(expoModalItem.id);
    try {
      const docRef = doc(
        db,
        CINES_COLLECTION,
        cineId,
        "stock_materiales",
        expoModalItem.id
      );
      await setDoc(docRef, {
        categoria: updatedItem.categoria,
        titulo: updatedItem.titulo,
        notas: updatedItem.notas || "",
        posterUrl: updatedItem.posterUrl || "",
        imageSource: updatedItem.imageSource || "none",
        enBodega: updatedItem.enBodega,
        enExposicion: updatedItem.enExposicion,
        updatedAt: updatedItem.updatedAt,
        updatedBy: updatedItem.updatedBy,
      });
      setItems((prev) =>
        prev.map((it) => (it.id === updatedItem.id ? updatedItem : it))
      );
      setExpoModalItem(null);
    } catch (e: any) {
      console.error("Error saving exposition modal:", e);
      setExpoModalError(e?.message || "No se pudo actualizar el stock.");
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !cineId) return;
    try {
      const docRef = doc(
        db,
        CINES_COLLECTION,
        cineId,
        "stock_materiales",
        deleteTarget.id
      );
      await deleteDoc(docRef);
      setDeleteTarget(null);
      await loadMaterials();
    } catch (e) {
      console.error("Error deleting material:", e);
      Alert.alert("Error", "No se pudo eliminar el material.");
    }
  };

  const renderCategoryIcon = (cat: MaterialCategory, size = 14) => {
    if (cat === "poster") return <Film size={size} />;
    if (cat === "banner") return <Frame size={size} />;
    return <UserSquare2 size={size} />;
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 py-3 pb-24">
      {/* Header & Summary Toolbar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs p-3.5 mb-4 flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-100 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <Package size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                  Control de Stock de Materiales
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                  {stats.totalItems} títulos • {stats.totalUnidades} u. totales
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Inventario de Pósters, Banners y Standees — las unidades en exposición se descuentan automáticamente de bodega
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadMaterials}
              title="Actualizar listado"
              className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="group inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-500/20 hover:shadow-md hover:shadow-rose-500/30 active:scale-[0.97] transition-all cursor-pointer shrink-0"
            >
              <Plus
                size={15}
                strokeWidth={2.5}
                className="transition-transform duration-200 group-hover:rotate-90"
              />
              <span>Agregar Material</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/80">
          <div className="rounded-xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 px-3 py-2 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 block">
                En Bodega
              </span>
              <span className="text-base font-black text-amber-900 dark:text-amber-200">
                {stats.totalBodega}
              </span>
            </div>
            <Archive size={18} className="text-amber-600 dark:text-amber-400 opacity-80" />
          </div>

          <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20 px-3 py-2 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                En Exposición
              </span>
              <span className="text-base font-black text-emerald-900 dark:text-emerald-200">
                {stats.totalExposicion}
              </span>
            </div>
            <Eye size={18} className="text-emerald-600 dark:text-emerald-400 opacity-80" />
          </div>

          {(["poster", "banner", "standee"] as MaterialCategory[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const cStats = stats.byCat[cat];
            return (
              <div
                key={cat}
                className="rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200/80 dark:border-zinc-800 px-3 py-2 flex items-center justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                    {meta.pluralLabel} ({cStats.items})
                  </span>
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-zinc-200">
                    <span title="En Bodega">{cStats.bodega} bod.</span>
                    <span className="text-slate-300 dark:text-zinc-700">•</span>
                    <span className="text-emerald-600 dark:text-emerald-400" title="En Exposición">
                      {cStats.exposicion} exp.
                    </span>
                  </div>
                </div>
                <div className={`p-1.5 rounded-lg ${meta.badgeBg} ${meta.badgeText}`}>
                  {renderCategoryIcon(cat, 15)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-1">
          {/* Category Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: "ALL", label: "Todos" },
                { key: "poster", label: "Pósters" },
                { key: "banner", label: "Banners" },
                { key: "standee", label: "Standees" },
              ] as const
            ).map((tab) => {
              const active = selectedCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    active
                      ? "bg-slate-900 text-white border-slate-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 shadow-xs"
                      : "bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-900"
                  }`}
                >
                  {tab.key !== "ALL" && renderCategoryIcon(tab.key, 13)}
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1 hidden sm:block" />

            {/* Location / State Sub-filter */}
            {(
              [
                { key: "ALL", label: "Cualquier estado" },
                { key: "EXPOSICION", label: "En Exposición" },
                { key: "BODEGA", label: "En Bodega" },
              ] as const
            ).map((st) => {
              const active = stockFilter === st.key;
              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStockFilter(st.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                    active
                      ? "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30"
                      : "bg-transparent text-slate-500 dark:text-zinc-400 border-transparent hover:bg-slate-100 dark:hover:bg-zinc-900"
                  }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar película, póster, standee…"
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-200 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none"
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
        </div>
      </div>

      {/* Main Content Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-7 h-7 rounded-full border-2 border-slate-200 border-t-rose-600 animate-spin mb-2.5" />
          <span className="text-xs font-semibold">Cargando stock de materiales…</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 p-12 text-center max-w-md mx-auto my-6">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
            <Package size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-1">
            {searchQuery || selectedCategory !== "ALL" || stockFilter !== "ALL"
              ? "Sin materiales que coincidan con el filtro"
              : "Todavía no hay materiales registrados"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 leading-relaxed">
            {searchQuery || selectedCategory !== "ALL" || stockFilter !== "ALL"
              ? "Probá cambiando la categoría o el término de búsqueda."
              : "Registrá Pósters, Banners y Standees para controlar cuántas unidades están guardadas en bodega y cuántas en exposición."}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:bg-rose-600 dark:hover:bg-rose-500 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Cargar Primer Material
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {filteredItems.map((item) => {
            const meta = CATEGORY_META[item.categoria] || CATEGORY_META.poster;
            const total = item.enBodega + item.enExposicion;
            const isUpdating = updatingId === item.id;

            return (
              <div
                key={item.id}
                className="group bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col justify-between transition-all hover:shadow-md"
              >
                {/* Top Poster / Placeholder Area */}
                <div className="relative aspect-[2/2.6] w-full bg-slate-100 dark:bg-zinc-950 overflow-hidden">
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={item.titulo}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-950">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                      >
                        {renderCategoryIcon(item.categoria, 22)}
                      </div>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-zinc-200 line-clamp-2 px-2">
                        {item.titulo}
                      </span>
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                        <ImageOff size={11} />
                        Sin imagen
                      </span>
                    </div>
                  )}

                  {/* Category Badge Top-Left */}
                  <div
                    className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide border backdrop-blur-md shadow-xs ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                  >
                    {renderCategoryIcon(item.categoria, 11)}
                    <span>{meta.label}</span>
                  </div>

                  {/* Action Buttons Top-Right */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      title="Editar material / imagen"
                      className="w-7 h-7 rounded-xl bg-slate-950/75 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      title="Eliminar material"
                      className="w-7 h-7 rounded-xl bg-slate-950/75 hover:bg-rose-600 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Active Exposition Floating Badge */}
                  {item.enExposicion > 0 && (
                    <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-xl bg-emerald-600/95 text-white text-[11px] font-extrabold flex items-center justify-between shadow-sm backdrop-blur-xs">
                      <span className="inline-flex items-center gap-1">
                        <Eye size={12} />
                        En Exposición
                      </span>
                      <span>{item.enExposicion} u.</span>
                    </div>
                  )}
                </div>

                {/* Card Body: Title + Stock Controls */}
                <div className="p-3 flex flex-col justify-between flex-1 gap-2.5">
                  <div>
                    <h4
                      title={item.titulo}
                      className="text-xs font-extrabold text-slate-900 dark:text-zinc-100 line-clamp-1 leading-snug"
                    >
                      {item.titulo}
                    </h4>
                    {item.notas ? (
                      <p
                        title={item.notas}
                        className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5"
                      >
                        {item.notas}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                        Stock total: <strong className="text-slate-600 dark:text-zinc-300">{total} u.</strong>
                      </p>
                    )}
                  </div>

                  {/* Bodega & Exposición Interactive Control Box */}
                  <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 p-2 space-y-2">
                    {/* Row 1: En Bodega */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 truncate">
                          En Bodega:
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isUpdating || item.enBodega <= 0}
                          onClick={() => handleAdjustBodega(item, -1)}
                          title="Restar 1 de bodega (baja de stock)"
                          className="w-6 h-6 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="min-w-[26px] text-center text-xs font-black text-amber-700 dark:text-amber-300">
                          {item.enBodega}
                        </span>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleAdjustBodega(item, 1)}
                          title="Sumar 1 a bodega (ingreso de stock)"
                          className="w-6 h-6 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: En Exposición (Subtracts from Bodega) */}
                    <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-200/60 dark:border-zinc-800/80">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span
                          className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 truncate"
                          title="Al subir en exposición se resta de bodega"
                        >
                          Exposición:
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isUpdating || item.enExposicion <= 0}
                          onClick={() => handleAdjustExposicion(item, -1)}
                          title="Retirar 1 de exposición (vuelve a bodega)"
                          className="w-6 h-6 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="min-w-[26px] text-center text-xs font-black text-emerald-700 dark:text-emerald-300">
                          {item.enExposicion}
                        </span>
                        <button
                          type="button"
                          disabled={isUpdating || item.enBodega <= 0}
                          onClick={() => handleAdjustExposicion(item, 1)}
                          title="Poner 1 en exposición (se resta de bodega)"
                          className="w-6 h-6 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Quick Button to set exact number in Exposición */}
                    <button
                      type="button"
                      onClick={() => handleOpenExpoModal(item)}
                      className="w-full mt-1 py-1.5 px-2 rounded-lg bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200/90 dark:border-zinc-800 text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ArrowRightLeft size={11} className="text-rose-500" />
                      <span>Mover Bodega ↔ Exposición</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Mover entre Bodega y Exposición (Asignación Rápida) */}
      {expoModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setExpoModalItem(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-emerald-400" />
                <div>
                  <h3 className="text-sm font-extrabold">
                    Control de Exposición y Bodega
                  </h3>
                  <p className="text-[11px] text-slate-300 truncate max-w-[260px]">
                    {expoModalItem.titulo} ({CATEGORY_META[expoModalItem.categoria].label})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpoModalItem(null)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Stock Total del Material
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={bodegaTotalInputVal}
                    onChange={(e) => setBodegaTotalInputVal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-sm font-extrabold text-slate-900 dark:text-zinc-100 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                    Unidades en Exposición
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, parseInt(bodegaTotalInputVal || "0", 10) || 0)}
                    value={expoInputVal}
                    onChange={(e) => setExpoInputVal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 text-sm font-extrabold text-emerald-900 dark:text-emerald-200 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Live preview calculation */}
              {(() => {
                const tot = Math.max(0, parseInt(bodegaTotalInputVal || "0", 10) || 0);
                const exp = Math.max(0, parseInt(expoInputVal || "0", 10) || 0);
                const bod = Math.max(0, tot - exp);
                return (
                  <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-3">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-2">
                      Resultado del descuento automático:
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">
                          Total
                        </span>
                        <span className="text-sm font-black text-slate-800 dark:text-zinc-100">
                          {tot} u.
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                        <span className="block text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">
                          En Bodega
                        </span>
                        <span className="text-sm font-black text-amber-900 dark:text-amber-200">
                          {bod} u.
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                        <span className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                          En Exposición
                        </span>
                        <span className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                          {exp} u.
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {expoModalError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-600 dark:text-rose-300">
                  {expoModalError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setExpoModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveExpoModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  <Check size={14} />
                  <span>Guardar Stock</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear / Editar Material */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-rose-400" />
                <h3 className="text-sm font-extrabold">
                  {editingItem ? "Editar Material de Stock" : "Nuevo Material de Stock"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Left Column: Form Details */}
                <div className="md:col-span-7 space-y-3.5">
                  {/* Category Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Tipo de Material *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["poster", "banner", "standee"] as MaterialCategory[]).map((cat) => {
                        const meta = CATEGORY_META[cat];
                        const active = formCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setFormCategory(cat)}
                            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                              active
                                ? `${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder} ring-2 ring-offset-1 ring-slate-900/10`
                                : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100"
                            }`}
                          >
                            {renderCategoryIcon(cat, 14)}
                            <span>{meta.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Title / Movie Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Película o Nombre del Material *
                    </label>
                    <input
                      type="text"
                      value={formTitulo}
                      onChange={(e) => setFormTitulo(e.target.value)}
                      placeholder="Ej: Spider-Man / Avengers / Standee Lobby"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none"
                    />
                  </div>

                  {/* Optional Notes */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Ubicación / Notas (Opcional)
                    </label>
                    <input
                      type="text"
                      value={formNotas}
                      onChange={(e) => setFormNotas(e.target.value)}
                      placeholder="Ej: Marquesina Hall Principal / 2x3m / Caja 4"
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-200 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none"
                    />
                  </div>

                  {/* Stock Quantities: Total & En Exposición */}
                  <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-slate-800 dark:text-zinc-200">
                        Control de Unidades (Bodega y Exposición)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                          Cantidad Total Recibida *
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formStockTotal}
                          onChange={(e) => setFormStockTotal(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-extrabold text-slate-900 dark:text-zinc-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                          En Exposición (se restan de bodega)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={parsedModalTotal}
                          value={formEnExposicion}
                          onChange={(e) => setFormEnExposicion(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 text-xs font-extrabold text-emerald-900 dark:text-emerald-200"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/70 dark:border-zinc-800">
                      <span className="text-slate-500 dark:text-zinc-400">
                        Quedan en <strong className="text-amber-700 dark:text-amber-300">Bodega: {computedModalBodega} u.</strong>
                      </span>
                      <span className="text-slate-500 dark:text-zinc-400">
                        En <strong className="text-emerald-700 dark:text-emerald-400">Exposición: {parsedModalExpo} u.</strong>
                      </span>
                    </div>
                  </div>

                  {/* Image Source Selector (TMDB -> URL -> Sin Imagen -> Subir Archivo [LAST OPTION]) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Imagen del Material
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setImageMode("tmdb")}
                        className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          imageMode === "tmdb"
                            ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <Search size={11} />
                        <span>1. TMDB</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImageMode("url")}
                        className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          imageMode === "url"
                            ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <Link2 size={11} />
                        <span>2. URL</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setImageMode("none");
                          setSelectedPosterUrl("");
                        }}
                        className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          imageMode === "none"
                            ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <ImageOff size={11} />
                        <span>Sin Imagen</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImageMode("upload")}
                        className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          imageMode === "upload"
                            ? "bg-amber-500 text-white shadow-xs"
                            : "text-amber-700 dark:text-amber-400 hover:bg-amber-50/60"
                        }`}
                      >
                        <Upload size={11} />
                        <span>Subir (Últ. opción)</span>
                      </button>
                    </div>
                  </div>

                  {/* Option 1: TMDB Search */}
                  {imageMode === "tmdb" && (
                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                        Buscar póster oficial en TMDB o catálogo global (Recomendado):
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={tmdbQuery}
                          onChange={(e) => setTmdbQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSearchTmdb();
                            }
                          }}
                          placeholder={
                            formTitulo
                              ? `Buscar "${formTitulo}" en TMDB…`
                              : "Escribir nombre de la película…"
                          }
                          className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-900 dark:text-zinc-100 focus:bg-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSearchTmdb}
                          disabled={searchingTmdb}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:bg-rose-600 transition-colors cursor-pointer shrink-0"
                        >
                          {searchingTmdb ? "Buscando…" : "Buscar"}
                        </button>
                      </div>

                      {tmdbResults.length > 0 && (
                        <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 divide-y divide-slate-200/60 dark:divide-zinc-800">
                          {tmdbResults.map((movie) => {
                            const thumbUrl = buildPosterDisplayUrl(movie.poster_path);
                            const isSelected = selectedPosterUrl === thumbUrl && !!thumbUrl;
                            return (
                              <button
                                key={movie.id}
                                type="button"
                                onClick={() => handleSelectTmdbResult(movie)}
                                className={`w-full p-2 flex items-center gap-2.5 text-left hover:bg-rose-50/60 dark:hover:bg-zinc-900 transition-colors cursor-pointer ${
                                  isSelected ? "bg-rose-50 dark:bg-rose-500/15" : ""
                                }`}
                              >
                                {thumbUrl ? (
                                  <img
                                    src={thumbUrl}
                                    alt={movie.title}
                                    className="w-8 h-12 rounded-md object-cover bg-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-12 rounded-md bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-slate-400 shrink-0">
                                    <Film size={14} />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                                    {movie.isCustom ? `🎨 [Custom] ${movie.title}` : movie.title}
                                  </p>
                                  {movie.release_date && (
                                    <p className="text-[10px] text-slate-500">
                                      Año: {movie.release_date.split("-")[0]}
                                    </p>
                                  )}
                                </div>
                                {isSelected && (
                                  <Check size={15} className="text-rose-600 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Option 2: External URL */}
                  {imageMode === "url" && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                        Pegar URL directa de imagen (https://...)
                      </label>
                      <input
                        type="url"
                        value={externalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        placeholder="https://ejemplo.com/poster-pelicula.jpg"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-900 dark:text-zinc-100 focus:bg-white focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Option 3: Without Image */}
                  {imageMode === "none" && (
                    <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-3 flex items-center gap-2.5 text-slate-600 dark:text-zinc-400">
                      <ImageOff size={16} className="shrink-0 text-slate-400" />
                      <p className="text-[11px] leading-relaxed">
                        Este material se guardará <strong>sin imagen</strong> (solo control numérico de stock en bodega y exposición).
                      </p>
                    </div>
                  )}

                  {/* Option 4 (LAST OPTION): Upload File from Device with Server Load Warning */}
                  {imageMode === "upload" && (
                    <div className="space-y-2.5">
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 p-3 flex items-start gap-2.5">
                        <AlertTriangle
                          size={16}
                          className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                        />
                        <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                          <strong className="font-extrabold block mb-0.5">
                            Última opción — Evitá sobrecargar el servidor:
                          </strong>
                          Por favor, verificá primero si podés encontrar la imagen usando el buscador de{" "}
                          <strong>TMDB (Opción 1)</strong> o pegando una{" "}
                          <strong>URL externa (Opción 2)</strong>. Usá la carga manual de archivo únicamente cuando la imagen no exista en ninguna de las opciones anteriores.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handlePickFile}
                        className="w-full px-3 py-2.5 rounded-xl border border-dashed border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Upload size={14} />
                        <span className="truncate">
                          {selectedFile ? selectedFile.name : "Seleccionar imagen del dispositivo…"}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Column: Live Card Preview */}
                <div className="md:col-span-5 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Vista Previa del Material
                  </span>
                  <div className="w-44 aspect-[2/2.7] rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 overflow-hidden flex flex-col justify-between shadow-sm relative">
                    {modalPreviewUrl ? (
                      <>
                        <img
                          src={modalPreviewUrl}
                          alt="Vista previa"
                          className="w-full h-full object-cover"
                        />
                        {imageMode !== "none" && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPosterUrl("");
                              setExternalUrl("");
                              setSelectedFile(null);
                              setImageMode("none");
                            }}
                            title="Quitar imagen y dejar sin imagen"
                            className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-slate-950/75 hover:bg-rose-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <X size={11} />
                            Quitar
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-2 border ${CATEGORY_META[formCategory].badgeBg} ${CATEGORY_META[formCategory].badgeText} ${CATEGORY_META[formCategory].badgeBorder}`}
                        >
                          {renderCategoryIcon(formCategory, 20)}
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 line-clamp-2">
                          {formTitulo || "Nombre del material"}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">
                          Sin imagen asignada
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-2 left-2 right-2 rounded-xl bg-slate-950/85 text-white p-2 text-[10px] backdrop-blur-xs">
                      <div className="font-extrabold truncate">
                        {formTitulo || "Sin título"}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-slate-300">
                        <span>Bodega: {computedModalBodega}</span>
                        <span className="text-emerald-400 font-bold">
                          Expo: {parsedModalExpo}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-600 dark:text-rose-300">
                  {formError}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200/80 dark:border-zinc-800 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveMaterial}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                <Check size={14} />
                <span>{saving ? "Guardando…" : editingItem ? "Guardar Cambios" : "Crear Material"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
              Eliminar material del stock
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              ¿Estás seguro de que querés eliminar{" "}
              <strong className="text-slate-800 dark:text-zinc-200">
                {deleteTarget.titulo}
              </strong>{" "}
              ({CATEGORY_META[deleteTarget.categoria].label}) del control de stock?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
