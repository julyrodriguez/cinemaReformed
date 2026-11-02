import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Film,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";

import { APP_AUTH_DOMAIN, auth, firebaseConfig } from "../lib/firebaseConfig";
import { applyTheme, getSavedTheme, saveTheme } from "../lib/theme";
import { sanitizeCineId } from "@/shared/utils";
import SEOHead from "@/components/SEOHead";

function extractCleanCineId(rawInput: string): string {
  const base = String(rawInput ?? "").trim().split("@")[0] ?? "";
  return sanitizeCineId(base);
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  const cineIdPreview = useMemo(() => extractCleanCineId(username), [username]);

  useEffect(() => {
    const saved = getSavedTheme();
    setThemeMode(saved);
    applyTheme(saved);

    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthed(!!u);
      setChecked(true);
    });

    return () => unsub();
  }, []);

  const toggleTheme = () => {
    const next = themeMode === "light" ? "dark" : "light";
    setThemeMode(next);
    applyTheme(next);
    saveTheme(next);
  };

  const handleSignIn = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanUser = extractCleanCineId(username);
    const email = `${cleanUser}@${APP_AUTH_DOMAIN}`;

    setError(null);

    if (
      !firebaseConfig.apiKey ||
      firebaseConfig.apiKey === "AIzaSyDummyApiKeyForBuild1234567890123"
    ) {
      setError(
        "Faltan aplicar las variables de entorno en el build (EXPO_PUBLIC_FIREBASE_API_KEY). En Vercel, tocá 'Redeploy' en Deployments para que tome las variables recién cargadas."
      );
      return;
    }

    if (!cleanUser || !pass.trim()) {
      setError("Completá el usuario del complejo y la contraseña.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, pass);
      const displayName = username.trim().split("@")[0] || cleanUser;
      await AsyncStorage.multiSet([
        ["displayName", displayName],
        ["cineId", cleanUser],
      ]);
    } catch (e: any) {
      let msg = "Error al iniciar sesión.";
      switch (e?.code) {
        case "auth/invalid-email":
          msg = "Identificador de usuario inválido.";
          break;
        case "auth/user-not-found":
          msg = "Ese complejo o usuario no está registrado.";
          break;
        case "auth/wrong-password":
        case "auth/invalid-credential":
          msg = `Usuario (${email}) o contraseña incorrectos.`;
          break;
        case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
        case "auth/invalid-api-key":
          msg = "API Key de Firebase inválida o no aplicada en el build de Vercel (hacé Redeploy).";
          break;
        case "auth/too-many-requests":
          msg = "Demasiados intentos fallidos. Aguardá unos minutos.";
          break;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!checked) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-rose-600 dark:border-zinc-800 dark:border-t-rose-500" />
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Verificando sesión…
          </span>
        </div>
      </div>
    );
  }

  if (authed) return <Redirect href="/" />;

  return (
    <>
      <SEOHead
        title="Iniciar Sesión | Cinemark Workspace"
        description="Portal corporativo de gestión de proyección, programación semanal, control de salas y mantenimiento técnico."
        pathname="/login"
      />
      <div className="relative flex min-h-screen w-full flex-col justify-between bg-slate-50 text-slate-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
        {/* Subtle Architectural Grid Background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.45) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Top Bar */}
        <header className="relative z-10 flex w-full items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white shadow-sm">
              <Film className="h-4 w-4 stroke-[2.2]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                Cinemark Workspace
              </span>
              <span className="hidden rounded bg-slate-200/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 sm:inline-block">
                v2.0
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {themeMode === "dark" ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span>Modo claro</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-slate-600" />
                <span>Modo oscuro</span>
              </>
            )}
          </button>
        </header>

        {/* Main Centered Login Card */}
        <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-[420px]">
            {/* Card Header */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <ShieldCheck className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                <span>Plataforma Operativa de Complejos</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
                Ingresar al panel
              </h1>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                Accedé con las credenciales asignadas a tu complejo o perfil de oficinas.
              </p>
            </div>

            {/* Minimalist Stripe-Style Form Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-stripe-md sm:p-7 dark:border-zinc-800 dark:bg-zinc-900">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="login-user"
                      className="text-xs font-semibold text-slate-700 dark:text-zinc-300"
                    >
                      Complejo / Usuario
                    </label>
                    {cineIdPreview && (
                      <span className="font-mono text-[10.5px] font-medium text-slate-400 dark:text-zinc-500">
                        {cineIdPreview}@{APP_AUTH_DOMAIN}
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <Building2 className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                    <input
                      id="login-user"
                      type="text"
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="username"
                      placeholder="Ej: abasto, palermo, oficinas"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (error) setError(null);
                      }}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-950"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-pass"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    Contraseña
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                    <input
                      id="login-pass"
                      type={secure ? "password" : "text"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={pass}
                      onChange={(e) => {
                        setPass(e.target.value);
                        if (error) setError(null);
                      }}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-950"
                    />
                    <button
                      type="button"
                      onClick={() => setSecure((s) => !s)}
                      className="absolute right-2.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                      tabIndex={-1}
                      aria-label={secure ? "Mostrar contraseña" : "Ocultar contraseña"}
                    >
                      {secure ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 disabled:opacity-60"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <>
                      <span>Continuar al panel</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 py-5 text-center text-[11px] font-medium text-slate-400 dark:text-zinc-600">
          Cinemark Hoyts • Gestión de Proyección, Programación y Salas
        </footer>
      </div>
    </>
  );
}
