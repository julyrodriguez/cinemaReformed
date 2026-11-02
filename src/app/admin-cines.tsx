import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  Globe,
  KeyRound,
  Network,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";

import NavHeader from "@/components/NavHeader";
import SEOHead from "@/components/SEOHead";
import {
  adminChangeCinePassword,
  adminCreateCine,
  adminListAuthorizedIps,
  adminListCines,
  adminRemoveAuthorizedIp,
  adminSetOficinasRole,
  adminUpdateCine,
  adminUpsertAuthorizedIp,
  AuthorizedIpItem,
  CineListItem,
} from "@/lib/adminCines";
import { checkIpAccess, authorizeCurrentIp } from "@/lib/ipAccess";
import { useAuthUser } from "@/lib/useAuthUser";

type AdminView = "list" | "create" | "edit";

export default function AdminCinesScreen() {
  const router = useRouter();
  const { user, loading: authLoading, isLoggedIn, isAdmin } = useAuthUser();

  const [view, setView] = useState<AdminView>("list");
  const [cines, setCines] = useState<CineListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [selectedCine, setSelectedCine] = useState<CineListItem | null>(null);

  const [formCineId, setFormCineId] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formAuthEmail, setFormAuthEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formSalasCount, setFormSalasCount] = useState("");
  const [formInitialIps, setFormInitialIps] = useState("");

  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [ipsModalVisible, setIpsModalVisible] = useState(false);
  const [ips, setIps] = useState<AuthorizedIpItem[]>([]);
  const [ipsLoading, setIpsLoading] = useState(false);
  const [newIpModalVisible, setNewIpModalVisible] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState("");
  const [newIpLabel, setNewIpLabel] = useState("");
  const [newIpType, setNewIpType] = useState<"fixed" | "mobile">("fixed");

  const [ipCheckState, setIpCheckState] = useState<
    "checking" | "authorized" | "not_authorized" | "error"
  >("checking");
  const [ipCheckError, setIpCheckError] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState("");
  const [adminIpLabel, setAdminIpLabel] = useState("");
  const [adminIpLoading, setAdminIpLoading] = useState(false);
  const [adminIpError, setAdminIpError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn && isAdmin) {
      checkAdminIpAccess();
    }
  }, [isLoggedIn, isAdmin]);

  useEffect(() => {
    if (ipCheckState === "authorized") {
      loadCines();
    }
  }, [ipCheckState]);

  const checkAdminIpAccess = async () => {
    try {
      setIpCheckState("checking");
      const res = await checkIpAccess();

      if (res.state === "authorized") {
        setIpCheckState("authorized");
      } else if (res.state === "not_authorized") {
        setIpCheckState("not_authorized");
      } else if (res.state === "error") {
        setIpCheckState("error");
        setIpCheckError(res.message);
      }
    } catch (e: any) {
      setIpCheckState("error");
      setIpCheckError(e?.message || "Error al validar IP.");
    }
  };

  const handleAdminIpAuthorization = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!adminPin.trim()) {
      setAdminIpError("Ingresá el PIN.");
      return;
    }
    if (!adminIpLabel.trim()) {
      setAdminIpError("Ingresá un nombre para esta IP.");
      return;
    }

    try {
      setAdminIpLoading(true);
      setAdminIpError(null);

      const res = await authorizeCurrentIp({
        pin: adminPin,
        label: adminIpLabel,
      });

      if (res.ok) {
        setIpCheckState("authorized");
        setAdminPin("");
        setAdminIpLabel("");
      } else {
        setAdminIpError(res.message);
      }
    } catch (e: any) {
      setAdminIpError(e?.message || "Error al autorizar IP.");
    } finally {
      setAdminIpLoading(false);
    }
  };

  const loadCines = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminListCines({ query: searchQuery });
      setCines(res.items);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Error al cargar cines.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCine = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formCineId.trim()) {
      setFormError("CineId requerido.");
      return;
    }
    if (!formNombre.trim()) {
      setFormError("Nombre requerido.");
      return;
    }
    if (!formPassword || formPassword.length < 8) {
      setFormError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!formPin.trim()) {
      setFormError("PIN requerido.");
      return;
    }

    const initialIps = formInitialIps
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((ip) => ({ ip, label: "Inicial", type: "fixed" as const }));

    const salasCount = formSalasCount.trim() ? parseInt(formSalasCount, 10) : 0;

    try {
      setFormLoading(true);
      await adminCreateCine({
        cineId: formCineId.trim(),
        nombre: formNombre.trim(),
        authEmail: formAuthEmail.trim() || undefined,
        initialPassword: formPassword,
        accessPin: formPin.trim(),
        active: formActive,
        salasCount: salasCount > 0 ? salasCount : undefined,
        initialIps: initialIps.length > 0 ? initialIps : undefined,
      });

      setFormSuccess("Complejo creado exitosamente.");
      setFormCineId("");
      setFormNombre("");
      setFormAuthEmail("");
      setFormPassword("");
      setFormPin("");
      setFormActive(true);
      setFormSalasCount("");
      setFormInitialIps("");

      await loadCines();

      setTimeout(() => {
        setView("list");
        setFormSuccess(null);
      }, 1200);
    } catch (e: any) {
      console.error(e);
      setFormError(e?.message || "Error al crear cine.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateCine = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedCine) return;

    setFormError(null);
    setFormSuccess(null);

    const patch: any = { cineId: selectedCine.cineId };
    if (formNombre.trim() && formNombre !== selectedCine.nombre) {
      patch.nombre = formNombre.trim();
    }
    if (formAuthEmail.trim() && formAuthEmail !== selectedCine.authEmail) {
      patch.authEmail = formAuthEmail.trim();
    }
    if (formPin.trim()) {
      patch.accessPin = formPin.trim();
    }
    if (formActive !== selectedCine.active) {
      patch.active = formActive;
    }

    if (Object.keys(patch).length === 1) {
      setFormError("No hay cambios para guardar.");
      return;
    }

    try {
      setFormLoading(true);
      await adminUpdateCine(patch);
      setFormSuccess("Complejo actualizado correctamente.");
      await loadCines();

      setTimeout(() => {
        setView("list");
        setSelectedCine(null);
        setFormSuccess(null);
      }, 1200);
    } catch (e: any) {
      console.error(e);
      setFormError(e?.message || "Error al actualizar cine.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditCine = (cine: CineListItem) => {
    setSelectedCine(cine);
    setFormCineId(cine.cineId);
    setFormNombre(cine.nombre);
    setFormAuthEmail(cine.authEmail);
    setFormPin("");
    setFormActive(cine.active);
    setFormError(null);
    setFormSuccess(null);
    setView("edit");
  };

  const handleViewIps = async (cine: CineListItem) => {
    setSelectedCine(cine);
    setIpsModalVisible(true);
    setIpsLoading(true);
    try {
      const res = await adminListAuthorizedIps({ cineId: cine.cineId });
      setIps(res.items);
    } catch (e: any) {
      console.error(e);
      setIps([]);
    } finally {
      setIpsLoading(false);
    }
  };

  const handleAddIp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedCine) return;
    if (!newIpAddress.trim() || !newIpLabel.trim()) {
      window.alert("Dirección IP y Etiqueta son requeridas.");
      return;
    }

    try {
      await adminUpsertAuthorizedIp({
        cineId: selectedCine.cineId,
        ip: newIpAddress.trim(),
        label: newIpLabel.trim(),
        type: newIpType,
        active: true,
      });

      setNewIpModalVisible(false);
      setNewIpAddress("");
      setNewIpLabel("");
      setNewIpType("fixed");

      const res = await adminListAuthorizedIps({ cineId: selectedCine.cineId });
      setIps(res.items);
    } catch (e: any) {
      console.error(e);
      window.alert(e?.message || "Error al agregar IP.");
    }
  };

  const handleRemoveIp = async (ip: string) => {
    if (!selectedCine) return;
    if (!window.confirm(`¿Eliminar autorización para la IP ${ip}?`)) return;

    try {
      await adminRemoveAuthorizedIp({ cineId: selectedCine.cineId, ip });
      const res = await adminListAuthorizedIps({ cineId: selectedCine.cineId });
      setIps(res.items);
    } catch (e: any) {
      console.error(e);
      window.alert(e?.message || "Error al eliminar IP.");
    }
  };

  const handleChangePassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedCine) return;

    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);

    if (!newPasswordValue || newPasswordValue.length < 8) {
      setPasswordChangeError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    try {
      setPasswordChangeLoading(true);
      const res = await adminChangeCinePassword({
        cineId: selectedCine.cineId,
        newPassword: newPasswordValue,
      });

      setPasswordChangeSuccess(res.message);
      setNewPasswordValue("");

      setTimeout(() => {
        setChangePasswordModalVisible(false);
        setPasswordChangeSuccess(null);
      }, 1200);
    } catch (e: any) {
      console.error(e);
      setPasswordChangeError(e?.message || "Error al cambiar contraseña.");
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const handleSetOficinasRole = async (cineId: string) => {
    if (
      !window.confirm(
        `¿Convertir "${cineId}" a rol OFICINAS? Este usuario podrá ver eventos de todos los cines. El usuario debe cerrar sesión y volver a iniciar para que el cambio tome efecto.`
      )
    ) {
      return;
    }

    try {
      const res = await adminSetOficinasRole({ cineId });
      window.alert(res.message + "\n\nEl usuario debe cerrar sesión y volver a iniciar.");
    } catch (e: any) {
      console.error(e);
      window.alert(e?.message || "Error al convertir a rol oficinas.");
    }
  };

  const stats = useMemo(() => {
    const total = cines.length;
    const active = cines.filter((c) => c.active).length;
    return { total, active, inactive: total - active };
  }, [cines]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-rose-600" />
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return <Redirect href="/login" />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 dark:bg-zinc-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-stripe dark:border-zinc-800 dark:bg-zinc-900">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-rose-600" />
          <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">
            Acceso Restringido
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Esta sección requiere privilegios de Administrador General.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver al panel</span>
          </button>
        </div>
      </div>
    );
  }

  if (ipCheckState === "checking") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-rose-600" />
        <span className="mt-3 text-xs font-medium text-slate-500">Validando IP…</span>
      </div>
    );
  }

  if (ipCheckState === "not_authorized") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-zinc-950">
        <form
          onSubmit={handleAdminIpAuthorization}
          className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-stripe-md dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            Validación de IP — Administración
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Autorizá tu dirección IP actual para ingresar al panel de complejos.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
              PIN de Acceso
            </label>
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="••••"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Etiqueta de Red
            </label>
            <input
              type="text"
              value={adminIpLabel}
              onChange={(e) => setAdminIpLabel(e.target.value)}
              placeholder="Ej: Oficina Central"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          {adminIpError && (
            <p className="text-xs font-semibold text-rose-600">{adminIpError}</p>
          )}
          <button
            type="submit"
            disabled={adminIpLoading}
            className="w-full rounded-lg bg-rose-600 py-2.5 text-xs font-semibold text-white hover:bg-rose-700"
          >
            {adminIpLoading ? "Autorizando..." : "Autorizar IP"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Administración de Complejos | Cinemark Workspace"
        description="Panel de administración general de complejos, usuarios y listas blancas de IP."
        pathname="/admin-cines"
        noIndex
      />
      <div className="min-h-screen w-full bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
        <NavHeader title="Cinemark Workspace" sectionLabel="Administración de Complejos" />

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Top Bar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => (view === "list" ? router.push("/") : setView("list"))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                title="Volver"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
                  {view === "list"
                    ? "Directorio de Complejos y Usuarios"
                    : view === "create"
                    ? "Registrar Nuevo Complejo"
                    : `Editar Complejo: ${selectedCine?.nombre}`}
                </h1>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Gestión centralizada de accesos, salas, roles y direcciones IP autorizadas
                </p>
              </div>
            </div>

            {view === "list" && (
              <button
                type="button"
                onClick={() => {
                  setFormCineId("");
                  setFormNombre("");
                  setFormAuthEmail("");
                  setFormPassword("");
                  setFormPin("");
                  setFormActive(true);
                  setFormSalasCount("");
                  setFormInitialIps("");
                  setFormError(null);
                  setFormSuccess(null);
                  setView("create");
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo Complejo</span>
              </button>
            )}
          </div>

          {view === "list" && (
            <>
              {/* KPI Strip */}
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-stripe dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Total Registrados
                  </span>
                  <div className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-zinc-100">
                    {stats.total}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-stripe dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Complejos Activos
                  </span>
                  <div className="mt-1 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.active}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-stripe dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Inactivos
                  </span>
                  <div className="mt-1 font-mono text-2xl font-bold text-slate-500 dark:text-zinc-400">
                    {stats.inactive}
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-5 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-stripe dark:border-zinc-800 dark:bg-zinc-900">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadCines()}
                    placeholder="Filtrar por nombre, cineId o correo electrónico..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-xs font-medium text-slate-900 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadCines}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Buscar
                </button>
              </div>

              {/* Complex Table / List */}
              {loading ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-rose-600" />
                  <span className="mt-2.5 text-xs font-medium text-slate-500">
                    Cargando complejos…
                  </span>
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
                  {error}
                </div>
              ) : cines.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-500 dark:border-zinc-800 dark:bg-zinc-900">
                  No se encontraron complejos para la búsqueda.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-stripe dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {cines.map((cine) => (
                      <div
                        key={cine.cineId}
                        className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-950/50"
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold text-slate-900 dark:text-zinc-100">
                                {cine.nombre}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  cine.active
                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900"
                                    : "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900"
                                }`}
                              >
                                {cine.active ? "Activo" : "Inactivo"}
                              </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                              <span className="font-mono text-[11px]">ID: {cine.cineId}</span>
                              <span>•</span>
                              <span className="font-mono text-[11px]">{cine.authEmail}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewIps(cine)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                          >
                            <Network className="h-3.5 w-3.5 text-slate-500" />
                            <span>IPs</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEditCine(cine)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                          >
                            <Pencil className="h-3.5 w-3.5 text-slate-500" />
                            <span>Editar</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {(view === "create" || (view === "edit" && selectedCine)) && (
            <form
              onSubmit={view === "create" ? handleCreateCine : handleUpdateCine}
              className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-stripe dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Cine ID {view === "create" ? "*" : "(No editable)"}
                  </label>
                  <input
                    type="text"
                    value={formCineId}
                    onChange={(e) => setFormCineId(e.target.value)}
                    disabled={view === "edit"}
                    placeholder="Ej: abasto"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 font-mono text-sm disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Nombre del Complejo *
                  </label>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    placeholder="Ej: Cinemark Abasto"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Email de Acceso (Opcional)
                  </label>
                  <input
                    type="email"
                    value={formAuthEmail}
                    onChange={(e) => setFormAuthEmail(e.target.value)}
                    placeholder="Auto-generado si se deja vacío"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    {view === "create"
                      ? "PIN Maestro de Acceso *"
                      : "Nuevo PIN Maestro (Dejar vacío para mantener)"}
                  </label>
                  <input
                    type="password"
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value)}
                    placeholder="••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              </div>

              {view === "create" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Contraseña Inicial * (Mín. 8 caracteres)
                    </label>
                    <input
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Contraseña inicial"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Cantidad de Salas
                    </label>
                    <input
                      type="number"
                      value={formSalasCount}
                      onChange={(e) => setFormSalasCount(e.target.value)}
                      placeholder="Ej: 10"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </div>
                </div>
              )}

              {view === "create" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    IPs Autorizadas Iniciales (Una por línea, opcional)
                  </label>
                  <textarea
                    rows={3}
                    value={formInitialIps}
                    onChange={(e) => setFormInitialIps(e.target.value)}
                    placeholder="190.210.12.34"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <label className="inline-flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Complejo Activo y Habilitado
                  </span>
                </label>

                {view === "edit" && selectedCine && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewPasswordValue("");
                        setPasswordChangeError(null);
                        setPasswordChangeSuccess(null);
                        setChangePasswordModalVisible(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Cambiar Contraseña</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetOficinasRole(selectedCine.cineId)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Asignar Rol Oficinas</span>
                    </button>
                  </div>
                )}
              </div>

              {formError && (
                <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600">
                  {formError}
                </p>
              )}
              {formSuccess && (
                <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700">
                  {formSuccess}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setView("list");
                    setSelectedCine(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    {formLoading
                      ? "Guardando..."
                      : view === "create"
                      ? "Crear Complejo"
                      : "Guardar Cambios"}
                  </span>
                </button>
              </div>
            </form>
          )}
        </main>
      </div>

      {/* Modal de IPs Autorizadas */}
      {ipsModalVisible && selectedCine && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onClick={() => setIpsModalVisible(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-stripe-lg dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  IPs Autorizadas — {selectedCine.nombre}
                </h3>
                <p className="text-xs text-slate-500">
                  Equipos habilitados para operar en este complejo
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNewIpModalVisible(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Agregar IP</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIpsModalVisible(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {ipsLoading ? (
                <p className="py-8 text-center text-xs text-slate-500">Cargando IPs…</p>
              ) : ips.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  No hay direcciones IP autorizadas para este complejo.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {ips.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">
                            {item.ip}
                          </span>
                          <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {item.type === "mobile" ? "Móvil" : "Fija"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{item.label}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveIp(item.ip)}
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Eliminar IP"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar Nueva IP */}
      {newIpModalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          onClick={() => setNewIpModalVisible(false)}
        >
          <form
            onSubmit={handleAddIp}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-stripe-lg dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Autorizar Nueva Dirección IP
            </h3>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Dirección IP
              </label>
              <input
                type="text"
                value={newIpAddress}
                onChange={(e) => setNewIpAddress(e.target.value)}
                placeholder="Ej: 190.210.45.12"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Etiqueta / Equipo
              </label>
              <input
                type="text"
                value={newIpLabel}
                onChange={(e) => setNewIpLabel(e.target.value)}
                placeholder="Ej: PC Cabina"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewIpModalVisible(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white"
              >
                Guardar IP
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Cambiar Contraseña */}
      {changePasswordModalVisible && selectedCine && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          onClick={() => setChangePasswordModalVisible(false)}
        >
          <form
            onSubmit={handleChangePassword}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-stripe-lg dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Cambiar Contraseña — {selectedCine.nombre}
            </h3>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Nueva Contraseña (Mín. 8 caracteres)
              </label>
              <input
                type="password"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            {passwordChangeError && (
              <p className="text-xs font-semibold text-rose-600">{passwordChangeError}</p>
            )}
            {passwordChangeSuccess && (
              <p className="text-xs font-semibold text-emerald-600">
                {passwordChangeSuccess}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setChangePasswordModalVisible(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={passwordChangeLoading}
                className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white"
              >
                {passwordChangeLoading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
