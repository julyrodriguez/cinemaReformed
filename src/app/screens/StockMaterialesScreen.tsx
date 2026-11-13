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
  ImageOff,
  Film,
  Sparkles,
  AlertTriangle,
  Eye,
  Archive,
  Edit3,
  Minus,
  ArrowRightLeft,
  Frame,
  UserSquare2,
  RefreshCw,
  MapPin,
  Tag,
  CheckCircle2,
  LayoutGrid,
  List,
  Save,
  RotateCcw,
  PackagePlus,
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

export interface CategoryStock {
  enBodega: number;
  enExposicion: number;
}

export type MaterialsMap = Record<MaterialCategory, CategoryStock>;

export interface MovieStockItem {
  id: string;
  legacyDocIds?: string[];
  titulo: string;
  notas?: string;
  posterUrl: string;
  imageSource?: ImageSourceMode;
  materiales: MaterialsMap;
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

const CATEGORIES: MaterialCategory[] = ["poster", "banner", "standee"];

const CATEGORY_META: Record<
  MaterialCategory,
  {
    label: string;
    pluralLabel: string;
    description: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    activeRing: string;
    accentColor: string;
  }
> = {
  poster: {
    label: "Póster",
    pluralLabel: "Pósters",
    description: "Afiches y marquesinas",
    badgeBg: "bg-blue-50 dark:bg-blue-500/15",
    badgeText: "text-blue-700 dark:text-blue-300",
    badgeBorder: "border-blue-200 dark:border-blue-500/30",
    activeRing: "ring-blue-500/25 border-blue-500",
    accentColor: "#3b82f6",
  },
  banner: {
    label: "Banner",
    pluralLabel: "Banners",
    description: "Lonas y portabanners",
    badgeBg: "bg-emerald-50 dark:bg-emerald-500/15",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    badgeBorder: "border-emerald-200 dark:border-emerald-500/30",
    activeRing: "ring-emerald-500/25 border-emerald-500",
    accentColor: "#10b981",
  },
  standee: {
    label: "Standee",
    pluralLabel: "Standees",
    description: "Corpóreos de lobby",
    badgeBg: "bg-violet-50 dark:bg-violet-500/15",
    badgeText: "text-violet-700 dark:text-violet-300",
    badgeBorder: "border-violet-200 dark:border-violet-500/30",
    activeRing: "ring-violet-500/25 border-violet-500",
    accentColor: "#8b5cf6",
  },
};

function createEmptyMaterials(): MaterialsMap {
  return {
    poster: { enBodega: 0, enExposicion: 0 },
    banner: { enBodega: 0, enExposicion: 0 },
    standee: { enBodega: 0, enExposicion: 0 },
  };
}

function cloneMaterials(m: MaterialsMap): MaterialsMap {
  return {
    poster: { ...m.poster },
    banner: { ...m.banner },
    standee: { ...m.standee },
  };
}

function materialsEqual(a: MaterialsMap, b: MaterialsMap): boolean {
  return CATEGORIES.every(
    (cat) =>
      a[cat].enBodega === b[cat].enBodega &&
      a[cat].enExposicion === b[cat].enExposicion
  );
}

function getCategoryTotal(item: MovieStockItem, cat: MaterialCategory): number {
  const s = item.materiales[cat];
  return (s?.enBodega || 0) + (s?.enExposicion || 0);
}

function getActiveCategories(item: MovieStockItem): MaterialCategory[] {
  return CATEGORIES.filter((cat) => getCategoryTotal(item, cat) > 0);
}

function getMovieTotals(item: MovieStockItem) {
  let bodega = 0;
  let exposicion = 0;
  CATEGORIES.forEach((cat) => {
    bodega += Math.max(0, item.materiales[cat]?.enBodega || 0);
    exposicion += Math.max(0, item.materiales[cat]?.enExposicion || 0);
  });
  return { bodega, exposicion, total: bodega + exposicion };
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

  const [items, setItems] = useState<MovieStockItem[]>([]);
  const [savedMaterials, setSavedMaterials] = useState<Record<string, MaterialsMap>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filters & View Mode
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | MaterialCategory>("ALL");
  const [stockFilter, setStockFilter] = useState<"ALL" | "EXPOSICION" | "BODEGA" | "SIN_STOCK">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    try {
      const saved = window.localStorage.getItem("stock_materiales_view_mode");
      return saved === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });

