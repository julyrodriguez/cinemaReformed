import React, { useEffect, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { applyTheme, getSavedTheme } from '@/lib/theme';

import Home from './app/index';
import Login from './app/login';
import AdminCinesScreen from './app/admin-cines';
import OficinasCalendarioScreen from './app/oficinas-calendario';
import OficinasEventosScreen from './app/oficinas-eventos';
import CalendarioScreen from './app/calendario';
import EventosScreen from './app/eventos';
import CreditosScreen from './app/creditos';
import RmaScreen from './app/rma';
import DcpScreen from './app/dcp';
import MantenimientosScreen from './app/mantenimientos';
import NotFoundScreen from './app/+not-found';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const currentTheme = getSavedTheme();
    applyTheme(currentTheme);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const isLoginPage = location.pathname === '/login';
      if (!user && !isLoginPage) {
        navigate('/login', { replace: true });
      } else if (user && isLoginPage) {
        navigate('/', { replace: true });
      }
      if (initializing) {
        setInitializing(false);
      }
    });

    return () => unsubscribe();
  }, [location.pathname, initializing, navigate]);

  if (initializing) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-rose-600 dark:border-zinc-800 dark:border-t-rose-500" />
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Cargando Cinemark Workspace…
          </span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin-cines" element={<AdminCinesScreen />} />
      <Route path="/oficinas-calendario" element={<OficinasCalendarioScreen />} />
      <Route path="/oficinas-eventos" element={<OficinasEventosScreen />} />
      <Route path="/calendario" element={<CalendarioScreen />} />
      <Route path="/eventos" element={<EventosScreen />} />
      <Route path="/creditos" element={<CreditosScreen />} />
      <Route path="/rma" element={<RmaScreen />} />
      <Route path="/dcp" element={<DcpScreen />} />
      <Route path="/mantenimientos" element={<MantenimientosScreen />} />
      <Route path="*" element={<NotFoundScreen />} />
    </Routes>
  );
}
