import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { doc, getDoc, setDoc } from "@/lib/dbService";
import * as Print from "expo-print";
import dayjs from "dayjs";

import { db, CINES_COLLECTION } from "../../lib/firebaseConfig";
import { COLORS, THEME } from "../../lib/theme";
import { useAuthUser } from "../../lib/useAuthUser";
import { getCineConfig } from "../../lib/cineConfig";

// ─── Definición de Parlantes 5.1 (según esquema oficial) ─────────────────────

export type SpeakerId =
  | "SW1"
  | "SW2"
  | "SW3"
  | "SW4"
  | "L"
  | "C"
  | "R"
  | "LS1"
  | "LS2"
  | "LS3"
  | "LS4"
  | "LS5"
  | "LS6"
  | "LS7"
  | "RS1"
  | "RS2"
  | "RS3"
  | "RS4"
  | "RS5"
  | "RS6"
  | "RS7";

export type SpeakerStatus = "Óptimo" | "Con falla";

export type SpeakerZone = "Subwoofer" | "Pantalla (L/C/R)" | "Left Surround (LS)" | "Right Surround (RS)";

export interface SpeakerMeta {
  id: SpeakerId;
  label: string;
  zone: SpeakerZone;
  color: string;
}

export const SPEAKERS_5_1: SpeakerMeta[] = [
  // Subwoofers
  { id: "SW1", label: "Subwoofer 1", zone: "Subwoofer", color: "#8B8046" },
  { id: "SW2", label: "Subwoofer 2", zone: "Subwoofer", color: "#8B8046" },
  { id: "SW3", label: "Subwoofer 3", zone: "Subwoofer", color: "#8B8046" },
  { id: "SW4", label: "Subwoofer 4", zone: "Subwoofer", color: "#8B8046" },
  // Frente / Pantalla
  { id: "L", label: "Left (Izquierdo)", zone: "Pantalla (L/C/R)", color: "#2B7BBA" },
  { id: "C", label: "Center (Central)", zone: "Pantalla (L/C/R)", color: "#2B7BBA" },
  { id: "R", label: "Right (Derecho)", zone: "Pantalla (L/C/R)", color: "#2B7BBA" },
  // Left Surround
  { id: "LS1", label: "Left Surround 1", zone: "Left Surround (LS)", color: "#E59824" },
  { id: "LS2", label: "Left Surround 2", zone: "Left Surround (LS)", color: "#E59824" },
  { id: "LS3", label: "Left Surround 3", zone: "Left Surround (LS)", color: "#E59824" },
  { id: "LS4", label: "Left Surround 4", zone: "Left Surround (LS)", color: "#E59824" },
  { id: "LS5", label: "Left Surround 5", zone: "Left Surround (LS)", color: "#E59824" },
  { id: "LS6", label: "Left Surround 6 (Trasero)", zone: "Left Surround (LS)", color: "#E59824" },
  { id: "LS7", label: "Left Surround 7 (Trasero)", zone: "Left Surround (LS)", color: "#E59824" },
  // Right Surround
  { id: "RS1", label: "Right Surround 1", zone: "Right Surround (RS)", color: "#E59824" },
  { id: "RS2", label: "Right Surround 2", zone: "Right Surround (RS)", color: "#E59824" },
  { id: "RS3", label: "Right Surround 3", zone: "Right Surround (RS)", color: "#E59824" },
  { id: "RS4", label: "Right Surround 4", zone: "Right Surround (RS)", color: "#E59824" },
  { id: "RS5", label: "Right Surround 5", zone: "Right Surround (RS)", color: "#E59824" },
  { id: "RS6", label: "Right Surround 6 (Trasero)", zone: "Right Surround (RS)", color: "#E59824" },
  { id: "RS7", label: "Right Surround 7 (Trasero)", zone: "Right Surround (RS)", color: "#E59824" },
];

export interface SpeakerCheckItem {
  id: SpeakerId;
  estado: SpeakerStatus;
  observacion: string;
  accionSeguimiento: string;
}

export interface SavedMonthlySpeakers {
  responsable: string;
  subgerente: string;
  fecha: string;
  mesAno: string;
  salas: Record<string, SpeakerCheckItem[]>;
  updatedAt?: string;
}

function buildDefaultRoomSpeakers(): SpeakerCheckItem[] {
  return SPEAKERS_5_1.map((sp) => ({
    id: sp.id,
    estado: "Óptimo",
    observacion: "",
    accionSeguimiento: "",
  }));
}

function normalizeRoomSpeakers(rawList?: SpeakerCheckItem[]): SpeakerCheckItem[] {
  const map = new Map<string, SpeakerCheckItem>();
  if (Array.isArray(rawList)) {
    rawList.forEach((item) => {
      if (item && item.id) {
        map.set(item.id, {
          id: item.id as SpeakerId,
          estado: item.estado === "Con falla" ? "Con falla" : "Óptimo",
          observacion: item.observacion || "",
          accionSeguimiento: item.accionSeguimiento || "",
        });
      }
    });
  }
  return SPEAKERS_5_1.map((sp) => {
    const existing = map.get(sp.id);
    if (existing) return existing;
    return {
      id: sp.id,
      estado: "Óptimo",
      observacion: "",
      accionSeguimiento: "",
    };
  });
}

function formatMesAno(mesAnoStr: string) {
  if (!mesAnoStr) return "";
  const [y, m] = mesAnoStr.split("-");
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return `${months[parseInt(m, 10) - 1] || ""} ${y}`;
}

