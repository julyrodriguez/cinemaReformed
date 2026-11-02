import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "@/lib/dbService";
import React, { useEffect, useState, useMemo } from "react";
import { Alert } from "react-native";
import {
  Projector,
  Package,
  History,
  ArrowLeftRight,
  Calculator,
  Plus,
  PlayCircle,
  LogOut,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Info,
  X,
  Check,
  AlertTriangle,
  Sparkles,
  Calendar,
  Clock,
  Lightbulb,
  Zap,
  User,
  Minus,
} from "lucide-react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import localizedFormat from "dayjs/plugin/localizedFormat";
import "dayjs/locale/es";

dayjs.extend(isoWeek);
dayjs.extend(localizedFormat);
dayjs.locale("es");

import { CINES_COLLECTION, db } from "../../lib/firebaseConfig";
import { useAuthUser } from "../../lib/useAuthUser";
import { getCineConfig } from "../../lib/cineConfig";

// ─── Interfaces & Types ──────────────────────────────────────────────────────

interface RetirementDetails {
  horasUsadas: number;
  horasRestantes: number;
  tipoRetiro: "Fin de vida util" | "Garantia" | "Fuera de garantia";
  descripcion: string;
  salaOriginal: number;
  anoRetiro: number;
}

interface Lampara {
  id: string;
  status: "activa" | "backup" | "final";
  sala: number | null;
  marca?: string;
  potencia?: string;
  modelo?: string;
  notas?: string;
  createdAt?: any;
  installedAt?: any;
  retiredAt?: any;
  retirementDetails?: RetirementDetails;
}

interface LamparaMovimiento {
  id: string;
  tipo: "ingreso_backup" | "instalacion" | "retiro";
  lamparaId: string;
  sala: number | null;
  marca?: string;
  potencia?: string;
  modelo?: string;
  fecha: any;
  fechaISO: string;
  mesAno: string;
  userName: string;
}

type ActiveTab = "PROYECTORES" | "BACKUP" | "HISTORIAL" | "MOVIMIENTOS" | "SIMULACION";

const POTENCIAS_OPTIONS = ["3000W", "2000W", "2200W", "4000W"];

const MODELOS_OPTIONS = [
  "DXL-30BAF/L",
  "DXL-20BAF",
  "DXL-20BAF/L",
  "DXL-22BAF",
  "DXL-40BAF/L",
];

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function timeToMinsFrom6AM(timeStr: string): number {
  const mins = timeToMinutes(timeStr);
  return mins < 360 ? mins + 1440 - 360 : mins - 360;
}

function getCurrentMinsFrom6AM(): number {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins < 360 ? mins + 1440 - 360 : mins - 360;
}