  const handleChangeViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    try {
      window.localStorage.setItem("stock_materiales_view_mode", mode);
    } catch {
      // ignore
    }
  };

  // Unified Movie Modal state:
  // "arrival" = tap a movie to add incoming materials (e.g. +50 posters, +3 banners)
  // "create"  = register a new movie with its initial materials
  // "edit"    = edit movie details, poster, and exact stock per material
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"arrival" | "create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<MovieStockItem | null>(null);

  // Arrival quantities (when adding incoming stock to an existing movie)
  const [arrivalCounts, setArrivalCounts] = useState<Record<MaterialCategory, string>>({
    poster: "0",
    banner: "0",
    standee: "0",
  });

  // Create / Edit movie form state
  const [formTitulo, setFormTitulo] = useState("");
  const [formNotas, setFormNotas] = useState("");
  const [formMaterialTotals, setFormMaterialTotals] = useState<Record<MaterialCategory, string>>({
    poster: "0",
    banner: "0",
    standee: "0",
  });
  const [formMaterialExpos, setFormMaterialExpos] = useState<Record<MaterialCategory, string>>({
    poster: "0",
    banner: "0",
    standee: "0",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Image selection inside Modal (Order: 1. tmdb, 2. url, 3. none, 4. upload)
  const [imageMode, setImageMode] = useState<ImageSourceMode>("tmdb");
  const [selectedPosterUrl, setSelectedPosterUrl] = useState("");
  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [searchingTmdb, setSearchingTmdb] = useState(false);
  const [hasSearchedTmdb, setHasSearchedTmdb] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    dataUri: string;
  } | null>(null);

  // Quick Exposition Modal (to set exact X in exposition subtracting from bodega for a movie + category)
  const [expoModalTarget, setExpoModalTarget] = useState<{
    item: MovieStockItem;
    category: MaterialCategory;
  } | null>(null);
  const [expoInputVal, setExpoInputVal] = useState("");
  const [bodegaTotalInputVal, setBodegaTotalInputVal] = useState("");
  const [expoModalError, setExpoModalError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MovieStockItem | null>(null);

  const loadMaterials = useCallback(async () => {
    if (!cineId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const colRef = collection(db, CINES_COLLECTION, cineId, "stock_materiales");
      const snap = await getDocs(colRef);

      const grouped = new Map<string, MovieStockItem>();

      snap.docs.forEach((d: any) => {
        const data = d.data() || {};
        const titulo = (data.titulo || "Sin título").trim();
        const key = titulo.toLowerCase() || d.id;

        const docMaterials = createEmptyMaterials();
        if (data.materiales && typeof data.materiales === "object") {
          CATEGORIES.forEach((cat) => {
            const catData = data.materiales[cat] || {};
            docMaterials[cat] = {
              enBodega: Math.max(0, Number(catData.enBodega ?? 0)),
              enExposicion: Math.max(0, Number(catData.enExposicion ?? 0)),
            };
          });
        } else {
          // Legacy single-category document
          const cat: MaterialCategory = (["poster", "banner", "standee"].includes(data.categoria)
            ? data.categoria
            : "poster") as MaterialCategory;
          docMaterials[cat] = {
            enBodega: Math.max(0, Number(data.enBodega ?? 0)),
            enExposicion: Math.max(0, Number(data.enExposicion ?? 0)),
          };
        }

        const existing = grouped.get(key);
        if (!existing) {
          grouped.set(key, {
            id: d.id,
            legacyDocIds: [d.id],
            titulo,
            notas: data.notas || "",
            posterUrl: data.posterUrl || "",
            imageSource: data.imageSource || (data.posterUrl ? "tmdb" : "none"),
            materiales: docMaterials,
            updatedAt: data.updatedAt || "",
            updatedBy: data.updatedBy || "",
          });
        } else {
          existing.legacyDocIds = [...(existing.legacyDocIds || [existing.id]), d.id];
          CATEGORIES.forEach((cat) => {
            existing.materiales[cat].enBodega += docMaterials[cat].enBodega;
            existing.materiales[cat].enExposicion += docMaterials[cat].enExposicion;
          });
          if (!existing.posterUrl && data.posterUrl) {
            existing.posterUrl = data.posterUrl;
            existing.imageSource = data.imageSource || "tmdb";
          }
          if (!existing.notas && data.notas) {
            existing.notas = data.notas;
          }
          if (
            data.updatedAt &&
            new Date(data.updatedAt).getTime() > new Date(existing.updatedAt || 0).getTime()
          ) {
            existing.updatedAt = data.updatedAt;
            existing.updatedBy = data.updatedBy || existing.updatedBy;
          }
        }
      });

      const list = Array.from(grouped.values());
      list.sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );

      const initialSaved: Record<string, MaterialsMap> = {};
      list.forEach((it) => {
        initialSaved[it.id] = cloneMaterials(it.materiales);
      });
      setSavedMaterials(initialSaved);
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
    const byCat: Record<MaterialCategory, { movies: number; bodega: number; exposicion: number }> = {
      poster: { movies: 0, bodega: 0, exposicion: 0 },
      banner: { movies: 0, bodega: 0, exposicion: 0 },
      standee: { movies: 0, bodega: 0, exposicion: 0 },
    };

    items.forEach((item) => {
      const totals = getMovieTotals(item);
      totalBodega += totals.bodega;
      totalExposicion += totals.exposicion;
      totalUnidades += totals.total;

      CATEGORIES.forEach((cat) => {
        const bod = Math.max(0, item.materiales[cat]?.enBodega || 0);
        const exp = Math.max(0, item.materiales[cat]?.enExposicion || 0);
        if (bod + exp > 0) {
          byCat[cat].movies += 1;
          byCat[cat].bodega += bod;
          byCat[cat].exposicion += exp;
        }
      });
    });

    return {
      totalMovies: items.length,
      totalUnidades,
      totalBodega,
      totalExposicion,
      byCat,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory !== "ALL" && getCategoryTotal(item, selectedCategory) <= 0) {
        return false;
      }

      if (selectedCategory === "ALL") {
        const totals = getMovieTotals(item);
        if (stockFilter === "EXPOSICION" && totals.exposicion <= 0) return false;
        if (stockFilter === "BODEGA" && totals.bodega <= 0) return false;
        if (stockFilter === "SIN_STOCK" && totals.total > 0) return false;
      } else {
        const catStock = item.materiales[selectedCategory];
        const catTotal = catStock.enBodega + catStock.enExposicion;
        if (stockFilter === "EXPOSICION" && catStock.enExposicion <= 0) return false;
        if (stockFilter === "BODEGA" && catStock.enBodega <= 0) return false;
        if (stockFilter === "SIN_STOCK" && catTotal > 0) return false;
      }

      if (!q) return true;
      const activeCatLabels = getActiveCategories(item)
        .map((c) => `${CATEGORY_META[c].label} ${CATEGORY_META[c].pluralLabel}`.toLowerCase())
        .join(" ");
      return (
        item.titulo.toLowerCase().includes(q) ||
        (item.notas && item.notas.toLowerCase().includes(q)) ||
        activeCatLabels.includes(q)
      );
    });
  }, [items, selectedCategory, stockFilter, searchQuery]);

  // Check if typed title matches an existing movie when creating
  const matchingExistingMovie = useMemo(() => {
    if (modalMode !== "create") return null;
    const clean = formTitulo.trim().toLowerCase();
    if (!clean) return null;
    return items.find((it) => it.titulo.trim().toLowerCase() === clean) || null;
  }, [modalMode, formTitulo, items]);

  const populateEditFormFromItem = (item: MovieStockItem) => {
    setFormTitulo(item.titulo);
    setFormNotas(item.notas || "");
    setFormMaterialTotals({
      poster: String(getCategoryTotal(item, "poster")),
      banner: String(getCategoryTotal(item, "banner")),
      standee: String(getCategoryTotal(item, "standee")),
    });
    setFormMaterialExpos({
      poster: String(item.materiales.poster.enExposicion),
      banner: String(item.materiales.banner.enExposicion),
      standee: String(item.materiales.standee.enExposicion),
    });

    const source = item.imageSource || (item.posterUrl ? "tmdb" : "none");
    setImageMode(source);
    setSelectedPosterUrl(item.posterUrl || "");
    setTmdbQuery(item.titulo);
    setTmdbResults([]);
    setHasSearchedTmdb(false);
    setExternalUrl(source === "url" ? item.posterUrl : "");
    setSelectedFile(
      source === "upload" && item.posterUrl
        ? { name: "Imagen cargada", dataUri: item.posterUrl }
        : null
    );
  };

  // Open modal for New Movie
  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalMode("create");
    setFormTitulo("");
    setFormNotas("");
    setFormMaterialTotals({ poster: "0", banner: "0", standee: "0" });
    setFormMaterialExpos({ poster: "0", banner: "0", standee: "0" });
    setArrivalCounts({ poster: "0", banner: "0", standee: "0" });
    setFormError(null);
    setImageMode("tmdb");
    setSelectedPosterUrl("");
    setTmdbQuery("");
    setTmdbResults([]);
    setHasSearchedTmdb(false);
    setExternalUrl("");
    setSelectedFile(null);
    setShowModal(true);
  };

  // Open modal for Arrival on an existing Movie ("toco batman y elijo que materiales me llegaron")
  const handleOpenArrival = (item: MovieStockItem) => {
    setEditingItem(item);
    setModalMode("arrival");
    setArrivalCounts({ poster: "0", banner: "0", standee: "0" });
    populateEditFormFromItem(item);
    setFormError(null);
    setShowModal(true);
  };

  // Open modal for Full Edit of an existing Movie
  const handleOpenEdit = (item: MovieStockItem) => {
    setEditingItem(item);
    setModalMode("edit");
    setArrivalCounts({ poster: "0", banner: "0", standee: "0" });
    populateEditFormFromItem(item);
    setFormError(null);
    setShowModal(true);
  };

  // Persist a MovieStockItem in unified format & clean up redundant legacy docs
  const persistMovieDoc = async (
    movie: Omit<MovieStockItem, "id"> & { id?: string },
    nowIso: string
  ) => {
    if (!cineId) return;
    const payload = {
      titulo: movie.titulo.trim(),
      notas: (movie.notas || "").trim(),
      posterUrl: movie.posterUrl || "",
      imageSource: movie.posterUrl ? movie.imageSource || "tmdb" : ("none" as ImageSourceMode),
      materiales: cloneMaterials(movie.materiales),
      updatedAt: nowIso,
      updatedBy: userEmail,
    };

    if (movie.id) {
      const docRef = doc(db, CINES_COLLECTION, cineId, "stock_materiales", movie.id);
      await setDoc(docRef, payload);

      const extras = (movie.legacyDocIds || []).filter((docId) => docId !== movie.id);
      if (extras.length > 0) {
        await Promise.all(
          extras.map((extraId) =>
            deleteDoc(doc(db, CINES_COLLECTION, cineId, "stock_materiales", extraId))
          )
        );
      }
    } else {
      const colRef = collection(db, CINES_COLLECTION, cineId, "stock_materiales");
      await addDoc(colRef, payload);
    }
  };

  // Search TMDB + Local Custom Posters
  const handleSearchTmdb = async (overrideQuery?: string) => {
    const queryText = (overrideQuery ?? (tmdbQuery.trim() || formTitulo.trim())).trim();
    if (!queryText) return;

    try {
      setSearchingTmdb(true);
      setHasSearchedTmdb(true);
      setTmdbResults([]);

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

      setTmdbResults([...localResults, ...remoteResults]);
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

  // Step helpers for Create/Edit form per category
  const stepFormTotal = (cat: MaterialCategory, delta: number) => {
    const curTotal = Math.max(0, parseInt(formMaterialTotals[cat] || "0", 10) || 0);
    const curExpo = Math.max(0, parseInt(formMaterialExpos[cat] || "0", 10) || 0);
    const nextTotal = Math.max(0, curTotal + delta);
    setFormMaterialTotals((prev) => ({ ...prev, [cat]: String(nextTotal) }));
    if (curExpo > nextTotal) {
      setFormMaterialExpos((prev) => ({ ...prev, [cat]: String(nextTotal) }));
    }
  };

  const stepFormExpo = (cat: MaterialCategory, delta: number) => {
    const curTotal = Math.max(0, parseInt(formMaterialTotals[cat] || "0", 10) || 0);
    const curExpo = Math.max(0, parseInt(formMaterialExpos[cat] || "0", 10) || 0);
    const nextExpo = Math.max(0, Math.min(curTotal, curExpo + delta));
    setFormMaterialExpos((prev) => ({ ...prev, [cat]: String(nextExpo) }));
  };

  const stepArrivalCount = (cat: MaterialCategory, delta: number) => {
    const cur = Math.max(0, parseInt(arrivalCounts[cat] || "0", 10) || 0);
    const next = Math.max(0, cur + delta);
    setArrivalCounts((prev) => ({ ...prev, [cat]: String(next) }));
  };

  // Save incoming materials ("arrival" mode)
  const handleSaveArrival = async () => {
    if (!cineId || !editingItem) return;
    setFormError(null);

    const addPoster = Math.max(0, parseInt(arrivalCounts.poster || "0", 10) || 0);
    const addBanner = Math.max(0, parseInt(arrivalCounts.banner || "0", 10) || 0);
    const addStandee = Math.max(0, parseInt(arrivalCounts.standee || "0", 10) || 0);

    if (addPoster + addBanner + addStandee <= 0) {
      setFormError("Ingresá al menos 1 unidad que haya llegado en Pósters, Banners o Standees.");
      return;
    }

    const updatedMaterials = cloneMaterials(editingItem.materiales);
    updatedMaterials.poster.enBodega += addPoster;
    updatedMaterials.banner.enBodega += addBanner;
    updatedMaterials.standee.enBodega += addStandee;

    try {
      setSaving(true);
      await persistMovieDoc(
        {
          ...editingItem,
          materiales: updatedMaterials,
        },
        new Date().toISOString()
      );
      setShowModal(false);
      await loadMaterials();
    } catch (e: any) {
      console.error("Error saving arrival:", e);
      setFormError(e?.message || "No se pudo sumar el stock recibido.");
    } finally {
      setSaving(false);
    }
  };

  // Save Create / Edit Movie
  const handleSaveMovie = async () => {
    setFormError(null);
    if (!cineId) return;

    if (!formTitulo.trim()) {
      setFormError("Por favor ingresá el nombre de la película.");
      return;
    }

    const nextMaterials = createEmptyMaterials();
    let grandTotal = 0;

    for (const cat of CATEGORIES) {
      const totalNum = parseInt(formMaterialTotals[cat] || "0", 10);
      const expoNum = parseInt(formMaterialExpos[cat] || "0", 10);

      if (isNaN(totalNum) || totalNum < 0) {
        setFormError(`El stock total de ${CATEGORY_META[cat].pluralLabel} debe ser mayor o igual a 0.`);
        return;
      }
      if (isNaN(expoNum) || expoNum < 0) {
        setFormError(`La exposición de ${CATEGORY_META[cat].pluralLabel} debe ser mayor o igual a 0.`);
        return;
      }
      if (expoNum > totalNum) {
        setFormError(
          `En ${CATEGORY_META[cat].pluralLabel}, no podés poner ${expoNum} en exposición si el total es ${totalNum}.`
        );
        return;
      }
      nextMaterials[cat] = {
        enBodega: totalNum - expoNum,
        enExposicion: expoNum,
      };
      grandTotal += totalNum;
    }

    if (modalMode === "create" && grandTotal <= 0) {
      setFormError("Cargá al menos 1 unidad en Pósters, Banners o Standees.");
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
      finalPosterUrl = selectedPosterUrl || "";
    }

    try {
      setSaving(true);
      await persistMovieDoc(
        {
          id: editingItem?.id,
          legacyDocIds: editingItem?.legacyDocIds,
          titulo: formTitulo.trim(),
          notas: formNotas.trim(),
          posterUrl: finalPosterUrl,
          imageSource: finalPosterUrl ? imageMode : ("none" as ImageSourceMode),
          materiales: nextMaterials,
          updatedAt: new Date().toISOString(),
          updatedBy: userEmail,
        },
        new Date().toISOString()
      );
      setShowModal(false);
      await loadMaterials();
    } catch (e: any) {
      console.error("Error saving movie stock:", e);
      setFormError(e?.message || "No se pudo guardar la película.");
    } finally {
      setSaving(false);
    }
  };

  // Stage local change between Bodega and Exposición for a specific category of a movie
  const handleAdjustExposicion = (
    item: MovieStockItem,
    category: MaterialCategory,
    deltaExpo: number
  ) => {
    const current = item.materiales[category];
    const total = current.enBodega + current.enExposicion;
    const nextExpo = current.enExposicion + deltaExpo;
    if (nextExpo < 0 || nextExpo > total) return;
    const nextBodega = total - nextExpo;

    const updatedMaterials = cloneMaterials(item.materiales);
    updatedMaterials[category] = { enBodega: nextBodega, enExposicion: nextExpo };

    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, materiales: updatedMaterials } : it))
    );
  };

  // Stage local Bodega adjustment for a specific category of a movie
  const handleAdjustBodega = (
    item: MovieStockItem,
    category: MaterialCategory,
    deltaBodega: number
  ) => {
    const current = item.materiales[category];
    const nextBodega = current.enBodega + deltaBodega;
    if (nextBodega < 0) return;

    const updatedMaterials = cloneMaterials(item.materiales);
    updatedMaterials[category] = { ...current, enBodega: nextBodega };

    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, materiales: updatedMaterials } : it))
    );
  };

  // Detect which movies have unsaved Bodega / Exposición changes
  const isItemDirty = useCallback(
    (item: MovieStockItem) => {
      const orig = savedMaterials[item.id];
      if (!orig) return false;
      return !materialsEqual(orig, item.materiales);
    },
    [savedMaterials]
  );

  const dirtyItems = useMemo(
    () => items.filter((item) => isItemDirty(item)),
    [items, isItemDirty]
  );

  const handleDiscardItemChanges = (itemId: string) => {
    const orig = savedMaterials[itemId];
    if (!orig) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, materiales: cloneMaterials(orig) } : it
      )
    );
  };

  const handleDiscardAllChanges = () => {
    setItems((prev) =>
      prev.map((it) => {
        const orig = savedMaterials[it.id];
        if (!orig) return it;
        return { ...it, materiales: cloneMaterials(orig) };
      })
    );
  };

  const handleSaveSingleItemStock = async (item: MovieStockItem) => {
    if (!cineId) return;
    setUpdatingId(item.id);
    try {
      const nowIso = new Date().toISOString();
      await persistMovieDoc(item, nowIso);
      setSavedMaterials((prev) => ({
        ...prev,
        [item.id]: cloneMaterials(item.materiales),
      }));
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, legacyDocIds: [item.id], updatedAt: nowIso, updatedBy: userEmail }
            : it
        )
      );
    } catch (e) {
      console.error("Error saving item stock:", e);
      Alert.alert("Error", "No se pudo guardar el cambio de stock.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveAllDirtyItems = async () => {
    if (!cineId || dirtyItems.length === 0) return;
    setSavingBatch(true);
    try {
      const nowIso = new Date().toISOString();
      await Promise.all(dirtyItems.map((item) => persistMovieDoc(item, nowIso)));

      setSavedMaterials((prev) => {
        const next = { ...prev };
        dirtyItems.forEach((it) => {
          next[it.id] = cloneMaterials(it.materiales);
        });
        return next;
      });
      setItems((prev) =>
        prev.map((it) =>
          isItemDirty(it)
            ? { ...it, legacyDocIds: [it.id], updatedAt: nowIso, updatedBy: userEmail }
            : it
        )
      );
    } catch (e) {
      console.error("Error saving batch stock changes:", e);
      Alert.alert("Error", "No se pudieron guardar todos los cambios de stock.");
    } finally {
      setSavingBatch(false);
    }
  };

  // Open Quick Exposition / Stock Modal for a movie + category
  const handleOpenExpoModal = (item: MovieStockItem, category: MaterialCategory) => {
    const stock = item.materiales[category];
    setExpoModalTarget({ item, category });
    setExpoInputVal(String(stock.enExposicion));
    setBodegaTotalInputVal(String(stock.enBodega + stock.enExposicion));
    setExpoModalError(null);
  };

  const handleSaveExpoModal = () => {
    if (!expoModalTarget) return;
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

    const { item, category } = expoModalTarget;
    const nextBodega = totalNum - expoNum;
    const updatedMaterials = cloneMaterials(item.materiales);
    updatedMaterials[category] = { enBodega: nextBodega, enExposicion: expoNum };

    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, materiales: updatedMaterials } : it
      )
    );
    setExpoModalTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !cineId) return;
    try {
      const idsToDelete = Array.from(
        new Set([deleteTarget.id, ...(deleteTarget.legacyDocIds || [])])
      );
      await Promise.all(
        idsToDelete.map((docId) =>
          deleteDoc(doc(db, CINES_COLLECTION, cineId, "stock_materiales", docId))
        )
      );
      setDeleteTarget(null);
      await loadMaterials();
    } catch (e) {
      console.error("Error deleting movie stock:", e);
      Alert.alert("Error", "No se pudo eliminar la película.");
    }
  };

  const renderCategoryIcon = (cat: MaterialCategory, size = 14) => {
    if (cat === "poster") return <Film size={size} />;
    if (cat === "banner") return <Frame size={size} />;
    return <UserSquare2 size={size} />;
  };

  // Which categories should be shown on a given card/row based on the active filter
  const getVisibleCategoriesForItem = (item: MovieStockItem): MaterialCategory[] => {
    if (selectedCategory !== "ALL") {
      return [selectedCategory];
    }
    return getActiveCategories(item);
  };

  // Preview totals in Create/Edit modal
  const modalPreviewTotals = useMemo(() => {
    let total = 0;
    let expo = 0;
    CATEGORIES.forEach((cat) => {
      total += Math.max(0, parseInt(formMaterialTotals[cat] || "0", 10) || 0);
      expo += Math.max(0, parseInt(formMaterialExpos[cat] || "0", 10) || 0);
    });
    const bodega = Math.max(0, total - expo);
    return { total, expo, bodega };
  }, [formMaterialTotals, formMaterialExpos]);

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
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 tabular-nums">
                  {stats.totalMovies} {stats.totalMovies === 1 ? "película" : "películas"} •{" "}
                  {stats.totalUnidades} u. totales
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Tocá una película para cargar los materiales que llegaron (Pósters, Banners y Standees agrupados por título)
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
              <span>Nueva Película / Material</span>
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
              <span className="text-base font-black text-amber-900 dark:text-amber-200 tabular-nums">
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
              <span className="text-base font-black text-emerald-900 dark:text-emerald-200 tabular-nums">
                {stats.totalExposicion}
              </span>
            </div>
            <Eye size={18} className="text-emerald-600 dark:text-emerald-400 opacity-80" />
          </div>

          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const cStats = stats.byCat[cat];
            return (
              <div
                key={cat}
                className="rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200/80 dark:border-zinc-800 px-3 py-2 flex items-center justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                    {meta.pluralLabel} ({cStats.movies})
                  </span>
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-zinc-200 tabular-nums">
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

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
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

            {/* View Mode Toggle: Tarjetas vs Lista Compacta */}
            <div className="inline-flex items-center bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => handleChangeViewMode("grid")}
                title="Vista en tarjetas"
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xs"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-800"
                }`}
              >
                <LayoutGrid size={13} />
                <span className="hidden sm:inline">Tarjetas</span>
              </button>
              <button
                type="button"
                onClick={() => handleChangeViewMode("list")}
                title="Vista en lista compacta"
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  viewMode === "list"
                    ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xs"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-800"
                }`}
              >
                <List size={13} />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-7 h-7 rounded-full border-2 border-slate-200 border-t-rose-600 animate-spin mb-2.5" />
          <span className="text-xs font-semibold">Cargando stock de materiales…</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 p-12 text-center max-w-md mx-auto my-6 animate-card-in">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
            <Package size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-1">
            {searchQuery || selectedCategory !== "ALL" || stockFilter !== "ALL"
              ? "Sin películas que coincidan con el filtro"
              : "Todavía no hay películas con materiales registrados"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 leading-relaxed">
            {searchQuery || selectedCategory !== "ALL" || stockFilter !== "ALL"
              ? "Probá cambiando la categoría o el término de búsqueda."
              : "Registrá una película y cargá todos los materiales que llegaron (Pósters, Banners y Standees) en un mismo lugar."}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:bg-rose-600 dark:hover:bg-rose-500 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Cargar Primera Película
          </button>
        </div>
      ) : viewMode === "list" ? (
        /* High-Density Compact List View (1 Row per Movie, all its materials inside) */
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800/80">
          {filteredItems.map((item, idx) => {
            const totals = getMovieTotals(item);
            const visibleCats = getVisibleCategoriesForItem(item);
            const isUpdating = updatingId === item.id;
            const dirty = isItemDirty(item);

            return (
              <div
                key={item.id}
                style={{ animationDelay: `${Math.min(idx * 15, 180)}ms` }}
                className={`animate-card-in px-3 sm:px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-colors ${
                  dirty
                    ? "bg-rose-50/40 dark:bg-rose-950/20"
                    : "hover:bg-slate-50/80 dark:hover:bg-zinc-950/50"
                }`}
              >
                {/* Left: Clickable Movie Thumbnail + Title + Material Summary Pills */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleOpenArrival(item)}
                    title={`Tocar ${item.titulo} para cargar llegada de materiales`}
                    className="w-10 h-14 rounded-lg bg-slate-100 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-rose-500/40 transition-all"
                  >
                    {item.posterUrl ? (
                      <img
                        src={item.posterUrl}
                        alt={item.titulo}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Film size={16} className="text-slate-400" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenArrival(item)}
                        className="text-left text-xs sm:text-sm font-extrabold text-slate-900 dark:text-zinc-100 hover:text-rose-600 dark:hover:text-rose-400 truncate cursor-pointer transition-colors"
                        title={`Tocar ${item.titulo} para cargar materiales`}
                      >
                        {item.titulo}
                      </button>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 tabular-nums">
                        ({totals.total} u. totales)
                      </span>
                    </div>

                    {/* Material Breakdown Badges on the same row */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {visibleCats.length === 0 ? (
                        <span className="text-[10px] font-semibold text-slate-400">
                          Sin unidades cargadas
                        </span>
                      ) : (
                        visibleCats.map((cat) => {
                          const meta = CATEGORY_META[cat];
                          const catTotal = getCategoryTotal(item, cat);
                          return (
                            <span
                              key={cat}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border tabular-nums ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                            >
                              {renderCategoryIcon(cat, 10)}
                              <span>
                                {catTotal} {catTotal === 1 ? meta.label : meta.pluralLabel}
                              </span>
                            </span>
                          );
                        })
                      )}
                      {item.notas ? (
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          • {item.notas}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Right: Per-category compact inline controls + actions */}
                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 shrink-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {visibleCats.map((cat) => {
                      const meta = CATEGORY_META[cat];
                      const st = item.materiales[cat];
                      return (
                        <div
                          key={cat}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800"
                        >
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-extrabold ${meta.badgeText} pr-1 border-r border-slate-200 dark:border-zinc-800`}
                          >
                            {renderCategoryIcon(cat, 10)}
                            <span>{meta.pluralLabel}</span>
                          </span>

                          {/* Bodega */}
                          <div className="inline-flex items-center gap-1">
                            <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300">
                              Bod
                            </span>
                            <button
                              type="button"
                              disabled={isUpdating || st.enBodega <= 0}
                              onClick={() => handleAdjustBodega(item, cat, -1)}
                              className="w-5 h-5 rounded-md bg-white dark:bg-zinc-900 border border-amber-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-amber-50 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                            >
                              <Minus size={9} />
                            </button>
                            <span className="min-w-[18px] text-center text-[11px] font-black text-amber-900 dark:text-amber-200 tabular-nums">
                              {st.enBodega}
                            </span>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleAdjustBodega(item, cat, 1)}
                              className="w-5 h-5 rounded-md bg-white dark:bg-zinc-900 border border-amber-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-amber-50 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                            >
                              <Plus size={9} />
                            </button>
                          </div>

                          {/* Expo */}
                          <div className="inline-flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-zinc-800">
                            <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                              Exp
                            </span>
                            <button
                              type="button"
                              disabled={isUpdating || st.enExposicion <= 0}
                              onClick={() => handleAdjustExposicion(item, cat, -1)}
                              className="w-5 h-5 rounded-md bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                            >
                              <Minus size={9} />
                            </button>
                            <span className="min-w-[18px] text-center text-[11px] font-black text-emerald-900 dark:text-emerald-200 tabular-nums">
                              {st.enExposicion}
                            </span>
                            <button
                              type="button"
                              disabled={isUpdating || st.enBodega <= 0}
                              onClick={() => handleAdjustExposicion(item, cat, 1)}
                              className="w-5 h-5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                            >
                              <Plus size={9} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenExpoModal(item, cat)}
                            title={`Mover ${meta.pluralLabel} entre Bodega y Exposición`}
                            className="w-5 h-5 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-rose-500 hover:bg-rose-50 flex items-center justify-center cursor-pointer ml-0.5"
                          >
                            <ArrowRightLeft size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
                    {dirty && (
                      <>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleSaveSingleItemStock(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-2xs cursor-pointer animate-pop-in"
                        >
                          <Save size={11} />
                          <span>{isUpdating ? "Guardando…" : "Guardar"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDiscardItemChanges(item.id)}
                          title="Descartar cambio"
                          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                        >
                          <RotateCcw size={11} />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenArrival(item)}
                      title="Cargar llegada de materiales"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-[11px] font-bold cursor-pointer"
                    >
                      <PackagePlus size={12} />
                      <span>Cargar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      title="Editar película / imagen"
                      className="w-7 h-7 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      title="Eliminar película"
                      className="w-7 h-7 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Grid Cards View: 1 Card per Movie, showing all its materials inside */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item, idx) => {
            const totals = getMovieTotals(item);
            const visibleCats = getVisibleCategoriesForItem(item);
            const isUpdating = updatingId === item.id;
            const dirty = isItemDirty(item);

            return (
              <div
                key={item.id}
                style={{ animationDelay: `${Math.min(idx * 25, 250)}ms` }}
                className={`animate-card-in hover-lift group bg-white dark:bg-zinc-900 rounded-2xl border shadow-xs overflow-hidden flex flex-col justify-between ${
                  dirty
                    ? "border-rose-400 dark:border-rose-500/70 ring-2 ring-rose-500/15"
                    : "border-slate-200/90 dark:border-zinc-800"
                }`}
              >
                {/* Top Poster Area — Clicking opens Arrival modal for this movie */}
                <div
                  onClick={() => handleOpenArrival(item)}
                  title={`Tocar ${item.titulo} para cargar materiales que llegaron`}
                  className="relative aspect-[2/2.3] w-full bg-slate-100 dark:bg-zinc-950 overflow-hidden cursor-pointer"
                >
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={item.titulo}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-950">
                      <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200/70 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-2">
                        <Film size={22} />
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

                  {/* Top-Left: Material Pills Summary (e.g., 10 Banners, 5 Pósters) */}
                  <div className="absolute top-2.5 left-2.5 right-20 flex flex-wrap gap-1 pointer-events-none">
                    {visibleCats.map((cat) => {
                      const meta = CATEGORY_META[cat];
                      const catTotal = getCategoryTotal(item, cat);
                      return (
                        <span
                          key={cat}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide border backdrop-blur-md shadow-xs tabular-nums ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                        >
                          {renderCategoryIcon(cat, 10)}
                          <span>
                            {catTotal} {catTotal === 1 ? meta.label : meta.pluralLabel}
                          </span>
                        </span>
                      );
                    })}
                  </div>

                  {/* Action Buttons Top-Right */}
                  <div
                    className="absolute top-2.5 right-2.5 flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      title="Editar película / imagen / stock"
                      className="w-7 h-7 rounded-xl bg-slate-950/75 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      title="Eliminar película"
                      className="w-7 h-7 rounded-xl bg-slate-950/75 hover:bg-rose-600 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Active Exposition Floating Badge */}
                  {totals.exposicion > 0 && (
                    <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-xl bg-emerald-600/95 text-white text-[11px] font-extrabold flex items-center justify-between shadow-sm backdrop-blur-xs tabular-nums pointer-events-none">
                      <span className="inline-flex items-center gap-1">
                        <Eye size={12} />
                        En Exposición
                      </span>
                      <span>{totals.exposicion} u.</span>
                    </div>
                  )}
                </div>

                {/* Card Body: Title + Per-Material Breakdown & Controls */}
                <div className="p-3 flex flex-col justify-between flex-1 gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => handleOpenArrival(item)}
                      className="min-w-0 flex-1 cursor-pointer group/title"
                    >
                      <h4
                        title={item.titulo}
                        className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-zinc-100 group-hover/title:text-rose-600 dark:group-hover/title:text-rose-400 line-clamp-1 leading-snug transition-colors"
                      >
                        {item.titulo}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 tabular-nums line-clamp-1">
                        {item.notas ? (
                          <span>{item.notas} • </span>
                        ) : null}
                        Total:{" "}
                        <strong className="text-slate-600 dark:text-zinc-300">
                          {totals.total} u.
                        </strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenArrival(item)}
                      title="Cargar llegada de materiales"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 border border-rose-200/80 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-[10px] font-extrabold shrink-0 cursor-pointer transition-colors"
                    >
                      <PackagePlus size={11} />
                      <span>+ Cargar</span>
                    </button>
                  </div>

                  {/* Breakdown per material inside the SAME movie card */}
                  <div className="space-y-2">
                    {visibleCats.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => handleOpenArrival(item)}
                        className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 text-xs font-bold text-slate-500 dark:text-zinc-400 hover:border-rose-400 hover:text-rose-600 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <PackagePlus size={14} />
                        <span>Cargar materiales</span>
                      </button>
                    ) : (
                      visibleCats.map((cat) => {
                        const meta = CATEGORY_META[cat];
                        const st = item.materiales[cat];
                        const catTotal = st.enBodega + st.enExposicion;

                        return (
                          <div
                            key={cat}
                            className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 p-2 space-y-1.5"
                          >
                            {/* Material Subheader */}
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                                >
                                  {renderCategoryIcon(cat, 10)}
                                  <span>{meta.pluralLabel}</span>
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 tabular-nums">
                                  {catTotal} u.
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleOpenExpoModal(item, cat)}
                                title={`Mover ${meta.pluralLabel} entre Bodega y Exposición`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-800 text-[10px] font-bold text-slate-600 dark:text-zinc-300 cursor-pointer"
                              >
                                <ArrowRightLeft size={10} className="text-rose-500" />
                                <span>Mover</span>
                              </button>
                            </div>

                            {/* Bodega & Exposición compact rows */}
                            <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/60 dark:border-zinc-800/80">
                              {/* Bodega */}
                              <div className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-lg border border-slate-200/70 dark:border-zinc-800 px-1.5 py-1">
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                  Bod
                                </span>
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    disabled={isUpdating || st.enBodega <= 0}
                                    onClick={() => handleAdjustBodega(item, cat, -1)}
                                    className="w-5 h-5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                                  >
                                    <Minus size={10} />
                                  </button>
                                  <span className="min-w-[18px] text-center text-[11px] font-black text-amber-800 dark:text-amber-200 tabular-nums">
                                    {st.enBodega}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleAdjustBodega(item, cat, 1)}
                                    className="w-5 h-5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </div>
                              </div>

                              {/* Exposición */}
                              <div className="flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200/70 dark:border-emerald-500/25 px-1.5 py-1">
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                  Exp
                                </span>
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    disabled={isUpdating || st.enExposicion <= 0}
                                    onClick={() => handleAdjustExposicion(item, cat, -1)}
                                    className="w-5 h-5 rounded-md hover:bg-emerald-100/70 dark:hover:bg-zinc-800 text-emerald-700 dark:text-emerald-300 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                                  >
                                    <Minus size={10} />
                                  </button>
                                  <span className="min-w-[18px] text-center text-[11px] font-black text-emerald-800 dark:text-emerald-200 tabular-nums">
                                    {st.enExposicion}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isUpdating || st.enBodega <= 0}
                                    onClick={() => handleAdjustExposicion(item, cat, 1)}
                                    className="w-5 h-5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Confirm / Save Button when stock is modified */}
                    {dirty && (
                      <div className="pt-1 flex items-center gap-1.5 animate-pop-in">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleSaveSingleItemStock(item)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white text-[11px] font-extrabold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Save size={12} />
                          <span>{isUpdating ? "Guardando…" : "Guardar cambios"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDiscardItemChanges(item.id)}
                          title="Descartar cambios"
                          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-500 hover:text-slate-800 flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <RotateCcw size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Mover entre Bodega y Exposición (Asignación Rápida por Categoría) */}
      {expoModalTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-xs animate-backdrop-in"
          onClick={() => setExpoModalTarget(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-2xl overflow-hidden animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200/70 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ArrowRightLeft size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
                    Distribución de Stock
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[250px]">
                    {expoModalTarget.item.titulo} •{" "}
                    {CATEGORY_META[expoModalTarget.category].pluralLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpoModalTarget(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {(() => {
                const tot = Math.max(0, parseInt(bodegaTotalInputVal || "0", 10) || 0);
                const exp = Math.max(0, parseInt(expoInputVal || "0", 10) || 0);
                const bod = Math.max(0, tot - exp);
                const expPercent = tot > 0 ? Math.min(100, Math.round((exp / tot) * 100)) : 0;

                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/90 dark:border-zinc-800 p-3">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                          Stock Total
                        </span>
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.max(0, tot - 1);
                              setBodegaTotalInputVal(String(next));
                              if (exp > next) setExpoInputVal(String(next));
                            }}
                            className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-slate-100 cursor-pointer"
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={bodegaTotalInputVal}
                            onChange={(e) =>
                              setBodegaTotalInputVal(e.target.value.replace(/[^\d]/g, ""))
                            }
                            className="w-14 text-center bg-transparent text-base font-black text-slate-900 dark:text-zinc-100 tabular-nums focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setBodegaTotalInputVal(String(tot + 1))}
                            className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-slate-100 cursor-pointer"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-200/90 dark:border-emerald-500/30 p-3">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-2">
                          En Exposición
                        </span>
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => setExpoInputVal(String(Math.max(0, exp - 1)))}
                            className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 cursor-pointer"
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={expoInputVal}
                            onChange={(e) =>
                              setExpoInputVal(e.target.value.replace(/[^\d]/g, ""))
                            }
                            className="w-14 text-center bg-transparent text-base font-black text-emerald-800 dark:text-emerald-200 tabular-nums focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setExpoInputVal(String(Math.min(tot, exp + 1)))
                            }
                            className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 cursor-pointer"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold tabular-nums">
                        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                          <Archive size={13} />
                          En Bodega: <strong>{bod} u.</strong>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                          <Eye size={13} />
                          En Exposición: <strong>{exp} u.</strong>
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-amber-200/70 dark:bg-amber-500/20 overflow-hidden flex">
                        <div
                          style={{ width: `${100 - expPercent}%` }}
                          className="h-full bg-amber-500 transition-all duration-200"
                        />
                        <div
                          style={{ width: `${expPercent}%` }}
                          className="h-full bg-emerald-500 transition-all duration-200"
                        />
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 text-center">
                        Las <strong>{exp}</strong> unidades en exposición se descuentan automáticamente de las <strong>{tot}</strong> totales.
                      </p>
                    </div>
                  </>
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
                  onClick={() => setExpoModalTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveExpoModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-rose-600 dark:hover:bg-rose-500 text-white dark:text-zinc-900 dark:hover:text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  <Check size={14} />
                  <span>Aplicar Cambios</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Modal: Cargar Llegada (sobre película) / Nueva Película / Editar Película */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/55 backdrop-blur-xs overflow-y-auto animate-backdrop-in"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200/70 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  {modalMode === "arrival" ? (
                    <PackagePlus size={18} strokeWidth={2.2} />
                  ) : (
                    <Sparkles size={17} strokeWidth={2.2} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                    {modalMode === "arrival" && editingItem
                      ? `Cargar llegada: ${editingItem.titulo}`
                      : modalMode === "edit"
                      ? "Editar Película y Stock"
                      : "Registrar Película y Materiales"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {modalMode === "arrival"
                      ? "Elegí qué materiales llegaron hoy (se suman automáticamente a bodega)"
                      : "Cargá la película, su imagen y las cantidades de Pósters, Banners y Standees"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {editingItem && (
                  <div className="hidden sm:inline-flex items-center bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setModalMode("arrival");
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        modalMode === "arrival"
                          ? "bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-2xs"
                          : "text-slate-500 dark:text-zinc-400 hover:text-slate-800"
                      }`}
                    >
                      Cargar llegada
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setModalMode("edit");
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        modalMode === "edit"
                          ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xs"
                          : "text-slate-500 dark:text-zinc-400 hover:text-slate-800"
                      }`}
                    >
                      Editar todo
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1">
              {modalMode === "arrival" && editingItem ? (
                /* ARRIVAL MODE: Fast movie-based incoming material entry */
                <div className="space-y-5">
                  {/* Mobile mode switcher */}
                  <div className="flex sm:hidden items-center bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setModalMode("arrival")}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-zinc-800 text-rose-600 shadow-2xs"
                    >
                      Cargar llegada
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalMode("edit")}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold text-slate-500"
                    >
                      Editar película / stock
                    </button>
                  </div>

                  {/* Selected Movie Banner */}
                  <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 p-3.5 flex items-center gap-3.5">
                    <div className="w-14 h-20 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {editingItem.posterUrl ? (
                        <img
                          src={editingItem.posterUrl}
                          alt={editingItem.titulo}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film size={20} className="text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        Película seleccionada
                      </span>
                      <h4 className="text-base font-extrabold text-slate-900 dark:text-zinc-100 truncate">
                        {editingItem.titulo}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {CATEGORIES.map((cat) => {
                          const meta = CATEGORY_META[cat];
                          const catTotal = getCategoryTotal(editingItem, cat);
                          return (
                            <span
                              key={cat}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border tabular-nums ${
                                catTotal > 0
                                  ? `${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`
                                  : "bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-800"
                              }`}
                            >
                              {renderCategoryIcon(cat, 10)}
                              <span>
                                Actual: {catTotal} {meta.pluralLabel}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Incoming Material Counters */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        ¿Qué materiales llegaron para {editingItem.titulo}?
                      </label>
                      <span className="text-[11px] font-semibold text-slate-400">
                        Se suman al stock en bodega
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {CATEGORIES.map((cat) => {
                        const meta = CATEGORY_META[cat];
                        const addQty = Math.max(0, parseInt(arrivalCounts[cat] || "0", 10) || 0);
                        const currentTotal = getCategoryTotal(editingItem, cat);
                        const currentBod = editingItem.materiales[cat].enBodega;
                        const active = addQty > 0;

                        return (
                          <div
                            key={cat}
                            className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all ${
                              active
                                ? `${meta.badgeBg} ${meta.activeRing} ring-2`
                                : "bg-slate-50/70 dark:bg-zinc-950 border-slate-200/90 dark:border-zinc-800"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                    active
                                      ? `bg-white dark:bg-zinc-900 shadow-2xs ${meta.badgeText}`
                                      : "bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                                  }`}
                                >
                                  {renderCategoryIcon(cat, 16)}
                                </div>
                                <div>
                                  <span
                                    className={`text-xs font-extrabold block ${
                                      active
                                        ? meta.badgeText
                                        : "text-slate-800 dark:text-zinc-200"
                                    }`}
                                  >
                                    {meta.pluralLabel}
                                  </span>
                                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 tabular-nums">
                                    Tenés {currentTotal} u. ({currentBod} bod.)
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Input + Stepper */}
                            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-1.5 rounded-xl border border-slate-200/90 dark:border-zinc-800 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => stepArrivalCount(cat, -1)}
                                disabled={addQty <= 0}
                                className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 text-slate-700 dark:text-zinc-200 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={arrivalCounts[cat]}
                                onChange={(e) =>
                                  setArrivalCounts((prev) => ({
                                    ...prev,
                                    [cat]: e.target.value.replace(/[^\d]/g, ""),
                                  }))
                                }
                                placeholder="0"
                                className="w-16 text-center bg-transparent text-base font-black text-slate-900 dark:text-zinc-100 tabular-nums focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => stepArrivalCount(cat, 1)}
                                className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 text-slate-700 dark:text-zinc-200 flex items-center justify-center cursor-pointer"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            {/* Quick Preset Pills */}
                            <div className="flex items-center justify-between gap-1">
                              {[1, 5, 10, 50].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => stepArrivalCount(cat, preset)}
                                  className="flex-1 py-1 rounded-lg bg-white/80 dark:bg-zinc-900 hover:bg-white dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-800 text-[10px] font-extrabold text-slate-600 dark:text-zinc-300 cursor-pointer tabular-nums"
                                >
                                  +{preset}
                                </button>
                              ))}
                            </div>

                            {active && (
                              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 text-center tabular-nums">
                                Nuevo total: {currentTotal + addQty} u.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* CREATE / EDIT MODE: Studio Layout */
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Live Studio Preview Card (5 cols) */}
                  <div className="md:col-span-5 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-zinc-800/90 p-4 flex flex-col items-center justify-between gap-4">
                    <div className="w-full flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        Vista Previa en Vivo
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-200/70 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 tabular-nums">
                        {modalPreviewTotals.total} u. totales
                      </span>
                    </div>

                    {/* Poster Card Mockup */}
                    <div className="w-48 sm:w-52 aspect-[2/2.85] rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md overflow-hidden relative flex flex-col justify-between">
                      {modalPreviewUrl ? (
                        <>
                          <img
                            src={modalPreviewUrl}
                            alt="Vista previa"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPosterUrl("");
                              setExternalUrl("");
                              setSelectedFile(null);
                              setImageMode("none");
                            }}
                            title="Quitar imagen y dejar sin imagen"
                            className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-rose-600 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs shadow-sm transition-colors cursor-pointer"
                          >
                            <X size={11} />
                            Quitar
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center bg-gradient-to-b from-white to-slate-50 dark:from-zinc-900 dark:to-zinc-950">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 border shadow-2xs bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30">
                            <Film size={26} />
                          </div>
                          <span className="text-xs font-extrabold text-slate-800 dark:text-zinc-200 line-clamp-2 leading-snug">
                            {formTitulo.trim() || "Nombre de la película"}
                          </span>
                          {formNotas.trim() && (
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 line-clamp-1 mt-0.5">
                              {formNotas.trim()}
                            </span>
                          )}
                          <span className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                            <ImageOff size={10} />
                            {imageMode === "none" ? "Sin imagen" : "Elegí o buscá una imagen"}
                          </span>
                        </div>
                      )}

                      {/* Floating Bottom Info Overlay */}
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 rounded-xl bg-slate-950/88 text-white p-2.5 text-[11px] backdrop-blur-md shadow-lg border border-white/10">
                        <div className="font-extrabold truncate leading-tight">
                          {formTitulo.trim() || "Sin título asignado"}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-white/10 text-[9px] tabular-nums">
                          {CATEGORIES.map((cat) => {
                            const t = Math.max(0, parseInt(formMaterialTotals[cat] || "0", 10) || 0);
                            if (t <= 0) return null;
                            return (
                              <span
                                key={cat}
                                className="px-1.5 py-0.5 rounded bg-white/15 font-bold"
                              >
                                {t} {CATEGORY_META[cat].pluralLabel}
                              </span>
                            );
                          })}
                          {modalPreviewTotals.total === 0 && (
                            <span className="text-slate-300">Sin materiales cargados</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Live Distribution Bar inside Studio Column */}
                    <div className="w-full rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                        <span className="text-slate-500 dark:text-zinc-400">
                          Total:{" "}
                          <strong className="text-slate-900 dark:text-zinc-100">
                            {modalPreviewTotals.total} u.
                          </strong>
                        </span>
                        <span className="text-amber-700 dark:text-amber-300">
                          Bod: <strong>{modalPreviewTotals.bodega}</strong>
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-400">
                          Exp: <strong>{modalPreviewTotals.expo}</strong>
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-amber-200/70 dark:bg-amber-500/20 overflow-hidden flex">
                        <div
                          style={{
                            width: `${
                              modalPreviewTotals.total > 0
                                ? Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      Math.round(
                                        (modalPreviewTotals.bodega / modalPreviewTotals.total) * 100
                                      )
                                    )
                                  )
                                : 100
                            }%`,
                          }}
                          className="h-full bg-amber-500 transition-all duration-200"
                        />
                        <div
                          style={{
                            width: `${
                              modalPreviewTotals.total > 0
                                ? Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      Math.round(
                                        (modalPreviewTotals.expo / modalPreviewTotals.total) * 100
                                      )
                                    )
                                  )
                                : 0
                            }%`,
                          }}
                          className="h-full bg-emerald-500 transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Form Sections (7 cols) */}
                  <div className="md:col-span-7 space-y-5">
                    {/* 1. Identification Inputs */}
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                        1. Película
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-7">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                            Título de la Película *
                          </label>
                          <div className="relative">
                            <Tag
                              size={14}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                            <input
                              type="text"
                              value={formTitulo}
                              onChange={(e) => setFormTitulo(e.target.value)}
                              placeholder="Ej: Batman"
                              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                            Ubicación / Notas
                          </label>
                          <div className="relative">
                            <MapPin
                              size={14}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                            <input
                              type="text"
                              value={formNotas}
                              onChange={(e) => setFormNotas(e.target.value)}
                              placeholder="Ej: Hall / Depósito 2"
                              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-200 focus:bg-white dark:focus:bg-zinc-900"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Duplicate movie detection: quick switch to arrival */}
                      {matchingExistingMovie && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2 animate-pop-in">
                          <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                            Ya existe <strong>{matchingExistingMovie.titulo}</strong> en tu stock.
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenArrival(matchingExistingMovie)}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                          >
                            Cargar llegada a esta peli →
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 2. Materials for this movie (Póster, Banner, Standee) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          2. Materiales de la Película
                        </label>
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                          Exposición descuenta de bodega
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {CATEGORIES.map((cat) => {
                          const meta = CATEGORY_META[cat];
                          const tot = Math.max(0, parseInt(formMaterialTotals[cat] || "0", 10) || 0);
                          const exp = Math.max(0, parseInt(formMaterialExpos[cat] || "0", 10) || 0);
                          const bod = Math.max(0, tot - exp);

                          return (
                            <div
                              key={cat}
                              className={`rounded-xl border p-3 transition-colors ${
                                tot > 0
                                  ? `${meta.badgeBg} ${meta.badgeBorder}`
                                  : "bg-slate-50/70 dark:bg-zinc-950 border-slate-200/90 dark:border-zinc-800"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                      tot > 0
                                        ? `bg-white dark:bg-zinc-900 shadow-2xs ${meta.badgeText}`
                                        : "bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                                    }`}
                                  >
                                    {renderCategoryIcon(cat, 14)}
                                  </div>
                                  <div>
                                    <span
                                      className={`text-xs font-extrabold block ${
                                        tot > 0
                                          ? meta.badgeText
                                          : "text-slate-800 dark:text-zinc-200"
                                      }`}
                                    >
                                      {meta.pluralLabel}
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 tabular-nums">
                                      En bodega: <strong>{bod} u.</strong>
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Total */}
                                  <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-bold uppercase text-slate-500 dark:text-zinc-400 mb-0.5">
                                      Total
                                    </span>
                                    <div className="flex items-center bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-0.5">
                                      <button
                                        type="button"
                                        onClick={() => stepFormTotal(cat, -1)}
                                        disabled={tot <= 0}
                                        className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                                      >
                                        <Minus size={11} />
                                      </button>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={formMaterialTotals[cat]}
                                        onChange={(e) =>
                                          setFormMaterialTotals((prev) => ({
                                            ...prev,
                                            [cat]: e.target.value.replace(/[^\d]/g, ""),
                                          }))
                                        }
                                        className="w-10 text-center bg-transparent text-xs font-black text-slate-900 dark:text-zinc-100 tabular-nums focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => stepFormTotal(cat, 1)}
                                        className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center cursor-pointer"
                                      >
                                        <Plus size={11} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Exposición */}
                                  <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-300 mb-0.5">
                                      Expo
                                    </span>
                                    <div className="flex items-center bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200 dark:border-emerald-500/30 p-0.5">
                                      <button
                                        type="button"
                                        onClick={() => stepFormExpo(cat, -1)}
                                        disabled={exp <= 0}
                                        className="w-6 h-6 rounded-md hover:bg-emerald-50 dark:hover:bg-zinc-800 text-emerald-700 dark:text-emerald-300 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                                      >
                                        <Minus size={11} />
                                      </button>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={formMaterialExpos[cat]}
                                        onChange={(e) =>
                                          setFormMaterialExpos((prev) => ({
                                            ...prev,
                                            [cat]: e.target.value.replace(/[^\d]/g, ""),
                                          }))
                                        }
                                        className="w-10 text-center bg-transparent text-xs font-black text-emerald-800 dark:text-emerald-200 tabular-nums focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => stepFormExpo(cat, 1)}
                                        disabled={exp >= tot}
                                        className="w-6 h-6 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                                      >
                                        <Plus size={11} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. Image Source Selector (TMDB -> URL -> Sin Imagen -> Subir Archivo) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          3. Imagen de la Película
                        </label>
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                          Priorizá TMDB o URL para cuidar el servidor
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100/90 dark:bg-zinc-950 p-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setImageMode("tmdb")}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            imageMode === "tmdb"
                              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                          }`}
                        >
                          <Search size={13} className={imageMode === "tmdb" ? "text-rose-600" : ""} />
                          <span>TMDB</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setImageMode("url")}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            imageMode === "url"
                              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                          }`}
                        >
                          <Link2 size={13} className={imageMode === "url" ? "text-rose-600" : ""} />
                          <span>URL Web</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setImageMode("none");
                            setSelectedPosterUrl("");
                          }}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            imageMode === "none"
                              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                          }`}
                        >
                          <ImageOff size={13} />
                          <span>Sin Imagen</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setImageMode("upload")}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            imageMode === "upload"
                              ? "bg-amber-500 text-white shadow-xs"
                              : "text-amber-700 dark:text-amber-400 hover:bg-amber-50/70 dark:hover:bg-amber-950/30"
                          }`}
                        >
                          <Upload size={13} />
                          <span>Subir Archivo</span>
                        </button>
                      </div>

                      {imageMode === "tmdb" && (
                        <div className="rounded-xl bg-slate-50/80 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 p-3.5 space-y-3 animate-pop-in">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Search
                                size={13}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                              />
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
                                  formTitulo.trim()
                                    ? `Buscar "${formTitulo.trim()}" en TMDB…`
                                    : "Escribí el título de la película para buscar póster…"
                                }
                                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-900 dark:text-zinc-100"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSearchTmdb()}
                              disabled={searchingTmdb}
                              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:bg-rose-600 dark:hover:bg-rose-500 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                            >
                              {searchingTmdb ? "Buscando…" : "Buscar en TMDB"}
                            </button>
                          </div>

                          {formTitulo.trim() &&
                            tmdbQuery.trim() !== formTitulo.trim() &&
                            tmdbResults.length === 0 &&
                            !searchingTmdb && (
                              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                                <span>
                                  ¿Querés buscar el póster de{" "}
                                  <strong className="text-slate-700 dark:text-zinc-300">
                                    {formTitulo.trim()}
                                  </strong>
                                  ?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTmdbQuery(formTitulo.trim());
                                    handleSearchTmdb(formTitulo.trim());
                                  }}
                                  className="text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                                >
                                  Buscar ahora →
                                </button>
                              </div>
                            )}

                          {tmdbResults.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                              {tmdbResults.map((movie) => {
                                const thumbUrl = buildPosterDisplayUrl(movie.poster_path);
                                const isSelected = selectedPosterUrl === thumbUrl && !!thumbUrl;
                                return (
                                  <button
                                    key={movie.id}
                                    type="button"
                                    onClick={() => handleSelectTmdbResult(movie)}
                                    className={`group/item p-2 rounded-xl border flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-rose-50/90 dark:bg-rose-500/15 border-rose-500 ring-1 ring-rose-500/30"
                                        : "bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800 hover:border-slate-300"
                                    }`}
                                  >
                                    {thumbUrl ? (
                                      <img
                                        src={thumbUrl}
                                        alt={movie.title}
                                        className="w-9 h-13 rounded-lg object-cover bg-slate-100 shrink-0 shadow-2xs"
                                      />
                                    ) : (
                                      <div className="w-9 h-13 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 shrink-0">
                                        <Film size={14} />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-bold text-slate-900 dark:text-zinc-100 line-clamp-2 leading-tight">
                                        {movie.isCustom ? `🎨 ${movie.title}` : movie.title}
                                      </p>
                                      {movie.release_date && (
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                          {movie.release_date.split("-")[0]}
                                        </p>
                                      )}
                                    </div>
                                    {isSelected && (
                                      <CheckCircle2
                                        size={15}
                                        className="text-rose-600 dark:text-rose-400 shrink-0"
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : hasSearchedTmdb && !searchingTmdb ? (
                            <p className="text-xs text-slate-500 text-center py-2">
                              No se encontraron resultados en TMDB. Probá con otro nombre o usá una URL externa.
                            </p>
                          ) : null}
                        </div>
                      )}

                      {imageMode === "url" && (
                        <div className="rounded-xl bg-slate-50/80 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 p-3.5 space-y-2 animate-pop-in">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                            Enlace directo de la imagen (https://...)
                          </label>
                          <div className="relative">
                            <Link2
                              size={14}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                            <input
                              type="url"
                              value={externalUrl}
                              onChange={(e) => setExternalUrl(e.target.value)}
                              placeholder="https://image.tmdb.org/... o URL de imagen"
                              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-900 dark:text-zinc-100"
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                            La imagen se carga directamente desde la URL externa sin ocupar almacenamiento del servidor.
                          </p>
                        </div>
                      )}

                      {imageMode === "none" && (
                        <div className="rounded-xl bg-slate-50/80 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 p-4 flex items-center gap-3 text-slate-600 dark:text-zinc-400 animate-pop-in">
                          <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageOff size={17} />
                          </div>
                          <div className="text-xs leading-relaxed">
                            <strong className="font-bold text-slate-800 dark:text-zinc-200 block">
                              Película sin imagen asignada
                            </strong>
                            Se mostrará una tarjeta limpia con el título de la película y el desglose de sus materiales.
                          </div>
                        </div>
                      )}

                      {imageMode === "upload" && (
                        <div className="rounded-xl bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/70 p-3.5 space-y-3 animate-pop-in">
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                              <AlertTriangle size={15} />
                            </div>
                            <div className="text-[11px] text-amber-950 dark:text-amber-200 leading-relaxed">
                              <strong className="font-extrabold block">
                                Usar solo como última opción para no sobrecargar el servidor
                              </strong>
                              Antes de subir un archivo propio, verificá si la imagen está disponible en{" "}
                              <button
                                type="button"
                                onClick={() => setImageMode("tmdb")}
                                className="underline font-bold cursor-pointer"
                              >
                                TMDB
                              </button>{" "}
                              o mediante una{" "}
                              <button
                                type="button"
                                onClick={() => setImageMode("url")}
                                className="underline font-bold cursor-pointer"
                              >
                                URL Web
                              </button>
                              .
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handlePickFile}
                            className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-amber-400/90 dark:border-amber-600 bg-white/90 dark:bg-zinc-900/90 hover:bg-amber-50 dark:hover:bg-zinc-900 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                          >
                            <Upload size={15} className="text-amber-600" />
                            <span className="truncate">
                              {selectedFile
                                ? `Archivo listo: ${selectedFile.name}`
                                : "Seleccionar imagen desde el dispositivo…"}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {formError && (
                <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-600 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50/90 dark:bg-zinc-950 border-t border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 hidden sm:inline">
                {modalMode === "arrival"
                  ? "Las cantidades ingresadas se sumarán al stock en bodega."
                  : "Podés tocar la película en cualquier momento para cargar nuevas llegadas."}
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={modalMode === "arrival" ? handleSaveArrival : handleSaveMovie}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 disabled:opacity-50 text-white text-xs font-bold shadow-sm shadow-rose-500/20 cursor-pointer"
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>
                    {saving
                      ? "Guardando…"
                      : modalMode === "arrival"
                      ? "Sumar al Stock"
                      : modalMode === "edit"
                      ? "Guardar Cambios"
                      : "Registrar Película"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Bar to Confirm Unsaved Stock Modifications */}
      {dirtyItems.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-24px)] max-w-lg animate-pop-in">
          <div className="rounded-2xl bg-slate-900 dark:bg-zinc-900 border border-slate-700 dark:border-zinc-700 px-4 py-3 shadow-2xl flex items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-extrabold truncate">
                  {dirtyItems.length === 1
                    ? "1 película con cambios sin guardar"
                    : `${dirtyItems.length} películas con cambios sin guardar`}
                </p>
                <p className="text-[10px] text-slate-300 truncate">
                  Confirmá para actualizar el stock de bodega y exposición
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={savingBatch}
                onClick={handleDiscardAllChanges}
                className="px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-[11px] font-bold text-slate-300 cursor-pointer"
              >
                Descartar
              </button>
              <button
                type="button"
                disabled={savingBatch}
                onClick={handleSaveAllDirtyItems}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm cursor-pointer"
              >
                <Save size={13} />
                <span>{savingBatch ? "Guardando…" : "Guardar cambios"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-xs animate-backdrop-in"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-2xl animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
              Eliminar película del stock
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              ¿Estás seguro de que querés eliminar{" "}
              <strong className="text-slate-800 dark:text-zinc-200">
                {deleteTarget.titulo}
              </strong>{" "}
              y todos sus materiales del control de stock?
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