export default function ControlParlantesScreen({ readOnly = false }: { readOnly?: boolean }) {
  const { cineId, displayName } = useAuthUser();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWide = width >= 1120;

  // Selector de Mes y Año (al estilo Cierre de Mes)
  const [selectedMesAno, setSelectedMesAno] = useState(() => dayjs().format("YYYY-MM"));

  // Cabecera del control mensual
  const [responsable, setResponsable] = useState("");
  const [subgerente, setSubgerente] = useState("VICTOR DIAZ");
  const [fechaEnvio, setFechaEnvio] = useState(() => dayjs().format("YYYY-MM-DD"));

  // Configuración de salas del cine
  const [salasCount, setSalasCount] = useState(12);
  const [selectedSala, setSelectedSala] = useState<string>("1"); // "1".."N" o "RESUMEN"

  // Estado de carga y guardado
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSavedInDb, setIsSavedInDb] = useState(false);
  const [carriedFromPrevMonth, setCarriedFromPrevMonth] = useState(false);

  // Estado principal de parlantes por sala
  const [salasData, setSalasData] = useState<Record<string, SpeakerCheckItem[]>>({});

  // Filtros e interacción en la planilla
  const [filterMode, setFilterMode] = useState<"ALL" | "FALLA">("ALL");
  const [zoneFilter, setZoneFilter] = useState<string>("ALL");
  const [highlightedSpeaker, setHighlightedSpeaker] = useState<SpeakerId | null>(null);
  const [mapClickTogglesState, setMapClickTogglesState] = useState<boolean>(true);
  const [showResetRoomModal, setShowResetRoomModal] = useState<boolean>(false);

  // Inyectar animaciones CSS en Web para dar fluidez y feedback visual
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById("control-parlantes-animations")) return;

    const style = document.createElement("style");
    style.id = "control-parlantes-animations";
    style.textContent = `
      @keyframes speakerPulseFault {
        0%, 100% {
          box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.55);
          transform: scale(1);
        }
        50% {
          box-shadow: 0 0 0 7px rgba(220, 38, 38, 0);
          transform: scale(1.035);
        }
      }
      @keyframes speakerFadeSlide {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .cp-speaker-node {
        transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
                    background-color 180ms ease,
                    border-color 180ms ease,
                    box-shadow 180ms ease;
      }
      .cp-speaker-node:hover {
        transform: translateY(-2px) scale(1.05);
      }
      .cp-speaker-node:active {
        transform: scale(0.96);
      }
      .cp-speaker-fault {
        animation: speakerPulseFault 2s infinite ease-in-out;
      }
      .cp-row-item {
        animation: speakerFadeSlide 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
        transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
      }
      .cp-status-pill {
        transition: all 180ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .cp-status-pill:active {
        transform: scale(0.95);
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Opciones de meses (últimos 12 meses)
  const mesesOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i < 12; i++) {
      const d = dayjs().subtract(i, "month");
      const val = d.format("YYYY-MM");
      opts.push({
        value: val,
        label: formatMesAno(val),
      });
    }
    return opts;
  }, []);

  // 1. Cargar cantidad de salas configuradas en el cine
  useEffect(() => {
    if (!cineId) return;
    (async () => {
      try {
        const cfg = await getCineConfig(cineId);
        if (cfg?.salasCount && Number.isFinite(cfg.salasCount) && cfg.salasCount > 0) {
          setSalasCount(Math.floor(cfg.salasCount));
        }
      } catch (e) {
        console.error("Error al cargar salasCount en ControlParlantesScreen:", e);
      }
    })();
  }, [cineId]);

  // 2. Cargar datos del mes seleccionado (o heredar fallas en seguimiento del mes anterior)
  useEffect(() => {
    if (!cineId) return;
    loadOrCreateMonthlyControl();
  }, [cineId, selectedMesAno, salasCount]);

  const loadOrCreateMonthlyControl = async () => {
    if (!cineId) return;
    setLoading(true);
    try {
      const docRef = doc(db, CINES_COLLECTION, cineId, "control_mensual_parlantes", selectedMesAno);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as SavedMonthlySpeakers;
        setResponsable(data.responsable || "");
        setSubgerente(data.subgerente || "VICTOR DIAZ");
        setFechaEnvio(data.fecha || dayjs().format("YYYY-MM-DD"));

        const loadedSalas: Record<string, SpeakerCheckItem[]> = {};
        for (let i = 1; i <= salasCount; i++) {
          const key = String(i);
          loadedSalas[key] = normalizeRoomSpeakers(data.salas?.[key]);
        }
        setSalasData(loadedSalas);
        setIsSavedInDb(true);
        setCarriedFromPrevMonth(false);
      } else {
        setIsSavedInDb(false);
        setFechaEnvio(dayjs().format("YYYY-MM-DD"));

        // Intentar recuperar fallas en seguimiento del mes anterior
        const prevMonthStr = dayjs(selectedMesAno).subtract(1, "month").format("YYYY-MM");
        const prevDocRef = doc(db, CINES_COLLECTION, cineId, "control_mensual_parlantes", prevMonthStr);
        const prevSnap = await getDoc(prevDocRef);

        const initialSalas: Record<string, SpeakerCheckItem[]> = {};
        let foundCarryOver = false;

        if (prevSnap.exists()) {
          const prevData = prevSnap.data() as SavedMonthlySpeakers;
          if (prevData.responsable && !responsable) {
            setResponsable(prevData.responsable);
          }
          if (prevData.subgerente) {
            setSubgerente(prevData.subgerente);
          }
          for (let i = 1; i <= salasCount; i++) {
            const key = String(i);
            const normalized = normalizeRoomSpeakers(prevData.salas?.[key]);
            if (normalized.some((s) => s.estado === "Con falla" || s.accionSeguimiento.trim() !== "")) {
              foundCarryOver = true;
            }
            initialSalas[key] = normalized;
          }
        } else {
          for (let i = 1; i <= salasCount; i++) {
            initialSalas[String(i)] = buildDefaultRoomSpeakers();
          }
        }

        setSalasData(initialSalas);
        setCarriedFromPrevMonth(foundCarryOver);
      }
    } catch (e) {
      console.error("Error al cargar control mensual de parlantes:", e);
    } finally {
      setLoading(false);
    }
  };

  // ─── Estadísticas y Resumen Global ─────────────────────────────────────────

  const stats = useMemo(() => {
    let totalSpeakers = 0;
    let totalOptimos = 0;
    let totalFallas = 0;
    let salasConFalla = 0;
    const fallasPorSala: Record<string, number> = {};
    const allFallasList: Array<{ sala: string; item: SpeakerCheckItem; meta: SpeakerMeta }> = [];

    for (let i = 1; i <= salasCount; i++) {
      const key = String(i);
      const list = salasData[key] || buildDefaultRoomSpeakers();
      let roomFallas = 0;

      list.forEach((sp) => {
        totalSpeakers++;
        if (sp.estado === "Con falla") {
          totalFallas++;
          roomFallas++;
          const meta = SPEAKERS_5_1.find((m) => m.id === sp.id) || SPEAKERS_5_1[0];
          allFallasList.push({ sala: key, item: sp, meta });
        } else {
          totalOptimos++;
        }
      });

      fallasPorSala[key] = roomFallas;
      if (roomFallas > 0) salasConFalla++;
    }

    const healthPct = totalSpeakers > 0 ? Math.round((totalOptimos / totalSpeakers) * 100) : 100;

    return {
      totalSpeakers,
      totalOptimos,
      totalFallas,
      salasConFalla,
      salasOptimas: salasCount - salasConFalla,
      fallasPorSala,
      allFallasList,
      healthPct,
    };
  }, [salasData, salasCount]);

  // ─── Actualización de Estado de Parlantes ──────────────────────────────────

  const handleUpdateSpeaker = (
    salaKey: string,
    speakerId: SpeakerId,
    field: keyof SpeakerCheckItem,
    value: string
  ) => {
    if (readOnly) return;
    setSalasData((prev) => {
      const roomList = prev[salaKey] ? [...prev[salaKey]] : buildDefaultRoomSpeakers();
      const idx = roomList.findIndex((item) => item.id === speakerId);
      if (idx !== -1) {
        roomList[idx] = {
          ...roomList[idx],
          [field]: value,
        };
      }
      return {
        ...prev,
        [salaKey]: roomList,
      };
    });
  };

  const handleToggleSpeakerStatus = (salaKey: string, speakerId: SpeakerId) => {
    if (readOnly) return;
    setSalasData((prev) => {
      const roomList = prev[salaKey] ? [...prev[salaKey]] : buildDefaultRoomSpeakers();
      const idx = roomList.findIndex((item) => item.id === speakerId);
      if (idx !== -1) {
        const nextStatus: SpeakerStatus =
          roomList[idx].estado === "Óptimo" ? "Con falla" : "Óptimo";
        roomList[idx] = {
          ...roomList[idx],
          estado: nextStatus,
        };
      }
      return {
        ...prev,
        [salaKey]: roomList,
      };
    });
  };

  const handleResetCurrentRoomToOptimo = () => {
    if (readOnly || selectedSala === "RESUMEN") return;
    setSalasData((prev) => ({
      ...prev,
      [selectedSala]: buildDefaultRoomSpeakers(),
    }));
    setShowResetRoomModal(false);
  };

  // ─── Guardar en Base de Datos (Congelar Mes) ───────────────────────────────

  const handleSave = async () => {
    if (readOnly) return;
    if (!cineId) return;
    if (!(responsable || "").trim()) {
      Alert.alert("Atención", "Por favor ingresá el nombre del responsable del control mensual.");
      return;
    }

    setSaving(true);
    try {
      const cleanSalas: Record<string, SpeakerCheckItem[]> = {};
      for (let i = 1; i <= salasCount; i++) {
        const key = String(i);
        const list = normalizeRoomSpeakers(salasData[key]);
        cleanSalas[key] = list.map((sp) => ({
          id: sp.id,
          estado: sp.estado,
          observacion: (sp.observacion || "").trim(),
          accionSeguimiento: (sp.accionSeguimiento || "").trim(),
        }));
      }

      const docRef = doc(db, CINES_COLLECTION, cineId, "control_mensual_parlantes", selectedMesAno);
      const payload: SavedMonthlySpeakers = {
        responsable: responsable.trim().toUpperCase(),
        subgerente: subgerente.trim().toUpperCase(),
        fecha: fechaEnvio || dayjs().format("YYYY-MM-DD"),
        mesAno: selectedMesAno,
        salas: cleanSalas,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(docRef, payload);
      setIsSavedInDb(true);
      setCarriedFromPrevMonth(false);
      Alert.alert(
        "Guardado Exitoso",
        `El Control Mensual de Parlantes de ${formatMesAno(selectedMesAno)} se guardó correctamente en la base de datos.`
      );
    } catch (e: any) {
      console.error("Error al guardar control mensual de parlantes:", e);
      Alert.alert("Error", `No se pudo guardar la planilla: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ─── Generador de Reporte HTML (para Imprimir PDF o Descargar HTML) ────────

  const buildReportHtml = () => {
    const mesFormatted = formatMesAno(selectedMesAno).toUpperCase();
    const fechaFormatted = dayjs(fechaEnvio).isValid()
      ? dayjs(fechaEnvio).format("DD/MM/YYYY")
      : fechaEnvio;
    const complejo = (displayName || cineId || "COMPLEJO CINEMARK").toUpperCase();
    const filename = `Control Mensual Parlantes ${formatMesAno(selectedMesAno)} - ${complejo}`;

    // 1. Filas de fallas activas / en seguimiento
    let fallasRowsHtml = "";
    if (stats.allFallasList.length === 0) {
      fallasRowsHtml = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 14px; font-style: italic; color: #065F46; background: #ECFDF5;">
            ✔ Todos los parlantes de las ${salasCount} salas se encuentran en estado ÓPTIMO sin fallas en seguimiento.
          </td>
        </tr>
      `;
    } else {
      fallasRowsHtml = stats.allFallasList
        .map(
          ({ sala, item, meta }, idx) => `
          <tr>
            <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
            <td style="text-align: center; font-weight: bold;">Sala ${sala}</td>
            <td style="text-align: center; font-weight: bold; color: #890404;">${item.id}</td>
            <td>${meta.zone}</td>
            <td>${item.observacion || "Sin observación detallada"}</td>
            <td style="font-weight: 600;">${item.accionSeguimiento || "En seguimiento"}</td>
          </tr>
        `
        )
        .join("");
    }

    // 2. Planilla detallada por cada Sala
    let salasDetailHtml = "";
    for (let i = 1; i <= salasCount; i++) {
      const key = String(i);
      const list = normalizeRoomSpeakers(salasData[key]);
      const fallasCount = list.filter((x) => x.estado === "Con falla").length;

      const rowsHtml = list
        .map((sp) => {
          const meta = SPEAKERS_5_1.find((m) => m.id === sp.id);
          const isFalla = sp.estado === "Con falla";
          return `
            <tr style="${isFalla ? "background-color: #FEF2F2;" : ""}">
              <td style="text-align: center; font-weight: bold; ${isFalla ? "color: #991B1B;" : ""}">${sp.id}</td>
              <td>${meta?.zone || "5.1"}</td>
              <td style="text-align: center; font-weight: bold; color: ${isFalla ? "#DC2626" : "#059669"};">
                ${sp.estado.toUpperCase()}
              </td>
              <td>${sp.observacion || "-"}</td>
              <td>${sp.accionSeguimiento || "-"}</td>
            </tr>
          `;
        })
        .join("");

      salasDetailHtml += `
        <div class="room-block">
          <div class="room-header">
            <span>SALA ${key} — CONFIGURACIÓN 5.1 (21 PARLANTES)</span>
            <span class="${fallasCount > 0 ? "badge-falla" : "badge-ok"}">
              ${fallasCount > 0 ? `${fallasCount} CON FALLA` : "100% ÓPTIMO"}
            </span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 11%; text-align: center;">Parlante (ID)</th>
                <th style="width: 21%;">Zona / Canal</th>
                <th style="width: 14%; text-align: center;">Estado</th>
                <th style="width: 27%;">Observación</th>
                <th style="width: 27%;">Acción / Falla en Seguimiento</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${filename}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body {
      font-family: 'Arial', sans-serif;
      margin: 0;
      padding: 0;
      color: #111827;
      background-color: #FFFFFF;
      font-size: 8.5pt;
      line-height: 1.3;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 10px 14px;
    }
    h1 {
      font-size: 15pt;
      font-weight: 900;
      color: #890404;
      text-align: center;
      margin: 4px 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    h2 {
      font-size: 11pt;
      font-weight: bold;
      color: #890404;
      margin: 14px 0 6px 0;
      text-transform: uppercase;
      border-bottom: 1.5px solid #890404;
      padding-bottom: 3px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .info-table td {
      padding: 5px 8px;
      border: 1px solid #CBD5E1;
    }
    .info-table td.label {
      background-color: #F1F5F9;
      font-weight: bold;
      width: 18%;
      font-size: 8pt;
      text-transform: uppercase;
    }
    .info-table td.val {
      font-size: 8.5pt;
    }
    .kpi-grid {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-box {
      flex: 1;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 6px 10px;
      background: #F8FAFC;
      text-align: center;
    }
    .kpi-title {
      font-size: 7pt;
      text-transform: uppercase;
      color: #64748B;
      font-weight: bold;
    }
    .kpi-value {
      font-size: 12pt;
      font-weight: 900;
      margin-top: 2px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      table-layout: fixed;
    }
    .data-table th {
      border: 1px solid #1E293B;
      background-color: #890404;
      color: #FFFFFF;
      font-weight: bold;
      padding: 5px 6px;
      font-size: 7.5pt;
      text-align: left;
      text-transform: uppercase;
    }
    .data-table td {
      border: 1px solid #94A3B8;
      padding: 4px 6px;
      font-size: 7.5pt;
      word-break: break-word;
    }
    .room-block {
      page-break-inside: avoid;
      margin-bottom: 14px;
    }
    .room-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1E293B;
      color: #FFFFFF;
      padding: 5px 10px;
      font-weight: bold;
      font-size: 8.5pt;
      border-radius: 4px 4px 0 0;
    }
    .badge-ok {
      background: #059669;
      color: #FFF;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 7pt;
    }
    .badge-falla {
      background: #DC2626;
      color: #FFF;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 7pt;
    }
    .signatures-block {
      margin-top: 28px;
      display: flex;
      justify-content: space-between;
      padding: 0 20px;
      page-break-inside: avoid;
    }
    .signature-line {
      width: 42%;
      border-top: 1px solid #000;
      text-align: center;
      padding-top: 6px;
      font-size: 8.5pt;
      margin-top: 36px;
      line-height: 1.3;
    }
    .corporate-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 2px solid #890404;
      padding-top: 8px;
      margin-top: 20px;
      page-break-inside: avoid;
    }
    .corporate-info {
      font-size: 7.5pt;
      color: #444;
      line-height: 1.3;
    }
    .corporate-logo {
      font-size: 14pt;
      font-weight: 900;
      color: #890404;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <h1>Control Mensual de Parlantes (5.1)</h1>

    <table class="info-table">
      <tr>
        <td class="label">Cine / Complejo:</td>
        <td class="val" style="font-weight: bold; width: 32%;">${complejo}</td>
        <td class="label" style="width: 18%;">Fecha Control:</td>
        <td class="val" style="width: 32%;">${fechaFormatted}</td>
      </tr>
      <tr>
        <td class="label">Responsable:</td>
        <td class="val">${(responsable || "SIN ESPECIFICAR").toUpperCase()}</td>
        <td class="label">Mes Control:</td>
        <td class="val" style="font-weight: bold; color: #890404;">${mesFormatted}</td>
      </tr>
    </table>

    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-title">Salas Controladas</div>
        <div class="kpi-value">${salasCount} Salas</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-title">Total Parlantes</div>
        <div class="kpi-value">${stats.totalSpeakers}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-title">Parlantes Óptimos</div>
        <div class="kpi-value" style="color: #059669;">${stats.totalOptimos} (${stats.healthPct}%)</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-title">Con Falla / Seguimiento</div>
        <div class="kpi-value" style="color: ${stats.totalFallas > 0 ? "#DC2626" : "#059669"};">${stats.totalFallas}</div>
      </div>
    </div>

    <h2>Resumen de Fallas en Seguimiento</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 6%; text-align: center;">#</th>
          <th style="width: 12%; text-align: center;">Sala</th>
          <th style="width: 12%; text-align: center;">Parlante</th>
          <th style="width: 20%;">Zona</th>
          <th style="width: 25%;">Observación</th>
          <th style="width: 25%;">Acción / Falla en Seguimiento</th>
        </tr>
      </thead>
      <tbody>
        ${fallasRowsHtml}
      </tbody>
    </table>

    <h2>Planilla Detallada por Sala</h2>
    ${salasDetailHtml}

    <div class="signatures-block">
      <div class="signature-line">
        FIRMA RESPONSABLE<br/>
        <strong>${(responsable || "").toUpperCase()}</strong>
      </div>
      <div class="signature-line">
        FIRMA GERENTE PROYECCIÓN<br/>
        <strong>${(subgerente || "").toUpperCase()}</strong>
      </div>
    </div>

    <div class="corporate-footer">
      <div class="corporate-info">
        Beruti 3399 5to Piso, Capital Federal<br/>
        Oficina Corporativa Cinemark — Área Técnica de Proyección y Sonido
      </div>
      <div class="corporate-logo">CINEMARK</div>
    </div>
  </div>
</body>
</html>`;
  };

  const handlePrintReport = async () => {
    const html = buildReportHtml();
    try {
      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank", "width=1200,height=900");
        if (!printWindow) {
          Alert.alert("Imprimir", "Habilitá las ventanas emergentes (popups) para ver o imprimir el reporte.");
          return;
        }
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        const doPrint = () => {
          printWindow.focus();
          printWindow.print();
        };

        if (printWindow.document.readyState === "complete") {
          doPrint();
        } else {
          printWindow.onload = doPrint;
        }
      } else {
        await Print.printAsync({ html });
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", `No se pudo generar el reporte: ${e.message}`);
    }
  };

  const handleDownloadHtml = () => {
    const html = buildReportHtml();
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeCine = (cineId || "cine").replace(/[^a-zA-Z0-9_-]/g, "_");
      a.href = url;
      a.download = `Control_Mensual_Parlantes_${selectedMesAno}_${safeCine}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      handlePrintReport();
    }
  };

  // ─── Render de Nodo de Parlante en el Diagrama 5.1 ─────────────────────────

  const currentRoomSpeakers = useMemo(() => {
    if (selectedSala === "RESUMEN") return buildDefaultRoomSpeakers();
    return normalizeRoomSpeakers(salasData[selectedSala]);
  }, [salasData, selectedSala]);

  const speakerMapById = useMemo(() => {
    const map: Record<string, SpeakerCheckItem> = {};
    currentRoomSpeakers.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [currentRoomSpeakers]);

  const filteredRoomSpeakers = useMemo(() => {
    return currentRoomSpeakers.filter((sp) => {
      if (filterMode === "FALLA" && sp.estado !== "Con falla") return false;
      if (zoneFilter !== "ALL") {
        const meta = SPEAKERS_5_1.find((m) => m.id === sp.id);
        if (meta?.zone !== zoneFilter) return false;
      }
      return true;
    });
  }, [currentRoomSpeakers, filterMode, zoneFilter]);

  const renderDiagramSpeakerNode = (
    id: SpeakerId,
    variant: "sw" | "screen" | "left" | "right" | "rear"
  ) => {
    const item = speakerMapById[id] || {
      id,
      estado: "Óptimo",
      observacion: "",
      accionSeguimiento: "",
    };
    const isFalla = item.estado === "Con falla";
    const isSelected = highlightedSpeaker === id;

    let baseBg = "#E59824";
    if (variant === "sw") baseBg = "#8B8046";
    if (variant === "screen") baseBg = "#2B7BBA";

    const bgColor = isFalla ? "#DC2626" : baseBg;
    const borderColor = isSelected ? "#0F172A" : isFalla ? "#991B1B" : "#1E3A5F";

    const handlePressNode = () => {
      setHighlightedSpeaker(id);
      if (mapClickTogglesState && !readOnly && selectedSala !== "RESUMEN") {
        handleToggleSpeakerStatus(selectedSala, id);
      }
    };

    return (
      <TouchableOpacity
        key={id}
        onPress={handlePressNode}
        activeOpacity={0.8}
        // @ts-ignore web className for smooth animation
        className={`cp-speaker-node ${isFalla ? "cp-speaker-fault" : ""}`}
        style={[
          s.diagramNode,
          variant === "sw" && s.diagramNodeSw,
          variant === "screen" && s.diagramNodeScreen,
          (variant === "left" || variant === "right") && s.diagramNodeSide,
          variant === "rear" && s.diagramNodeRear,
          {
            backgroundColor: bgColor,
            borderColor,
            borderWidth: isSelected ? 2.5 : 1.5,
          },
        ]}
      >
        <Text style={s.diagramNodeText}>{id}</Text>
        <View
          style={[
            s.diagramStatusDot,
            { backgroundColor: isFalla ? "#FEF2F2" : "#10B981" },
          ]}
        >
          <MaterialCommunityIcons
            name={isFalla ? "alert" : "check"}
            size={9}
            color={isFalla ? "#DC2626" : "#FFFFFF"}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render del Esquema Visual 5.1 (Fiel a imagen_2026-11-05_215421233.png) ─

  const render51VisualDiagram = () => {
    const roomFallas = stats.fallasPorSala[selectedSala] || 0;

    return (
      <View style={s.diagramCard}>
        <View style={s.diagramCardHeader}>
          <View style={s.diagramTitleRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <View style={s.diagramIconBadge}>
                <MaterialCommunityIcons name="surround-sound-5-1" size={18} color={COLORS.primary} />
              </View>
              <Text style={s.diagramCardTitle} numberOfLines={1}>
                Plano Sala {selectedSala}
              </Text>
            </View>

            <View style={s.modeSegmentedTrack}>
              <TouchableOpacity
                onPress={() => setMapClickTogglesState(true)}
                activeOpacity={0.85}
                style={[
                  s.modeSegmentedOption,
                  mapClickTogglesState && s.modeSegmentedOptionActive,
                ]}
              >
                <MaterialCommunityIcons
                  name="gesture-tap-button"
                  size={13}
                  color={mapClickTogglesState ? "#FFFFFF" : COLORS.muted}
                />
                <Text
                  style={[
                    s.modeSegmentedText,
                    mapClickTogglesState && s.modeSegmentedTextActive,
                  ]}
                >
                  Alternar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMapClickTogglesState(false)}
                activeOpacity={0.85}
                style={[
                  s.modeSegmentedOption,
                  !mapClickTogglesState && s.modeSegmentedOptionActiveNeutral,
                ]}
              >
                <MaterialCommunityIcons
                  name="eye-outline"
                  size={13}
                  color={!mapClickTogglesState ? COLORS.text : COLORS.muted}
                />
                <Text
                  style={[
                    s.modeSegmentedText,
                    !mapClickTogglesState && s.modeSegmentedTextActiveNeutral,
                  ]}
                >
                  Ver fila
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={s.diagramCardSub}>
            {mapClickTogglesState
              ? "Tocá un parlante para cambiar su estado (Óptimo / Con falla)"
              : "Tocá un parlante para resaltarlo en la planilla"}
          </Text>
        </View>

        {/* Contenedor del Plano estilo esquema técnico 5.1 */}
        <View style={s.acousticCanvas}>
          {/* 1. Fila Superior: Subwoofer + SW1..SW4 */}
          <View style={s.swRow}>
            <View style={s.orangeTagBox}>
              <Text style={s.orangeTagText}>Subwoofer</Text>
            </View>
            <View style={s.swNodesRow}>
              {(["SW1", "SW2", "SW3", "SW4"] as SpeakerId[]).map((id) =>
                renderDiagramSpeakerNode(id, "sw")
              )}
            </View>
          </View>

          {/* 2. Fila de Pantalla: L, C, R + línea de pantalla + Left, Center, Right */}
          <View style={s.screenSection}>
            <View style={s.lcrNodesRow}>
              {(["L", "C", "R"] as SpeakerId[]).map((id) =>
                renderDiagramSpeakerNode(id, "screen")
              )}
            </View>
            <View style={s.screenBlackLine} />
            <View style={s.lcrLabelsRow}>
              <View style={s.orangeSmallTag}>
                <Text style={s.orangeTagText}>Left</Text>
              </View>
              <View style={s.orangeSmallTag}>
                <Text style={s.orangeTagText}>Center</Text>
              </View>
              <View style={s.orangeSmallTag}>
                <Text style={s.orangeTagText}>Right</Text>
              </View>
            </View>
          </View>

          {/* 3. Etiquetas de cabeceras Surround */}
          <View style={s.surroundHeaderRow}>
            <View style={s.orangeSurroundTag}>
              <Text style={s.orangeTagText}>Left Surround</Text>
              <Text style={s.orangeTagSubText}>LS</Text>
            </View>
            <View style={s.orangeSurroundTag}>
              <Text style={s.orangeTagText}>Right Surround</Text>
              <Text style={s.orangeTagSubText}>RS</Text>
            </View>
          </View>

          {/* 4. Cuerpo de la Sala: LS1-LS5 (Izq) | Centro 5.1 | RS1-RS5 (Der) */}
          <View style={s.roomWallsBody}>
            {/* Pared Izquierda LS1..LS5 */}
            <View style={s.sideWallCol}>
              {(["LS1", "LS2", "LS3", "LS4", "LS5"] as SpeakerId[]).map((id) =>
                renderDiagramSpeakerNode(id, "left")
              )}
            </View>

            {/* Centro de la Sala: Badge 5.1 */}
            <View style={s.roomCenterArea}>
              <View
                style={[
                  s.center51Badge,
                  roomFallas > 0 && {
                    backgroundColor: "#FEE2E2",
                    borderColor: "#DC2626",
                  },
                ]}
              >
                <Text
                  style={[
                    s.center51Title,
                    roomFallas > 0 && { color: "#991B1B" },
                  ]}
                >
                  5.1
                </Text>
                <Text
                  style={[
                    s.center51Subtitle,
                    roomFallas > 0 && { color: "#B91C1C" },
                  ]}
                >
                  {roomFallas === 0
                    ? "21/21 ÓPTIMOS"
                    : `${roomFallas} CON FALLA`}
                </Text>
              </View>

              {highlightedSpeaker && (
                <View style={s.selectedSpeakerMiniCard}>
                  <Text style={s.selectedSpeakerMiniTitle}>
                    Parlante {highlightedSpeaker} —{" "}
                    <Text
                      style={{
                        color:
                          speakerMapById[highlightedSpeaker]?.estado === "Con falla"
                            ? "#DC2626"
                            : "#059669",
                      }}
                    >
                      {speakerMapById[highlightedSpeaker]?.estado}
                    </Text>
                  </Text>
                  {speakerMapById[highlightedSpeaker]?.observacion ? (
                    <Text style={s.selectedSpeakerMiniSub} numberOfLines={2}>
                      Obs: {speakerMapById[highlightedSpeaker]?.observacion}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>

            {/* Pared Derecha RS1..RS5 */}
            <View style={s.sideWallCol}>
              {(["RS1", "RS2", "RS3", "RS4", "RS5"] as SpeakerId[]).map((id) =>
                renderDiagramSpeakerNode(id, "right")
              )}
            </View>
          </View>

          {/* 5. Pared Trasera: LS6, LS7 y RS7, RS6 (exactamente como en el plano) */}
          <View style={s.rearWallRow}>
            <View style={s.rearPair}>
              {renderDiagramSpeakerNode("LS6", "rear")}
              {renderDiagramSpeakerNode("LS7", "rear")}
            </View>
            <View style={s.rearPair}>
              {renderDiagramSpeakerNode("RS7", "rear")}
              {renderDiagramSpeakerNode("RS6", "rear")}
            </View>
          </View>
        </View>

        {/* Leyenda del plano */}
        <View style={s.diagramLegendRow}>
          <View style={s.legendItem}>
            <View style={[s.legendSwatch, { backgroundColor: "#8B8046" }]} />
            <Text style={s.legendLabel}>SW1-SW4</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendSwatch, { backgroundColor: "#2B7BBA" }]} />
            <Text style={s.legendLabel}>Frente (L/C/R)</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendSwatch, { backgroundColor: "#E59824" }]} />
            <Text style={s.legendLabel}>Surround (LS/RS)</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendSwatch, { backgroundColor: "#DC2626" }]} />
            <Text style={s.legendLabel}>Con Falla</Text>
          </View>
        </View>
      </View>
    );
  };

  // ─── Render Principal ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={s.loadingText}>Cargando control mensual de parlantes…</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. CABECERA MENSUAL (AL ESTILO CIERRE DE MES) */}
        <View style={s.selectorCard}>
          <View
            style={[
              s.selectorRow,
              isMobile && { flexDirection: "column", gap: 12, alignItems: "stretch" },
            ]}
          >
            {/* Selector de Mes */}
            <View style={isMobile ? { width: "100%" } : { flex: 1.2 }}>
              <Text style={s.selectorLabel}>Mes de Control</Text>
              <View style={s.pickerWrapper}>
                {Platform.OS === "web" ? (
                  <select
                    value={selectedMesAno}
                    onChange={(e) => setSelectedMesAno(e.target.value)}
                    style={s.webPicker}
                  >
                    {mesesOptions.map((opt) => (
                      <option
                        key={opt.value}
                        value={opt.value}
                        style={{ backgroundColor: "var(--card, #FFFFFF)", color: COLORS.text }}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TextInput
                    value={selectedMesAno}
                    onChangeText={setSelectedMesAno}
                    style={s.inputField}
                  />
                )}
              </View>
            </View>

            {/* Responsable */}
            <View style={isMobile ? { width: "100%" } : { flex: 1.5 }}>
              <Text style={s.selectorLabel}>Responsable del Control *</Text>
              <TextInput
                value={responsable}
                onChangeText={(val) => setResponsable(val.toUpperCase())}
                placeholder="Ingresá tu nombre"
                placeholderTextColor={COLORS.muted}
                style={s.inputField}
                editable={!readOnly}
              />
            </View>

            {/* Subgerente */}
            <View style={isMobile ? { width: "100%" } : { flex: 1.4 }}>
              <Text style={s.selectorLabel}>Subgerente Responsable</Text>
              <TextInput
                value={subgerente}
                onChangeText={(val) => setSubgerente(val.toUpperCase())}
                placeholder="Ej: VICTOR DIAZ"
                placeholderTextColor={COLORS.muted}
                style={s.inputField}
                editable={!readOnly}
              />
            </View>

            {/* Fecha de Control */}
            <View style={isMobile ? { width: "100%" } : { flex: 1 }}>
              <Text style={s.selectorLabel}>Fecha de Control</Text>
              <TextInput
                value={fechaEnvio}
                onChangeText={setFechaEnvio}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.muted}
                style={[s.inputField, { fontFamily: "monospace" }]}
                editable={!readOnly}
              />
            </View>
          </View>

          {/* Barra de Salud Acústica del Complejo */}
          <View style={s.healthSummaryBar}>
            <View style={s.healthMetricsRow}>
              <View style={s.healthBadgeGroup}>
                <MaterialCommunityIcons
                  name={stats.totalFallas === 0 ? "check-decagram" : "alert-decagram"}
                  size={18}
                  color={stats.totalFallas === 0 ? COLORS.success : COLORS.danger}
                />
                <Text style={s.healthSummaryTitle}>
                  Estado General ({formatMesAno(selectedMesAno)}):{" "}
                  <Text style={{ color: stats.totalFallas === 0 ? COLORS.success : COLORS.danger }}>
                    {stats.totalOptimos}/{stats.totalSpeakers} Parlantes Óptimos ({stats.healthPct}%)
                  </Text>
                </Text>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <View style={s.miniStatChipOk}>
                  <Text style={s.miniStatChipOkText}>
                    Salas 100% Óptimas: {stats.salasOptimas}/{salasCount}
                  </Text>
                </View>
                {stats.totalFallas > 0 && (
                  <TouchableOpacity
                    onPress={() => setSelectedSala("RESUMEN")}
                    style={s.miniStatChipDanger}
                  >
                    <Text style={s.miniStatChipDangerText}>
                      {stats.totalFallas} Falla{stats.totalFallas === 1 ? "" : "s"} en seguimiento (Ver resumen)
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  {
                    width: `${stats.healthPct}%` as any,
                    backgroundColor: stats.totalFallas === 0 ? COLORS.success : COLORS.primary,
                  },
                ]}
              />
            </View>
          </View>

          {/* Indicador de Guardado en BD o Arrastre de Mes Anterior */}
          {isSavedInDb && (
            <View style={s.savedIndicator}>
              <MaterialCommunityIcons name="check-decagram" size={16} color={COLORS.success} />
              <Text style={s.savedIndicatorText}>
                Este control mensual de parlantes ya está guardado en la base de datos para{" "}
                {formatMesAno(selectedMesAno)}. Podés actualizarlo y volver a guardar cuando quieras.
              </Text>
            </View>
          )}

          {!isSavedInDb && carriedFromPrevMonth && (
            <View style={[s.savedIndicator, { borderTopColor: COLORS.warningBorder }]}>
              <MaterialCommunityIcons name="history" size={16} color={COLORS.warning} />
              <Text style={[s.savedIndicatorText, { color: COLORS.warning }]}>
                Se cargaron automáticamente las fallas en seguimiento del mes anterior para continuar su control este mes. Recordá presionar "Guardar Mes en BD".
              </Text>
            </View>
          )}
        </View>

        {/* 2. SELECTOR DE SALAS CONFIGURADAS EN EL CINE */}
        <View style={s.salasTabsCard}>
          <View style={s.salasTabsHeader}>
            <Text style={s.salasTabsLabel}>
              Seleccionar Sala ({salasCount} Salas 5.1 configuradas)
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedSala("RESUMEN")}
              style={[
                s.resumenTabBtn,
                selectedSala === "RESUMEN" && s.resumenTabBtnActive,
              ]}
            >
              <MaterialCommunityIcons
                name="clipboard-list-outline"
                size={15}
                color={selectedSala === "RESUMEN" ? "#FFFFFF" : COLORS.primary}
              />
              <Text
                style={[
                  s.resumenTabBtnText,
                  selectedSala === "RESUMEN" && { color: "#FFFFFF" },
                ]}
              >
                Resumen de Fallas ({stats.totalFallas})
              </Text>
            </TouchableOpacity>
          </View>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 mt-1">
            {Array.from({ length: salasCount }, (_, idx) => {
              const salaKey = String(idx + 1);
              const isSelected = selectedSala === salaKey;
              const fallas = stats.fallasPorSala[salaKey] || 0;
              const optimos = 21 - fallas;
              const okPct = ((optimos / 21) * 100).toFixed(0);

              return (
                <button
                  key={salaKey}
                  type="button"
                  onClick={() => setSelectedSala(salaKey)}
                  className={`cp-status-pill p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-rose-50 dark:bg-rose-500/15 border-rose-500 dark:border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20 shadow-xs"
                      : fallas > 0
                      ? "bg-rose-50/50 dark:bg-rose-950/25 border-rose-300 dark:border-rose-800/70 text-slate-800 dark:text-zinc-200 hover:border-rose-400"
                      : "bg-slate-50 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-black tracking-tight ${
                        isSelected
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-800 dark:text-zinc-200"
                      }`}
                    >
                      Sala {salaKey}
                    </span>
                    {fallas > 0 ? (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-600 text-white shrink-0">
                        {fallas}
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                        OK
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-semibold mt-1">
                    <span
                      className={
                        fallas > 0
                          ? "text-rose-600 dark:text-rose-400 font-bold"
                          : isSelected
                          ? "text-rose-600/80 dark:text-rose-400/80"
                          : "text-emerald-600 dark:text-emerald-500"
                      }
                    >
                      {okPct}%
                    </span>
                    <span className="text-slate-400 dark:text-zinc-500 text-[9px]">
                      ({optimos}/21)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </View>

        {/* 3. VISTA RESUMEN GENERAL DE FALLAS EN SEGUIMIENTO */}
        {selectedSala === "RESUMEN" ? (
          <View style={s.planillaCard}>
            <View style={s.tableHeaderBox}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons
                  name="clipboard-alert-outline"
                  size={20}
                  color={COLORS.primary}
                />
                <Text style={s.tableHeaderTitle}>
                  Seguimiento de Parlantes con Falla — Todas las Salas ({formatMesAno(selectedMesAno)})
                </Text>
              </View>
            </View>

            {stats.allFallasList.length === 0 ? (
              <View style={s.emptySuccessBox}>
                <MaterialCommunityIcons name="check-decagram" size={44} color={COLORS.success} />
                <Text style={s.emptySuccessTitle}>
                  ¡Todas las salas se encuentran en estado Óptimo!
                </Text>
                <Text style={s.emptySuccessSub}>
                  Los {stats.totalSpeakers} parlantes de las {salasCount} salas están registrados como
                  Óptimos en {formatMesAno(selectedMesAno)}.
                </Text>
              </View>
            ) : (
              <View style={s.tableGrid}>
                <View style={s.gridRowHeader}>
                  <View style={{ flex: 1, paddingLeft: 10 }}>
                    <Text style={s.gridTh}>Sala</Text>
                  </View>
                  <View style={{ flex: 1.1, alignItems: "center" }}>
                    <Text style={s.gridTh}>Parlante</Text>
                  </View>
                  <View style={{ flex: 1.8 }}>
                    <Text style={s.gridTh}>Zona 5.1</Text>
                  </View>
                  <View style={{ flex: 3 }}>
                    <Text style={s.gridTh}>Observación</Text>
                  </View>
                  <View style={{ flex: 3 }}>
                    <Text style={s.gridTh}>Acción / Falla en Seguimiento</Text>
                  </View>
                  <View style={{ flex: 1.2, alignItems: "center" }}>
                    <Text style={s.gridTh}>Ir</Text>
                  </View>
                </View>

                {stats.allFallasList.map(({ sala, item, meta }, idx) => (
                  <View
                    key={`${sala}-${item.id}`}
                    style={[s.gridRow, idx % 2 === 1 && s.gridRowAlt]}
                  >
                    <View style={{ flex: 1, paddingLeft: 10 }}>
                      <Text style={[s.gridTd, { fontWeight: "800" }]}>Sala {sala}</Text>
                    </View>
                    <View style={{ flex: 1.1, alignItems: "center" }}>
                      <View style={[s.speakerIdBadge, { backgroundColor: COLORS.danger }]}>
                        <Text style={s.speakerIdBadgeText}>{item.id}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1.8 }}>
                      <Text style={s.gridTd}>{meta.zone}</Text>
                    </View>
                    <View style={{ flex: 3, paddingHorizontal: 4 }}>
                      <TextInput
                        value={item.observacion}
                        onChangeText={(val) =>
                          handleUpdateSpeaker(sala, item.id, "observacion", val)
                        }
                        placeholder="Escribir observación..."
                        placeholderTextColor={COLORS.muted}
                        style={s.cellInput}
                        editable={!readOnly}
                      />
                    </View>
                    <View style={{ flex: 3, paddingHorizontal: 4 }}>
                      <TextInput
                        value={item.accionSeguimiento}
                        onChangeText={(val) =>
                          handleUpdateSpeaker(sala, item.id, "accionSeguimiento", val)
                        }
                        placeholder="Acción / seguimiento..."
                        placeholderTextColor={COLORS.muted}
                        style={s.cellInput}
                        editable={!readOnly}
                      />
                    </View>
                    <View style={{ flex: 1.2, alignItems: "center" }}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedSala(sala);
                          setHighlightedSpeaker(item.id);
                        }}
                        style={s.goToSalaBtn}
                      >
                        <Text style={s.goToSalaBtnText}>Ver Sala</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          /* 4. VISTA DE SALA INDIVIDUAL: DIAGRAMA 5.1 + PLANILLA DE CONTROL */
          <View
            style={[
              s.roomWorkspaceLayout,
              { flexDirection: isWide ? "row" : "column" },
            ]}
          >
            {/* Columna Izquierda: Esquema Interactivo 5.1 */}
            <View style={isWide ? { width: 410, flexShrink: 0 } : { width: "100%" }}>
              {render51VisualDiagram()}
            </View>

            {/* Columna Derecha: Planilla de Control de Parlantes */}
            <View style={[s.planillaCard, isWide ? { flex: 1 } : { width: "100%" }]}>
              <View style={s.tableHeaderBox}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons
                    name="table-check"
                    size={20}
                    color={COLORS.primary}
                  />
                  <View>
                    <Text style={s.tableHeaderTitle}>
                      Planilla de Parlantes — Sala {selectedSala}
                    </Text>
                    <Text style={s.tableHeaderSub}>
                      SW1-SW4 • L/C/R • LS1-LS7 • RS1-RS7 (21 canales)
                    </Text>
                  </View>
                </View>

                {!readOnly && (stats.fallasPorSala[selectedSala] || 0) > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowResetRoomModal(true)}
                    style={s.markAllOkBtn}
                  >
                    <MaterialCommunityIcons name="check-all" size={15} color={COLORS.success} />
                    <Text style={s.markAllOkBtnText}>Marcar Sala Óptima</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Barra de Filtros de la Planilla */}
              <View style={s.filtersRow}>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  <TouchableOpacity
                    onPress={() => setFilterMode("ALL")}
                    style={[
                      s.filterChip,
                      filterMode === "ALL" && s.filterChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        s.filterChipText,
                        filterMode === "ALL" && s.filterChipTextActive,
                      ]}
                    >
                      Todos (21)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setFilterMode("FALLA")}
                    style={[
                      s.filterChip,
                      filterMode === "FALLA" && s.filterChipActiveDanger,
                    ]}
                  >
                    <Text
                      style={[
                        s.filterChipText,
                        filterMode === "FALLA" && s.filterChipTextActive,
                      ]}
                    >
                      Con Falla ({stats.fallasPorSala[selectedSala] || 0})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Filtro por Zona 5.1 */}
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  {[
                    { key: "ALL", label: "Todas las Zonas" },
                    { key: "Subwoofer", label: "SW" },
                    { key: "Pantalla (L/C/R)", label: "L/C/R" },
                    { key: "Left Surround (LS)", label: "LS1-LS7" },
                    { key: "Right Surround (RS)", label: "RS1-RS7" },
                  ].map((z) => (
                    <TouchableOpacity
                      key={z.key}
                      onPress={() => setZoneFilter(z.key)}
                      style={[
                        s.zoneFilterBtn,
                        zoneFilter === z.key && s.zoneFilterBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          s.zoneFilterText,
                          zoneFilter === z.key && s.zoneFilterTextActive,
                        ]}
                      >
                        {z.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Grilla / Planilla de Parlantes */}
              {isMobile ? (
                <View style={{ gap: 10, marginTop: 8 }}>
                  {filteredRoomSpeakers.map((item) => {
                    const meta = SPEAKERS_5_1.find((m) => m.id === item.id)!;
                    const isFalla = item.estado === "Con falla";
                    const isHighlighted = highlightedSpeaker === item.id;

                    return (
                      <View
                        key={item.id}
                        // @ts-ignore
                        className="cp-row-item"
                        style={[
                          s.mobileSpeakerCard,
                          isFalla && s.mobileSpeakerCardFalla,
                          isHighlighted && s.rowHighlighted,
                        ]}
                      >
                        <View style={s.mobileSpeakerHeader}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View
                              style={[
                                s.speakerIdBadge,
                                { backgroundColor: isFalla ? COLORS.danger : meta.color },
                              ]}
                            >
                              <Text style={s.speakerIdBadgeText}>{item.id}</Text>
                            </View>
                            <View>
                              <Text style={s.mobileSpeakerTitle}>{meta.label}</Text>
                              <Text style={s.mobileSpeakerZone}>{meta.zone}</Text>
                            </View>
                          </View>

                          <TouchableOpacity
                            onPress={() => handleToggleSpeakerStatus(selectedSala, item.id)}
                            disabled={readOnly}
                            // @ts-ignore
                            className="cp-status-pill"
                            style={[
                              s.statusToggleBtn,
                              isFalla ? s.statusToggleFalla : s.statusToggleOptimo,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={isFalla ? "alert-circle" : "check-circle"}
                              size={15}
                              color={isFalla ? "#DC2626" : "#059669"}
                            />
                            <Text
                              style={[
                                s.statusToggleText,
                                { color: isFalla ? "#DC2626" : "#059669" },
                              ]}
                            >
                              {item.estado}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <View style={{ gap: 8, marginTop: 6 }}>
                          <View>
                            <Text style={s.mobileFieldLabel}>Observación</Text>
                            <TextInput
                              value={item.observacion}
                              onChangeText={(val) =>
                                handleUpdateSpeaker(selectedSala, item.id, "observacion", val)
                              }
                              placeholder="Ej: Cono con vibración / sin audio..."
                              placeholderTextColor={COLORS.muted}
                              style={s.mobileInput}
                              editable={!readOnly}
                            />
                          </View>
                          <View>
                            <Text style={s.mobileFieldLabel}>Acción / Falla en seguimiento</Text>
                            <TextInput
                              value={item.accionSeguimiento}
                              onChangeText={(val) =>
                                handleUpdateSpeaker(
                                  selectedSala,
                                  item.id,
                                  "accionSeguimiento",
                                  val
                                )
                              }
                              placeholder="Ej: En seguimiento técnico / RMA..."
                              placeholderTextColor={COLORS.muted}
                              style={s.mobileInput}
                              editable={!readOnly}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={s.tableGrid}>
                  {/* Cabecera de la Planilla */}
                  <View style={s.gridRowHeader}>
                    <View style={{ flex: 1.2, alignItems: "center" }}>
                      <Text style={s.gridTh}>Parlante</Text>
                    </View>
                    <View style={{ flex: 1.8 }}>
                      <Text style={s.gridTh}>Zona / Canal</Text>
                    </View>
                    <View style={{ flex: 1.7, alignItems: "center" }}>
                      <Text style={s.gridTh}>Estado</Text>
                    </View>
                    <View style={{ flex: 3.2 }}>
                      <Text style={s.gridTh}>Observación</Text>
                    </View>
                    <View style={{ flex: 3.2 }}>
                      <Text style={s.gridTh}>Acción / Falla en Seguimiento</Text>
                    </View>
                  </View>

                  {filteredRoomSpeakers.map((item, idx) => {
                    const meta = SPEAKERS_5_1.find((m) => m.id === item.id)!;
                    const isFalla = item.estado === "Con falla";
                    const isHighlighted = highlightedSpeaker === item.id;

                    return (
                      <View
                        key={`${selectedSala}-${item.id}`}
                        // @ts-ignore
                        className="cp-row-item"
                        style={[
                          s.gridRow,
                          idx % 2 === 1 && s.gridRowAlt,
                          isFalla && s.gridRowFalla,
                          isHighlighted && s.rowHighlighted,
                        ]}
                      >
                        {/* ID del Parlante */}
                        <TouchableOpacity
                          onPress={() => setHighlightedSpeaker(item.id)}
                          style={{
                            flex: 1.2,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <View
                            style={[
                              s.speakerIdBadge,
                              { backgroundColor: isFalla ? COLORS.danger : meta.color },
                            ]}
                          >
                            <Text style={s.speakerIdBadgeText}>{item.id}</Text>
                          </View>
                        </TouchableOpacity>

                        {/* Zona / Descripción */}
                        <View style={{ flex: 1.8, justifyContent: "center", paddingRight: 6 }}>
                          <Text style={s.zoneTitleText}>{meta.label}</Text>
                          <Text style={s.zoneSubText}>{meta.zone}</Text>
                        </View>

                        {/* Estado (Óptimo / Con falla) */}
                        <View
                          style={{
                            flex: 1.7,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => handleToggleSpeakerStatus(selectedSala, item.id)}
                            disabled={readOnly}
                            // @ts-ignore
                            className="cp-status-pill"
                            style={[
                              s.statusToggleBtn,
                              isFalla ? s.statusToggleFalla : s.statusToggleOptimo,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={isFalla ? "alert-circle" : "check-circle"}
                              size={15}
                              color={isFalla ? "#DC2626" : "#059669"}
                            />
                            <Text
                              style={[
                                s.statusToggleText,
                                { color: isFalla ? "#DC2626" : "#059669" },
                              ]}
                            >
                              {item.estado}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Observación */}
                        <View style={{ flex: 3.2, paddingHorizontal: 6 }}>
                          <TextInput
                            value={item.observacion}
                            onFocus={() => setHighlightedSpeaker(item.id)}
                            onChangeText={(val) =>
                              handleUpdateSpeaker(selectedSala, item.id, "observacion", val)
                            }
                            placeholder={
                              isFalla
                                ? "Describí la falla detectada..."
                                : "Sin observaciones (opcional)"
                            }
                            placeholderTextColor={COLORS.muted}
                            style={[
                              s.cellInput,
                              isFalla && {
                                borderColor: "#FCA5A5",
                                backgroundColor: "rgba(254, 226, 226, 0.35)",
                              },
                            ]}
                            editable={!readOnly}
                          />
                        </View>

                        {/* Acción / Falla en Seguimiento */}
                        <View style={{ flex: 3.2, paddingHorizontal: 6 }}>
                          <TextInput
                            value={item.accionSeguimiento}
                            onFocus={() => setHighlightedSpeaker(item.id)}
                            onChangeText={(val) =>
                              handleUpdateSpeaker(
                                selectedSala,
                                item.id,
                                "accionSeguimiento",
                                val
                              )
                            }
                            placeholder={
                              isFalla
                                ? "Acción tomada / falla en seguimiento..."
                                : "Acción o seguimiento (opcional)"
                            }
                            placeholderTextColor={COLORS.muted}
                            style={[
                              s.cellInput,
                              isFalla && {
                                borderColor: "#FCA5A5",
                                backgroundColor: "rgba(254, 226, 226, 0.35)",
                              },
                            ]}
                            editable={!readOnly}
                          />
                        </View>
                      </View>
                    );
                  })}

                  {filteredRoomSpeakers.length === 0 && (
                    <View style={{ padding: 28, alignItems: "center" }}>
                      <Text style={{ color: COLORS.muted, fontSize: 13 }}>
                        No hay parlantes que coincidan con el filtro seleccionado en Sala{" "}
                        {selectedSala}.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* 5. BOTONES DE ACCIÓN (GUARDAR MES EN BD + REPORTE HTML / IMPRIMIR) */}
        <View
          style={[
            s.actionRow,
            isMobile && { flexDirection: "column", gap: 12, width: "100%" },
          ]}
        >
          {!readOnly && (
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="database-check-outline" size={20} color="#FFF" />
                  <Text style={s.actionBtnText}>
                    Guardar Mes ({formatMesAno(selectedMesAno)})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.printBtn} onPress={handlePrintReport}>
            <MaterialCommunityIcons name="printer-outline" size={20} color="#FFF" />
            <Text style={s.actionBtnText}>Imprimir / Reporte PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.htmlBtn} onPress={handleDownloadHtml}>
            <MaterialCommunityIcons name="file-code-outline" size={20} color="#FFF" />
            <Text style={s.actionBtnText}>Descargar Reporte HTML</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 36 }} />
      </ScrollView>

      {/* Modal para confirmar restaurar todos los parlantes de la sala a Óptimo */}
      <Modal
        visible={showResetRoomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetRoomModal(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Restaurar Sala {selectedSala} a Óptimo</Text>
            <Text style={s.modalText}>
              ¿Estás seguro de que querés marcar los 21 parlantes de la{" "}
              <Text style={{ fontWeight: "800" }}>Sala {selectedSala}</Text> como{" "}
              <Text style={{ fontWeight: "800", color: COLORS.success }}>Óptimo</Text> y limpiar
              sus observaciones?
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.btnGhost}
                onPress={() => setShowResetRoomModal(false)}
              >
                <Text style={s.btnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.btnConfirmSuccess}
                onPress={handleResetCurrentRoomToOptimo}
              >
                <Text style={s.btnConfirmText}>Sí, marcar Óptimo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: COLORS.muted, fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 40, gap: 16 },

  // Cabecera Mensual
  selectorCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    ...THEME.shadow.soft,
  },
  selectorRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-end",
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.muted,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  pickerWrapper: {
    backgroundColor: COLORS.bgMobile,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
  },
  webPicker: {
    backgroundColor: "transparent",
    color: COLORS.text,
    borderWidth: 0,
    paddingHorizontal: 10,
    fontSize: 13.5,
    fontWeight: "700",
    outlineWidth: 0,
    width: "100%",
    height: "100%",
    cursor: "pointer",
  } as any,
  inputField: {
    height: 38,
    backgroundColor: COLORS.bgMobile,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontSize: 13.5,
    fontWeight: "600",
  },

  // Resumen de Salud Acústica
  healthSummaryBar: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  healthMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  healthBadgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  healthSummaryTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },
  miniStatChipOk: {
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  miniStatChipOkText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: COLORS.success,
  },
  miniStatChipDanger: {
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  miniStatChipDangerText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: COLORS.danger,
  },
  progressTrack: {
    height: 7,
    backgroundColor: COLORS.bgMobile,
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 99,
  },
  savedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6,
  },
  savedIndicatorText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: "700",
    flex: 1,
  },

  // Selector de Salas
  salasTabsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 10,
    ...THEME.shadow.soft,
  },
  salasTabsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  salasTabsLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.muted,
    textTransform: "uppercase",
  },
  resumenTabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  resumenTabBtnActive: {
    backgroundColor: COLORS.primary,
  },
  resumenTabBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
  salasPillsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  salaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgMobile,
  },
  salaPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  salaPillWithFault: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerSoft,
  },
  salaPillText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: COLORS.text,
  },
  salaPillTextActive: {
    color: "#FFFFFF",
  },
  salaPillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
  },
  salaPillBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },

  // Layout de Sala (Diagrama + Planilla)
  roomWorkspaceLayout: {
    gap: 16,
    alignItems: "flex-start",
  },

  // Diagrama Visual 5.1 (Basado en la imagen de referencia)
  diagramCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 12,
    ...THEME.shadow.soft,
  },
  diagramCardHeader: {
    gap: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  diagramTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  diagramIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  diagramCardTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.text,
  },
  diagramCardSub: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: "600",
  },
  modeSegmentedTrack: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgMobile,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 2,
  },
  modeSegmentedOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  modeSegmentedOptionActive: {
    backgroundColor: COLORS.primary,
  },
  modeSegmentedOptionActiveNeutral: {
    backgroundColor: COLORS.card,
    ...THEME.shadow.web,
  },
  modeSegmentedText: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: "700",
  },
  modeSegmentedTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  modeSegmentedTextActiveNeutral: {
    color: COLORS.text,
    fontWeight: "800",
  },
  acousticCanvas: {
    backgroundColor: "#CBD5E1",
    borderWidth: 2,
    borderColor: "#1E293B",
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  swRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  orangeTagBox: {
    backgroundColor: "#E59824",
    borderWidth: 1.5,
    borderColor: "#1E293B",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
  },
  orangeTagText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  orangeTagSubText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },
  swNodesRow: {
    flexDirection: "row",
    gap: 6,
    flex: 1,
    justifyContent: "space-around",
  },
  screenSection: {
    gap: 6,
    paddingHorizontal: 8,
  },
  lcrNodesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  screenBlackLine: {
    height: 3,
    backgroundColor: "#0F172A",
    borderRadius: 2,
    marginVertical: 2,
  },
  lcrLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  orangeSmallTag: {
    backgroundColor: "#E59824",
    borderWidth: 1.5,
    borderColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 4,
    minWidth: 58,
  },
  surroundHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  orangeSurroundTag: {
    backgroundColor: "#E59824",
    borderWidth: 1.5,
    borderColor: "#1E293B",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 105,
  },
  roomWallsBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 230,
  },
  sideWallCol: {
    gap: 8,
    justifyContent: "space-between",
  },
  roomCenterArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    gap: 10,
  },
  center51Badge: {
    backgroundColor: "#65C93E",
    borderWidth: 2,
    borderColor: "#1E293B",
    borderRadius: 8,
    paddingHorizontal: 22,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  center51Title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 1,
  },
  center51Subtitle: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 2,
  },
  selectedSpeakerMiniCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#94A3B8",
    maxWidth: 180,
  },
  selectedSpeakerMiniTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  selectedSpeakerMiniSub: {
    fontSize: 10,
    color: "#475569",
    marginTop: 2,
    textAlign: "center",
  },
  rearWallRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginTop: 4,
  },
  rearPair: {
    flexDirection: "row",
    gap: 10,
  },

  // Nodos individuales del Diagrama
  diagramNode: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  diagramNodeSw: {
    minWidth: 52,
    height: 34,
  },
  diagramNodeScreen: {
    minWidth: 58,
    height: 36,
  },
  diagramNodeSide: {
    minWidth: 46,
    height: 36,
  },
  diagramNodeRear: {
    minWidth: 50,
    height: 34,
  },
  diagramNodeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  diagramStatusDot: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0F172A",
  },
  diagramLegendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendSwatch: {
    width: 11,
    height: 11,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: "700",
  },

  // Planilla de Control
  planillaCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    ...THEME.shadow.soft,
  },
  tableHeaderBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
  },
  tableHeaderTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.text,
    textTransform: "uppercase",
  },
  tableHeaderSub: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: "600",
  },
  markAllOkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllOkBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: COLORS.success,
  },
  filtersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgMobile,
  },
  filterChipActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  filterChipActiveDanger: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: COLORS.muted,
  },
  filterChipTextActive: {
    color: COLORS.card,
  },
  zoneFilterBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "transparent",
  },
  zoneFilterBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  zoneFilterText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.muted,
  },
  zoneFilterTextActive: {
    color: COLORS.primary,
    fontWeight: "800",
  },

  // Tabla Desktop
  tableGrid: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gridRowHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.bgMobile,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 9,
    alignItems: "center",
  },
  gridTh: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.text,
    textTransform: "uppercase",
    paddingHorizontal: 6,
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
    minHeight: 46,
  },
  gridRowAlt: {
    backgroundColor: COLORS.bgMobile + "35",
  },
  gridRowFalla: {
    backgroundColor: "rgba(254, 226, 226, 0.28)",
  },
  rowHighlighted: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  gridTd: {
    fontSize: 12.5,
    color: COLORS.text,
    paddingHorizontal: 6,
  },
  speakerIdBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    minWidth: 48,
    alignItems: "center",
  },
  speakerIdBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  zoneTitleText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },
  zoneSubText: {
    fontSize: 10.5,
    color: COLORS.muted,
  },
  statusToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    minWidth: 104,
  },
  statusToggleOptimo: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  statusToggleFalla: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  statusToggleText: {
    fontSize: 12,
    fontWeight: "800",
  },
  cellInput: {
    height: 34,
    backgroundColor: COLORS.bgMobile,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
    width: "100%",
  },
  goToSalaBtn: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  goToSalaBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
  },

  // Tarjetas Mobile
  mobileSpeakerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 6,
  },
  mobileSpeakerCardFalla: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerSoft,
  },
  mobileSpeakerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mobileSpeakerTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },
  mobileSpeakerZone: {
    fontSize: 11,
    color: COLORS.muted,
  },
  mobileFieldLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    color: COLORS.muted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  mobileInput: {
    height: 36,
    backgroundColor: COLORS.bgMobile,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12.5,
    color: COLORS.text,
    fontWeight: "600",
  },

  // Estado vacío sin fallas
  emptySuccessBox: {
    padding: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptySuccessTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
  },
  emptySuccessSub: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    maxWidth: 440,
    lineHeight: 19,
  },

  // Botones inferiores
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 6,
  },
  saveBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    minWidth: 230,
    ...THEME.shadow.soft,
  },
  printBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    minWidth: 220,
    ...THEME.shadow.soft,
  },
  htmlBtn: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    minWidth: 220,
    ...THEME.shadow.soft,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13.5,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...THEME.shadow.web,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: COLORS.text,
  },
  modalText: {
    fontSize: 13.5,
    color: COLORS.text,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  btnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnGhostText: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 13,
  },
  btnConfirmSuccess: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnConfirmText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
});