function getCurrentWeekdayKey(): string {
  let now = dayjs();
  if (now.hour() < 6) {
    now = now.subtract(1, "day");
  }
  const dayNum = now.day();
  const map: Record<number, string> = {
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

export default function LamparasScreen({ readOnly = false }: { readOnly?: boolean }) {
  const { cineId, displayName } = useAuthUser();

  const [activeTab, setActiveTab] = useState<ActiveTab>("PROYECTORES");
  const [lamparas, setLamparas] = useState<Lampara[]>([]);
  const [salasCount, setSalasCount] = useState(12);
  const [loading, setLoading] = useState(true);
  const [latestControl, setLatestControl] = useState<any | null>(null);
  const [movimientos, setMovimientos] = useState<LamparaMovimiento[]>([]);

  const [weeklyRows, setWeeklyRows] = useState<any[]>([]);
  const [currentTimeMins, setCurrentTimeMins] = useState(getCurrentMinsFrom6AM());

  const [collapsedYears, setCollapsedYears] = useState<Record<number, boolean>>({});
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  // ── Modales y Formularios ──
  const [showAddBackup, setShowAddBackup] = useState(false);
  const [bId, setBId] = useState("");
  const [bMarca, setBMarca] = useState("USHIO");
  const [bPotencia, setBPotencia] = useState("3000W");
  const [bModelo, setBModelo] = useState("DXL-30BAF/L");
  const [bNotas, setBNotas] = useState("");
  const [savingBackup, setSavingBackup] = useState(false);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    if (bPotencia === "3000W") setBModelo("DXL-30BAF/L");
    else if (bPotencia === "2000W") setBModelo("DXL-20BAF");
    else if (bPotencia === "2200W") setBModelo("DXL-22BAF");
    else if (bPotencia === "4000W") setBModelo("DXL-40BAF/L");
  }, [bPotencia]);

  const [installModal, setInstallModal] = useState<{ sala: number } | null>(null);
  const [selectedBackupId, setSelectedBackupId] = useState("");
  const [savingInstall, setSavingInstall] = useState(false);

  const [retireModal, setRetireModal] = useState<{ sala: number; lamparaId: string } | null>(null);
  const [rHorasUsadas, setRHorasUsadas] = useState("");
  const [rHorasRestantes, setRHorasRestantes] = useState("");
  const [rTipoRetiro, setRTipoRetiro] = useState<
    "Fin de vida util" | "Garantia" | "Fuera de garantia"
  >("Fin de vida util");
  const [rDescripcion, setRDescripcion] = useState("");
  const [savingRetire, setSavingRetire] = useState(false);
  const [retireError, setRetireError] = useState("");

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<Lampara | null>(null);
  const [revertConfirmModal, setRevertConfirmModal] = useState<LamparaMovimiento | null>(null);
  const [revertingMovId, setRevertingMovId] = useState<string | null>(null);

  // ── Estados para Simulación ──
  const [simMode, setSimMode] = useState<"SEMANAL" | "MANUAL">("SEMANAL");
  const [simSelectedRoom, setSimSelectedRoom] = useState<number | null>(null);
  const [simSemanalDailyUsage, setSimSemanalDailyUsage] = useState<string>("");

  const [simManualHours, setSimManualHours] = useState<string>("");
  const [simManualDailyUsage, setSimManualDailyUsage] = useState<string>("");
  const [simManualStartDate, setSimManualStartDate] = useState<string>(
    dayjs().format("YYYY-MM-DD")
  );

  // ─── Cargar Salas Count ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!cineId) return;
    (async () => {
      try {
        const cfg = await getCineConfig(cineId);
        if (cfg?.salasCount && Number.isFinite(cfg.salasCount) && cfg.salasCount > 0) {
          setSalasCount(Math.floor(cfg.salasCount));
        }
      } catch (e) {
        console.error("Error al cargar salasCount:", e);
      }
    })();
  }, [cineId]);

  // ─── Suscripción en Tiempo Real a la Programación Semanal Actual ────────────
  useEffect(() => {
    if (!cineId) return;
    const docRef = doc(db, CINES_COLLECTION, cineId, "programacion_semanal", "actual");
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setWeeklyRows(data.weeklyRows || []);
        } else {
          setWeeklyRows([]);
        }
      },
      (error) => console.error("Error subscribiéndose a la programación:", error)
    );
    return () => unsub();
  }, [cineId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMins(getCurrentMinsFrom6AM());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // ─── Cargar último Control Semanal para vincular horas ──────────────────────
  useEffect(() => {
    if (!cineId) return;
    const q = query(
      collection(db, CINES_COLLECTION, cineId, "controles_semanales"),
      orderBy("fecha", "desc"),
      limit(1)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          setLatestControl(snap.docs[0].data());
        } else {
          setLatestControl(null);
        }
      },
      (err) => console.error("Error subscribiéndose al último control semanal:", err)
    );
    return () => unsub();
  }, [cineId]);

  // ─── Suscripción en Tiempo Real a Movimientos ──────────────────────────────
  useEffect(() => {
    if (!cineId) return;
    const qCol = collection(db, CINES_COLLECTION, cineId, "lampara_movimientos");
    const q = query(qCol, orderBy("fechaISO", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: LamparaMovimiento[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            tipo: data.tipo ?? "ingreso_backup",
            lamparaId: data.lamparaId ?? "",
            sala: data.sala !== undefined ? data.sala : null,
            marca: data.marca ?? "",
            potencia: data.potencia ?? "",
            modelo: data.modelo ?? "",
            fecha: data.fecha,
            fechaISO: data.fechaISO ?? "",
            mesAno: data.mesAno ?? "",
            userName: data.userName ?? "",
          };
        });
        setMovimientos(rows);
      },
      (err) => console.error("Error subscribiéndose a movimientos:", err)
    );
    return () => unsub();
  }, [cineId]);

  // ─── Suscripción en Tiempo Real a Lámparas ────────────────────────────────
  useEffect(() => {
    if (!cineId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const qCol = collection(db, CINES_COLLECTION, cineId, "lamparas");
    const unsub = onSnapshot(
      qCol,
      (snap) => {
        const rows: Lampara[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            status: data.status ?? "backup",
            sala: data.sala !== undefined ? data.sala : null,
            marca: data.marca ?? "",
            potencia: data.potencia ?? "",
            modelo: data.modelo ?? "",
            notas: data.notas ?? "",
            createdAt: data.createdAt,
            installedAt: data.installedAt,
            retiredAt: data.retiredAt,
            retirementDetails: data.retirementDetails,
          };
        });
        setLamparas(rows);
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribiéndose a lámparas:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [cineId]);

  // ─── Clasificación ─────────────────────────────────────────────────────────
  const activeLampsBySala = useMemo(() => {
    const map: Record<number, Lampara> = {};
    lamparas.forEach((lamp) => {
      if (lamp.status === "activa" && lamp.sala !== null) {
        map[lamp.sala] = lamp;
      }
    });
    return map;
  }, [lamparas]);

  const backupLamps = useMemo(() => {
    return lamparas.filter((l) => l.status === "backup");
  }, [lamparas]);

  const finalLampsByYear = useMemo(() => {
    const map: Record<number, Lampara[]> = {};
    lamparas
      .filter((l) => l.status === "final" && l.retirementDetails)
      .forEach((lamp) => {
        const year = lamp.retirementDetails?.anoRetiro ?? new Date().getFullYear();
        if (!map[year]) map[year] = [];
        map[year].push(lamp);
      });

    Object.keys(map).forEach((y) => {
      const yearNum = Number(y);
      map[yearNum].sort((a, b) => {
        const dateA = a.retiredAt?.seconds
          ? a.retiredAt.seconds * 1000
          : new Date(a.retiredAt || 0).getTime();
        const dateB = b.retiredAt?.seconds
          ? b.retiredAt.seconds * 1000
          : new Date(b.retiredAt || 0).getTime();
        return dateB - dateA;
      });
    });

    return map;
  }, [lamparas]);

  const sortedYears = useMemo(() => {
    return Object.keys(finalLampsByYear)
      .map(Number)
      .sort((a, b) => b - a);
  }, [finalLampsByYear]);

  useEffect(() => {
    if (sortedYears.length > 0) {
      setCollapsedYears((prev) => {
        const initial = { ...prev };
        sortedYears.forEach((y) => {
          if (initial[y] === undefined) initial[y] = false;
        });
        return initial;
      });
    }
  }, [sortedYears]);

  const toggleYearCollapse = (year: number) => {
    setCollapsedYears((prev) => ({ ...prev, [year]: !prev[year] }));
  };

  const movementsByMonth = useMemo(() => {
    const map: Record<string, LamparaMovimiento[]> = {};
    movimientos.forEach((mov) => {
      const key = mov.mesAno || "Sin fecha";
      if (!map[key]) map[key] = [];
      map[key].push(mov);
    });
    return map;
  }, [movimientos]);

  const sortedMonths = useMemo(() => {
    return Object.keys(movementsByMonth).sort((a, b) => b.localeCompare(a));
  }, [movementsByMonth]);

  useEffect(() => {
    if (sortedMonths.length > 0) {
      setCollapsedMonths((prev) => {
        const initial = { ...prev };
        sortedMonths.forEach((m) => {
          if (initial[m] === undefined) initial[m] = false;
        });
        return initial;
      });
    }
  }, [sortedMonths]);

  function formatMesAno(mesAnoStr: string) {
    if (!mesAnoStr) return "Desconocido";
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
    const monthIdx = parseInt(m, 10) - 1;
    return `${months[monthIdx] || m} ${y}`;
  }

  // ─── Acciones CRUD ─────────────────────────────────────────────────────────
  const handleAddBackup = async () => {
    if (readOnly) return;
    setAddError("");
    const cleanId = bId.trim().toUpperCase();

    if (!cleanId) {
      setAddError("El ID de la lámpara es obligatorio.");
      return;
    }

    if (!cineId) return;
    setSavingBackup(true);

    try {
      const alreadyExists = lamparas.some(
        (l) => l.id.toLowerCase() === cleanId.toLowerCase()
      );

      if (alreadyExists) {
        setAddError("Ya existe una lámpara con este ID en el sistema.");
        setSavingBackup(false);
        return;
      }

      const docRef = doc(db, CINES_COLLECTION, cineId, "lamparas", cleanId);
      await setDoc(docRef, {
        status: "backup",
        sala: null,
        marca: bMarca.trim(),
        potencia: bPotencia,
        modelo: bModelo,
        notas: bNotas.trim(),
        createdAt: serverTimestamp(),
      });

      const movRef = doc(collection(db, CINES_COLLECTION, cineId, "lampara_movimientos"));
      await setDoc(movRef, {
        tipo: "ingreso_backup",
        lamparaId: cleanId,
        sala: null,
        marca: bMarca.trim(),
        potencia: bPotencia,
        modelo: bModelo,
        fecha: serverTimestamp(),
        fechaISO: new Date().toISOString(),
        mesAno: new Date().toISOString().substring(0, 7),
        userName: displayName || "Operador",
      });

      setShowAddBackup(false);
      setBId("");
      setBMarca("USHIO");
      setBNotas("");
    } catch (e: any) {
      console.error(e);
      setAddError(e.message ?? "Error al guardar la lámpara.");
    } finally {
      setSavingBackup(false);
    }
  };

  const handleInstall = async () => {
    if (readOnly) return;
    if (!installModal || !selectedBackupId || !cineId) return;

    setSavingInstall(true);
    try {
      const roomNum = installModal.sala;
      const backupLamp = backupLamps.find((l) => l.id === selectedBackupId);
      const docRef = doc(db, CINES_COLLECTION, cineId, "lamparas", selectedBackupId);

      await updateDoc(docRef, {
        status: "activa",
        sala: roomNum,
        installedAt: serverTimestamp(),
      });

      const movRef = doc(collection(db, CINES_COLLECTION, cineId, "lampara_movimientos"));
      await setDoc(movRef, {
        tipo: "instalacion",
        lamparaId: selectedBackupId,
        sala: roomNum,
        marca: backupLamp?.marca ?? "",
        potencia: backupLamp?.potencia ?? "",
        modelo: backupLamp?.modelo ?? "",
        fecha: serverTimestamp(),
        fechaISO: new Date().toISOString(),
        mesAno: new Date().toISOString().substring(0, 7),
        userName: displayName || "Operador",
      });

      setInstallModal(null);
      setSelectedBackupId("");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", `No se pudo instalar la lámpara: ${e.message}`);
    } finally {
      setSavingInstall(false);
    }
  };

  const handleRetire = async () => {
    if (readOnly) return;
    if (savingRetire) return;
    setRetireError("");
    const horasUsadasNum = parseInt(rHorasUsadas.trim(), 10);
    const horasRestantesNum = parseInt(rHorasRestantes.trim(), 10);

    if (isNaN(horasUsadasNum) || horasUsadasNum < 0) {
      setRetireError("Por favor ingresá un número válido para las horas usadas.");
      return;
    }
    if (isNaN(horasRestantesNum)) {
      setRetireError("Por favor ingresá un número válido para las horas restantes.");
      return;
    }

    if (!retireModal || !cineId) return;
    setSavingRetire(true);

    try {
      const docRef = doc(db, CINES_COLLECTION, cineId, "lamparas", retireModal.lamparaId);

      const details: RetirementDetails = {
        horasUsadas: horasUsadasNum,
        horasRestantes: horasRestantesNum,
        tipoRetiro: rTipoRetiro,
        descripcion: rDescripcion.trim(),
        salaOriginal: retireModal.sala,
        anoRetiro: new Date().getFullYear(),
      };

      await updateDoc(docRef, {
        status: "final",
        sala: null,
        retiredAt: serverTimestamp(),
        retirementDetails: details,
      });

      const currentLamp = lamparas.find((l) => l.id === retireModal.lamparaId);
      const movRef = doc(collection(db, CINES_COLLECTION, cineId, "lampara_movimientos"));
      await setDoc(movRef, {
        tipo: "retiro",
        lamparaId: retireModal.lamparaId,
        sala: retireModal.sala,
        marca: currentLamp?.marca ?? "",
        potencia: currentLamp?.potencia ?? "",
        modelo: currentLamp?.modelo ?? "",
        fecha: serverTimestamp(),
        fechaISO: new Date().toISOString(),
        mesAno: new Date().toISOString().substring(0, 7),
        userName: displayName || "Operador",
      });

      setRetireModal(null);
      setRHorasUsadas("");
      setRHorasRestantes("");
      setRDescripcion("");
      setRTipoRetiro("Fin de vida util");
    } catch (e: any) {
      console.error(e);
      setRetireError(e.message ?? "Error al procesar el retiro.");
    } finally {
      setSavingRetire(false);
    }
  };

  const handleDeleteLamp = async (lamp: Lampara) => {
    if (readOnly) return;
    if (!cineId) return;
    try {
      await deleteDoc(doc(db, CINES_COLLECTION, cineId, "lamparas", lamp.id));
      setDeleteConfirmModal(null);
    } catch (e: any) {
      Alert.alert("Error", `No se pudo eliminar la lámpara: ${e.message}`);
    }
  };

  const handleRevertMovement = async (mov: LamparaMovimiento) => {
    if (readOnly) return;
    if (!cineId) return;
    setRevertingMovId(mov.id);

    try {
      const lampRef = doc(db, CINES_COLLECTION, cineId, "lamparas", mov.lamparaId);
      const lamp = lamparas.find((l) => l.id === mov.lamparaId);

      if (!lamp) {
        Alert.alert(
          "Error al revertir",
          "La lámpara asociada a este movimiento ya no existe en el sistema."
        );
        setRevertConfirmModal(null);
        return;
      }

      if (mov.tipo === "ingreso_backup") {
        if (lamp.status !== "backup") {
          Alert.alert(
            "No se puede revertir",
            "Esta lámpara ya no se encuentra en el stock de backup (ya fue instalada o retirada)."
          );
          setRevertConfirmModal(null);
          return;
        }
        await deleteDoc(lampRef);
        await deleteDoc(doc(db, CINES_COLLECTION, cineId, "lampara_movimientos", mov.id));
      } else if (mov.tipo === "instalacion") {
        if (lamp.status !== "activa") {
          Alert.alert(
            "No se puede revertir",
            "Esta lámpara ya no se encuentra activa en ningún proyector."
          );
          setRevertConfirmModal(null);
          return;
        }
        await updateDoc(lampRef, {
          status: "backup",
          sala: null,
          installedAt: null,
        });
        await deleteDoc(doc(db, CINES_COLLECTION, cineId, "lampara_movimientos", mov.id));
      } else if (mov.tipo === "retiro") {
        const targetSala = mov.sala;
        if (targetSala !== null && activeLampsBySala[targetSala]) {
          Alert.alert(
            "No es posible revertir",
            "El proyector ya tiene una nueva lámpara asignada. Revierta primero esa asignación."
          );
          setRevertConfirmModal(null);
          return;
        }
        await updateDoc(lampRef, {
          status: "activa",
          sala: targetSala,
          retiredAt: null,
          retirementDetails: null,
        });
        await deleteDoc(doc(db, CINES_COLLECTION, cineId, "lampara_movimientos", mov.id));
      }

      setRevertConfirmModal(null);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", `No se pudo revertir el movimiento: ${e.message}`);
    } finally {
      setRevertingMovId(null);
    }
  };

  const formatFirebaseDate = (val: any) => {
    if (!val) return "-";
    let date: Date;
    if (val.toDate) date = val.toDate();
    else if (val.seconds) date = new Date(val.seconds * 1000);
    else date = new Date(val);
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ─── Simulación ────────────────────────────────────────────────────────────
  const adjustManualDate = (amount: number) => {
    const d = dayjs(simManualStartDate);
    if (d.isValid()) {
      setSimManualStartDate(d.add(amount, "day").format("YYYY-MM-DD"));
    } else {
      setSimManualStartDate(dayjs().format("YYYY-MM-DD"));
    }
  };

  const runSimulation = (remainingHours: any, dailyUsage: any, startDateStr: string) => {
    const remainingHoursNum = Number(remainingHours);
    const dailyUsageNum = Number(dailyUsage);

    if (
      isNaN(remainingHoursNum) ||
      remainingHoursNum <= 0 ||
      isNaN(dailyUsageNum) ||
      dailyUsageNum <= 0
    ) {
      return null;
    }

    const days = Math.floor(remainingHoursNum / dailyUsageNum);
    const startDay = dayjs(startDateStr);
    if (!startDay.isValid()) return null;

    const simulationDays = [];
    let currentHours = remainingHoursNum;
    const maxSimulate = Math.min(days + 2, 100);

    for (let i = 1; i <= maxSimulate; i++) {
      const date = startDay.add(i - 1, "day");
      const hoursAtStart = currentHours;
      const hoursAtEnd = currentHours - dailyUsageNum;
      const isOk = hoursAtEnd >= 0;

      simulationDays.push({
        dayIndex: i,
        date: date.format("YYYY-MM-DD"),
        dateFormatted: date.format("dddd DD/MM"),
        hoursAtStart: parseFloat(hoursAtStart.toFixed(1)),
        hoursAtEnd: parseFloat(hoursAtEnd.toFixed(1)),
        isOk,
        status: isOk
          ? hoursAtEnd < dailyUsageNum
            ? "RECOMENDADO"
            : "SEGURO"
          : "INSUFICIENTE",
      });

      currentHours = hoursAtEnd;
      if (!isOk) break;
    }

    let recommendationText = "";
    let changeDateLabel = "";
    let hoursAtChange = 0;

    if (days === 0) {
      recommendationText = `Cambiar de inmediato el ${startDay.format("dddd DD/MM")} (antes de iniciar la jornada).`;
      changeDateLabel = startDay.format("dddd DD/MM");
      hoursAtChange = remainingHoursNum;
    } else {
      const lastSafeDate = startDay.add(days - 1, "day");
      const nextDate = startDay.add(days, "day");
      const lastSafeDateStr = lastSafeDate.format("dddd DD [de] MMMM");
      const nextDateStr = nextDate.format("dddd DD [de] MMMM");
      recommendationText = `Al cierre de ${lastSafeDateStr} / apertura de ${nextDateStr}`;
      changeDateLabel = `${lastSafeDateStr} (cierre) / ${nextDateStr} (apertura)`;
      hoursAtChange = remainingHoursNum - days * dailyUsageNum;
    }

    return {
      days,
      recommendationText,
      hoursAtChange: parseFloat(hoursAtChange.toFixed(1)),
      simulationDays,
      changeDateLabel,
    };
  };

  const simResult = useMemo(() => {
    if (simMode === "SEMANAL") {
      if (simSelectedRoom === null) return null;
      const controlLamp = latestControl?.lamparas?.find(
        (l: any) => l.sala === simSelectedRoom
      );
      if (!controlLamp) return null;
      const horasRestantes = controlLamp.horasRestantes ?? 0;
      const fechaReporte = latestControl.fecha ?? dayjs().format("YYYY-MM-DD");
      const dailyUsage = parseFloat(simSemanalDailyUsage);
      return runSimulation(horasRestantes, dailyUsage, fechaReporte);
    } else {
      const horasRestantes = parseFloat(simManualHours);
      const dailyUsage = parseFloat(simManualDailyUsage);
      const fechaInicial = simManualStartDate;
      return runSimulation(horasRestantes, dailyUsage, fechaInicial);
    }
  }, [
    simMode,
    simSelectedRoom,
    simSemanalDailyUsage,
    simManualHours,
    simManualDailyUsage,
    simManualStartDate,
    latestControl,
  ]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-rose-600 animate-spin mb-3" />
        <span className="text-xs font-semibold tracking-wide">
          Cargando parque de lámparas…
        </span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 py-3 pb-24">
      {/* Top Toolbar & Segmented Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 mb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Lightbulb size={18} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Gestión de Lámparas Xenon / Láser
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {Object.keys(activeLampsBySala).length}/{salasCount} Activas
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {backupLamps.length} Backup
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Monitoreo en vivo de proyectores, stock de repuestos, retiros y simulador de vida útil
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented 5-tab bar */}
          <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70 gap-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("PROYECTORES")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                activeTab === "PROYECTORES"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Projector
                size={13}
                className={activeTab === "PROYECTORES" ? "text-rose-600" : "text-slate-400"}
              />
              Proyectores
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("BACKUP")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                activeTab === "BACKUP"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Package
                size={13}
                className={activeTab === "BACKUP" ? "text-indigo-600" : "text-slate-400"}
              />
              Stock Backup ({backupLamps.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("HISTORIAL")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                activeTab === "HISTORIAL"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <History
                size={13}
                className={activeTab === "HISTORIAL" ? "text-amber-600" : "text-slate-400"}
              />
              Historial
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("MOVIMIENTOS")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                activeTab === "MOVIMIENTOS"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <ArrowLeftRight
                size={13}
                className={activeTab === "MOVIMIENTOS" ? "text-emerald-600" : "text-slate-400"}
              />
              Movimientos
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("SIMULACION")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                activeTab === "SIMULACION"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Calculator
                size={13}
                className={activeTab === "SIMULACION" ? "text-violet-600" : "text-slate-400"}
              />
              Simulación
            </button>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setAddError("");
                setShowAddBackup(true);
              }}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-500/20 hover:shadow-md hover:shadow-rose-500/30 hover:from-rose-500 hover:to-rose-600 active:scale-[0.97] transition-all cursor-pointer"
            >
              <Plus
                size={14}
                strokeWidth={2.5}
                className="transition-transform duration-200 group-hover:rotate-90"
              />
              <span>Nueva a Backup</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── PESTAÑA 1: PROYECTORES ─── */}
      {activeTab === "PROYECTORES" && (
        <div className="space-y-3">
          {/* Compact Info Banner */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-blue-50/80 border border-blue-200/70 text-blue-900 text-[11px]">
            <Info size={14} className="text-blue-600 shrink-0" />
            <span>
              Las horas de uso y restantes de las lámparas activas son reportadas y actualizadas{" "}
              <strong className="font-bold">cada viernes</strong> a través del Control Semanal.
            </span>
          </div>

          {/* 4-column Projector Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: salasCount }, (_, i) => i + 1).map((roomNum, idx) => {
              const activeLamp = activeLampsBySala[roomNum];
              const controlLamp = latestControl?.lamparas?.find(
                (l: any) => l.sala === roomNum
              );
              const horasUsadas = controlLamp?.horasActuales ?? "0";
              const horasRestantes = controlLamp?.horasRestantes ?? "0";

              // Find active show
              const currentDay = getCurrentWeekdayKey();
              let activeShow: any = null;
              const roomRows = weeklyRows.filter((row) => Number(row.sala) === roomNum);
              for (const row of roomRows) {
                const ranges = row.horariosPorDia?.[currentDay] ?? [];
                for (const range of ranges) {
                  let inicio = "";
                  let fin = "";
                  const match = range.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
                  if (match) {
                    inicio = match[1];
                    fin = match[2];
                  } else {
                    const timeMatch = range.match(/(\d{1,2}:\d{2})/);
                    if (timeMatch) {
                      inicio = timeMatch[1];
                      const [h, m] = inicio.split(":").map(Number);
                      const endMins = (h * 60 + m + 120) % 1440;
                      const endH = Math.floor(endMins / 60);
                      const endM = endMins % 60;
                      fin = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
                    }
                  }

                  if (inicio && fin) {
                    const startMins = timeToMinsFrom6AM(inicio);
                    const endMins = timeToMinsFrom6AM(fin);
                    if (currentTimeMins >= startMins && currentTimeMins < endMins) {
                      activeShow = {
                        pelicula: row.pelicula,
                        inicio,
                        fin,
                      };
                      break;
                    }
                  }
                }
                if (activeShow) break;
              }

              return (
                <div
                  key={roomNum}
                  style={{ animationDelay: `${Math.min(idx * 25, 250)}ms` }}
                  className={`animate-card-in hover-lift rounded-2xl border p-3.5 flex flex-col justify-between transition-all ${
                    activeShow
                      ? "bg-white border-indigo-200/90 shadow-xs"
                      : activeLamp
                      ? "bg-white border-slate-200/90 shadow-xs"
                      : "bg-slate-50/70 border-dashed border-slate-300"
                  }`}
                >
                  <div>
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-black flex items-center justify-center">
                          {roomNum}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900">
                          Sala {roomNum}
                        </span>
                      </div>

                      {activeShow ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                          EN FUNCIÓN
                        </span>
                      ) : activeLamp ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ACTIVA
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 text-slate-600">
                          VACÍO
                        </span>
                      )}
                    </div>

                    {activeLamp ? (
                      <div className="space-y-2.5">
                        {/* Lamp Serial & Specs */}
                        <div>
                          <div className="text-xs font-black text-slate-900 font-mono tracking-tight truncate">
                            #{roomNum} - {activeLamp.id}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {activeLamp.marca && (
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200/70">
                                {activeLamp.marca}
                              </span>
                            )}
                            {activeLamp.potencia && (
                              <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200/60">
                                {activeLamp.potencia}
                              </span>
                            )}
                            {activeLamp.modelo && (
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200/60">
                                {activeLamp.modelo}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium mt-1">
                            Instalada: {formatFirebaseDate(activeLamp.installedAt)}
                          </div>
                        </div>

                        {/* Hours Telemetry Boxes */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="rounded-xl bg-slate-50 border border-slate-200/70 px-2.5 py-1.5">
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                              Horas Usadas
                            </span>
                            <span className="text-xs font-black text-slate-800">
                              {horasUsadas} h
                            </span>
                          </div>
                          <div className="rounded-xl bg-slate-50 border border-slate-200/70 px-2.5 py-1.5">
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                              Restantes
                            </span>
                            <span
                              className={`text-xs font-black ${
                                Number(horasRestantes) < 100
                                  ? "text-rose-600"
                                  : "text-emerald-700"
                              }`}
                            >
                              {horasRestantes} h
                            </span>
                          </div>
                        </div>

                        {/* Active Show Banner */}
                        {activeShow ? (
                          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-indigo-50/70 border border-indigo-200/60">
                            <PlayCircle size={14} className="text-indigo-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-bold text-indigo-950 truncate">
                                {activeShow.pelicula}
                              </div>
                              <div className="text-[10px] text-indigo-600 font-medium">
                                En función hasta las {activeShow.fin}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-400">
                            <PlayCircle size={14} className="shrink-0 opacity-60" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-semibold truncate">
                                Sin función activa
                              </div>
                              <div className="text-[9px]">Sala en espera</div>
                            </div>
                          </div>
                        )}

                        {activeLamp.notas && (
                          <div className="text-[10px] text-slate-500 bg-amber-50/60 border border-amber-200/60 rounded-lg px-2 py-1 line-clamp-2">
                            💬 {activeLamp.notas}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-6 flex flex-col items-center justify-center text-center">
                        <Projector size={24} className="text-slate-300 mb-1.5" />
                        <span className="text-xs font-bold text-slate-500">
                          Sin lámpara activa
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          Asigná una unidad desde el Stock Backup
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer Action Button */}
                  {!readOnly && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      {activeLamp ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRetireModal({ sala: roomNum, lamparaId: activeLamp.id });
                            setRHorasUsadas(String(horasUsadas));
                            setRHorasRestantes(String(horasRestantes));
                            setRDescripcion("");
                            setRTipoRetiro("Fin de vida util");
                            setRetireError("");
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-600 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          <LogOut size={12} />
                          Retirar Lámpara
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (backupLamps.length === 0) {
                              Alert.alert(
                                "Sin Stock de Backup",
                                "No hay lámparas disponibles en stock. Cargá una nueva lámpara primero."
                              );
                              return;
                            }
                            setInstallModal({ sala: roomNum });
                            setSelectedBackupId(backupLamps[0].id);
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          <Zap size={12} />
                          Instalar desde Backup
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── PESTAÑA 2: STOCK BACKUP ─── */}
      {activeTab === "BACKUP" && (
        <div>
          {backupLamps.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center max-w-md mx-auto my-6 animate-card-in">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Package size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                Stock de Backup Vacío
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                No hay lámparas de repuesto disponibles en depósito. Registrá una nueva unidad para poder instalarla en las salas.
              </p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setAddError("");
                    setShowAddBackup(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  Cargar Lámpara a Backup
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {backupLamps.map((lamp, idx) => (
                <div
                  key={lamp.id}
                  style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                  className="animate-card-in hover-lift bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <Package size={15} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-900 font-mono truncate">
                            {lamp.id}
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            Ingreso: {formatFirebaseDate(lamp.createdAt)}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                        EN STOCK
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 my-2">
                      {lamp.marca && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          Marca: {lamp.marca}
                        </span>
                      )}
                      {lamp.potencia && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold">
                          {lamp.potencia}
                        </span>
                      )}
                      {lamp.modelo && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">
                          {lamp.modelo}
                        </span>
                      )}
                    </div>

                    {lamp.notas && (
                      <p className="text-[11px] text-slate-600 bg-slate-50 rounded-xl px-2.5 py-1.5 border border-slate-100 mt-1">
                        💬 {lamp.notas}
                      </p>
                    )}
                  </div>

                  {!readOnly && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmModal(lamp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 size={12} />
                        Eliminar de Stock
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── PESTAÑA 3: HISTORIAL FINAL ─── */}
      {activeTab === "HISTORIAL" && (
        <div className="space-y-3">
          {sortedYears.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center max-w-md mx-auto my-6">
              <History size={28} className="text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 mb-1">Sin Historial</h3>
              <p className="text-xs text-slate-500">
                Todavía no se han retirado lámparas al archivo histórico.
              </p>
            </div>
          ) : (
            sortedYears.map((year) => {
              const lampsInYear = finalLampsByYear[year] || [];
              const isCollapsed = !!collapsedYears[year];

              return (
                <div
                  key={year}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleYearCollapse(year)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/70 hover:bg-slate-100/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Calendar size={15} className="text-rose-600" />
                      <span className="text-xs font-extrabold text-slate-900">
                        Año {year}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 text-slate-700">
                        {lampsInYear.length} retiradas
                      </span>
                    </div>
                    {isCollapsed ? (
                      <ChevronDown size={16} className="text-slate-400" />
                    ) : (
                      <ChevronUp size={16} className="text-slate-400" />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {lampsInYear.map((lamp) => {
                        const det = lamp.retirementDetails!;
                        const isGarantia = det.tipoRetiro === "Garantia";
                        const isFuera = det.tipoRetiro === "Fuera de garantia";

                        return (
                          <div
                            key={lamp.id}
                            className="rounded-xl border border-slate-200/80 p-3 bg-slate-50/40 flex flex-col justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-xs font-black text-slate-900 font-mono">
                                  #{det.salaOriginal} - {lamp.id}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    isGarantia
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : isFuera
                                      ? "bg-rose-50 text-rose-700 border-rose-200"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  }`}
                                >
                                  {det.tipoRetiro}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-1 mb-2">
                                {lamp.marca && (
                                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-600">
                                    {lamp.marca}
                                  </span>
                                )}
                                {lamp.potencia && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-[10px] font-bold text-rose-700">
                                    {lamp.potencia}
                                  </span>
                                )}
                                {lamp.modelo && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[10px] font-bold text-blue-700">
                                    {lamp.modelo}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 mb-2">
                                <div className="bg-white rounded-lg px-2 py-1 border border-slate-200/60">
                                  <span className="block text-[9px] uppercase font-bold text-slate-400">
                                    Usadas
                                  </span>
                                  <span className="text-xs font-extrabold text-slate-800">
                                    {det.horasUsadas} hs
                                  </span>
                                </div>
                                <div className="bg-white rounded-lg px-2 py-1 border border-slate-200/60">
                                  <span className="block text-[9px] uppercase font-bold text-slate-400">
                                    Restantes
                                  </span>
                                  <span className="text-xs font-extrabold text-slate-800">
                                    {det.horasRestantes} hs
                                  </span>
                                </div>
                              </div>

                              {det.descripcion && (
                                <p className="text-[11px] text-slate-600 bg-white rounded-lg p-2 border border-slate-200/60">
                                  📝 {det.descripcion}
                                </p>
                              )}
                            </div>

                            <div className="text-[10px] text-slate-400 pt-1.5 border-t border-slate-200/60 flex justify-between">
                              <span>In: {formatFirebaseDate(lamp.installedAt)}</span>
                              <span>Out: {formatFirebaseDate(lamp.retiredAt)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── PESTAÑA 4: MOVIMIENTOS ─── */}
      {activeTab === "MOVIMIENTOS" && (
        <div className="space-y-3">
          {sortedMonths.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center max-w-md mx-auto my-6">
              <ArrowLeftRight size={28} className="text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                Sin Movimientos Registrados
              </h3>
              <p className="text-xs text-slate-500">
                Aquí aparecerán los ingresos a backup, instalaciones en proyectores y retiros.
              </p>
            </div>
          ) : (
            sortedMonths.map((mesAno) => {
              const list = movementsByMonth[mesAno] || [];
              const isCollapsed = !!collapsedMonths[mesAno];

              return (
                <div
                  key={mesAno}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedMonths((prev) => ({
                        ...prev,
                        [mesAno]: !prev[mesAno],
                      }))
                    }
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/70 hover:bg-slate-100/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Calendar size={15} className="text-indigo-600" />
                      <span className="text-xs font-extrabold text-slate-900">
                        {formatMesAno(mesAno)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 text-slate-700">
                        {list.length} mov.
                      </span>
                    </div>
                    {isCollapsed ? (
                      <ChevronDown size={16} className="text-slate-400" />
                    ) : (
                      <ChevronUp size={16} className="text-slate-400" />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100">
                      {list.map((mov) => {
                        const isIngreso = mov.tipo === "ingreso_backup";
                        const isInstalacion = mov.tipo === "instalacion";

                        return (
                          <div
                            key={mov.id}
                            className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold shrink-0 border ${
                                  isIngreso
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : isInstalacion
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {isIngreso
                                  ? "INGRESO STOCK"
                                  : isInstalacion
                                  ? "INSTALACIÓN"
                                  : "RETIRO"}
                              </span>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-black text-slate-900 font-mono">
                                    {mov.lamparaId}
                                  </span>
                                  {mov.sala && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">
                                      Sala {mov.sala}
                                    </span>
                                  )}
                                  {mov.potencia && (
                                    <span className="text-[10px] font-bold text-rose-600">
                                      {mov.potencia}
                                    </span>
                                  )}
                                  {mov.modelo && (
                                    <span className="text-[10px] font-semibold text-slate-500">
                                      {mov.modelo}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>{formatFirebaseDate(mov.fecha || mov.fechaISO)}</span>
                                  {mov.userName && (
                                    <span className="inline-flex items-center gap-0.5 text-slate-500 font-medium">
                                      <User size={10} /> {mov.userName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {!readOnly && (
                              <button
                                type="button"
                                disabled={revertingMovId === mov.id}
                                onClick={() => setRevertConfirmModal(mov)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 text-[10px] font-bold transition-colors shrink-0 cursor-pointer"
                              >
                                <RotateCcw size={11} />
                                Revertir
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── PESTAÑA 5: SIMULACIÓN ─── */}
      {activeTab === "SIMULACION" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Panel: Parameters */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Parámetros de Proyección
                </h3>
                <p className="text-[11px] text-slate-500">
                  Calculá el día exacto de recambio según el consumo diario
                </p>
              </div>
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSimMode("SEMANAL")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    simMode === "SEMANAL"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  Control Semanal
                </button>
                <button
                  type="button"
                  onClick={() => setSimMode("MANUAL")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    simMode === "MANUAL"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>

            {simMode === "SEMANAL" ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    1. Seleccioná la Sala a simular
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {Array.from({ length: salasCount }, (_, i) => i + 1).map((room) => {
                      const cLamp = latestControl?.lamparas?.find(
                        (l: any) => l.sala === room
                      );
                      const rem = cLamp?.horasRestantes ?? 0;
                      const isSelected = simSelectedRoom === room;
                      return (
                        <button
                          key={room}
                          type="button"
                          onClick={() => setSimSelectedRoom(room)}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <div className="text-[11px] font-extrabold">S{room}</div>
                          <div
                            className={`text-[9px] font-bold ${
                              isSelected ? "text-emerald-300" : "text-slate-400"
                            }`}
                          >
                            {rem}h
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    2. Horas de uso promedio por día
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={simSemanalDailyUsage}
                    onChange={(e) => setSimSemanalDailyUsage(e.target.value)}
                    placeholder="Ej: 11.5"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Horas Restantes
                    </label>
                    <input
                      type="number"
                      value={simManualHours}
                      onChange={(e) => setSimManualHours(e.target.value)}
                      placeholder="Ej: 95"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Consumo Diario (hs)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={simManualDailyUsage}
                      onChange={(e) => setSimManualDailyUsage(e.target.value)}
                      placeholder="Ej: 12"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Fecha de Inicio (YYYY-MM-DD)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustManualDate(-1)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="date"
                      value={simManualStartDate}
                      onChange={(e) => setSimManualStartDate(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => adjustManualDate(1)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Simulation Results */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4">
            {!simResult ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center text-slate-400">
                <Calculator size={28} className="mb-2 opacity-50" />
                <p className="text-xs font-bold text-slate-600">
                  Completá los datos para proyectar el desgaste diario
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Verás el cronograma día por día y la fecha óptima de cambio
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                      Momento Óptimo de Recambio ({simResult.days} jornadas seguras)
                    </span>
                    <div className="text-xs font-black text-indigo-950 mt-0.5">
                      {simResult.recommendationText}
                    </div>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-right shrink-0">
                    <span className="block text-[9px] font-bold uppercase text-slate-400">
                      Remanente al cambio
                    </span>
                    <span className="text-xs font-black text-indigo-700">
                      {simResult.hoursAtChange} hs
                    </span>
                  </div>
                </div>

                <div className="max-h-[340px] overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-500">
                        <th className="py-2 px-3">Día</th>
                        <th className="py-2 px-3">Inicio</th>
                        <th className="py-2 px-3">Cierre</th>
                        <th className="py-2 px-3 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {simResult.simulationDays.map((d) => (
                        <tr key={d.dayIndex} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-bold text-slate-800 capitalize">
                            #{d.dayIndex} · {d.dateFormatted}
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-mono">
                            {d.hoursAtStart}h
                          </td>
                          <td className="py-2 px-3 font-bold font-mono text-slate-900">
                            {d.hoursAtEnd}h
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                d.status === "SEGURO"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : d.status === "RECOMENDADO"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 1: AGREGAR LÁMPARA A BACKUP ─── */}
      {showAddBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-backdrop-in">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-modal-in">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                <h3 className="text-sm font-extrabold">Nueva Lámpara a Backup</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBackup(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              {addError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    N° de Serie / ID *
                  </label>
                  <input
                    type="text"
                    value={bId}
                    onChange={(e) => setBId(e.target.value)}
                    placeholder="Ej: L-9082"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 uppercase focus:bg-white focus:border-rose-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={bMarca}
                    onChange={(e) => setBMarca(e.target.value)}
                    placeholder="USHIO / OSRAM"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 uppercase focus:bg-white focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Potencia Nominal
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {POTENCIAS_OPTIONS.map((pot) => (
                    <button
                      key={pot}
                      type="button"
                      onClick={() => setBPotencia(pot)}
                      className={`py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        bPotencia === pot
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {pot}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Modelo
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MODELOS_OPTIONS.map((mod) => (
                    <button
                      key={mod}
                      type="button"
                      onClick={() => setBModelo(mod)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                        bModelo === mod
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {mod}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Notas u Observaciones (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={bNotas}
                  onChange={(e) => setBNotas(e.target.value)}
                  placeholder="Ej: Recibida en remito #401..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:border-rose-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBackup(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingBackup}
                  onClick={handleAddBackup}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Check size={14} />
                  {savingBackup ? "Guardando…" : "Guardar en Stock"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: INSTALAR LÁMPARA EN SALA ─── */}
      {installModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-backdrop-in">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-modal-in">
            <div className="px-5 py-3.5 bg-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-indigo-400" />
                <h3 className="text-sm font-extrabold">
                  Instalar Lámpara en Sala {installModal.sala}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInstallModal(null)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600">
                Seleccioná la unidad disponible del Stock Backup que vas a colocar en el proyector de la{" "}
                <strong className="text-slate-900">Sala {installModal.sala}</strong>:
              </p>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {backupLamps.map((lamp) => {
                  const selected = selectedBackupId === lamp.id;
                  return (
                    <button
                      key={lamp.id}
                      type="button"
                      onClick={() => setSelectedBackupId(lamp.id)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        selected
                          ? "bg-indigo-50/90 border-indigo-500 ring-1 ring-indigo-500"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black text-slate-900 font-mono">
                          {lamp.id}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                          {[lamp.marca, lamp.potencia, lamp.modelo].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          selected
                            ? "bg-indigo-600 text-white"
                            : "border border-slate-300 bg-white"
                        }`}
                      >
                        {selected && <Check size={12} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInstallModal(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingInstall || !selectedBackupId}
                  onClick={handleInstall}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Check size={14} />
                  {savingInstall ? "Instalando…" : "Confirmar Instalación"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: RETIRAR LÁMPARA A HISTORIAL FINAL ─── */}
      {retireModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-backdrop-in">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-modal-in">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LogOut size={16} className="text-rose-400" />
                <h3 className="text-sm font-extrabold">
                  Retirar Lámpara · Sala {retireModal.sala}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRetireModal(null)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                Unidad a archivar:{" "}
                <span className="font-mono font-black text-slate-950">
                  {retireModal.lamparaId}
                </span>
              </div>

              {retireError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {retireError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Horas Usadas Finales *
                  </label>
                  <input
                    type="number"
                    value={rHorasUsadas}
                    onChange={(e) => setRHorasUsadas(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Horas Restantes *
                  </label>
                  <input
                    type="number"
                    value={rHorasRestantes}
                    onChange={(e) => setRHorasRestantes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Motivo de Retiro
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      "Fin de vida util",
                      "Garantia",
                      "Fuera de garantia",
                    ] as const
                  ).map((mot) => (
                    <button
                      key={mot}
                      type="button"
                      onClick={() => setRTipoRetiro(mot)}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        rTipoRetiro === mot
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {mot}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Observaciones del retiro
                </label>
                <textarea
                  rows={2}
                  value={rDescripcion}
                  onChange={(e) => setRDescripcion(e.target.value)}
                  placeholder="Ej: Parpadeo leve o reemplazo preventivo..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:border-rose-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRetireModal(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingRetire}
                  onClick={handleRetire}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <LogOut size={13} />
                  {savingRetire ? "Archivando…" : "Confirmar Retiro"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: CONFIRMAR ELIMINACIÓN DE BACKUP ─── */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-backdrop-in">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-3 animate-modal-in">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 size={20} />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">
              ¿Eliminar lámpara {deleteConfirmModal.id}?
            </h3>
            <p className="text-xs text-slate-500">
              Esta unidad se quitará permanentemente del Stock de Backup.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteLamp(deleteConfirmModal)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: CONFIRMAR REVERTIR MOVIMIENTO ─── */}
      {revertConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-backdrop-in">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-3 animate-modal-in">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <RotateCcw size={20} />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">
              ¿Revertir movimiento de {revertConfirmModal.lamparaId}?
            </h3>
            <p className="text-xs text-slate-500">
              La lámpara volverá a su estado anterior y este registro de movimiento se eliminará.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevertConfirmModal(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={revertingMovId === revertConfirmModal.id}
                onClick={() => handleRevertMovement(revertConfirmModal)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {revertingMovId === revertConfirmModal.id ? "Revirtiendo…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
