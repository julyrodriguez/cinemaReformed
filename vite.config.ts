import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), ['VITE_', 'EXPO_PUBLIC_', '']);
  const env: Record<string, string> = { ...loadedEnv };

  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string') {
      env[k] = v;
    }
  }

  // Cross-map variables so they work with or without EXPO_PUBLIC_ prefix
  // (Permite en Vercel guardar API_TOKEN como variable "Sensitive / Secret" sin el prefijo EXPO_PUBLIC_)
  const token = env['API_TOKEN'] || env['EXPO_PUBLIC_API_TOKEN'] || '';
  if (token) {
    env['API_TOKEN'] = token;
    env['EXPO_PUBLIC_API_TOKEN'] = token;
  }

  const apiUrl = env['API_URL'] || env['EXPO_PUBLIC_API_URL'] || '';
  if (apiUrl) {
    env['API_URL'] = apiUrl;
    env['EXPO_PUBLIC_API_URL'] = apiUrl;
  }

  const backendUrl = env['BACKEND_URL'] || env['EXPO_PUBLIC_BACKEND_URL'] || '';
  if (backendUrl) {
    env['BACKEND_URL'] = backendUrl;
    env['EXPO_PUBLIC_BACKEND_URL'] = backendUrl;
  }

  const firebaseKeys = [
    'API_KEY',
    'AUTH_DOMAIN',
    'PROJECT_ID',
    'STORAGE_BUCKET',
    'MESSAGING_SENDER_ID',
    'APP_ID',
    'MEASUREMENT_ID',
  ];
  for (const fbKey of firebaseKeys) {
    const rawKey = `FIREBASE_${fbKey}`;
    const expoKey = `EXPO_PUBLIC_FIREBASE_${fbKey}`;
    const val = env[rawKey] || env[expoKey] || '';
    if (val) {
      env[rawKey] = val;
      env[expoKey] = val;
    }
  }

  const defineMap: Record<string, string> = {
    'process.env': JSON.stringify(env),
    global: 'window',
  };
  for (const [k, v] of Object.entries(env)) {
    defineMap[`process.env.${k}`] = JSON.stringify(v);
  }

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'EXPO_PUBLIC_', 'API_', 'BACKEND_', 'FIREBASE_'],
    define: defineMap,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'react-native': path.resolve(__dirname, './src/shims/react-native.tsx'),
        '@expo/vector-icons': path.resolve(__dirname, './src/shims/expo-vector-icons.tsx'),
        '@react-native-async-storage/async-storage': path.resolve(__dirname, './src/shims/async-storage.ts'),
        '@react-native-community/datetimepicker': path.resolve(__dirname, './src/shims/datetimepicker.tsx'),
        'expo-document-picker': path.resolve(__dirname, './src/shims/expo-document-picker.ts'),
        'expo-print': path.resolve(__dirname, './src/shims/expo-print.ts'),
        'expo-sharing': path.resolve(__dirname, './src/shims/expo-sharing.ts'),
        'expo-file-system/legacy': path.resolve(__dirname, './src/shims/expo-file-system.ts'),
        'expo-file-system': path.resolve(__dirname, './src/shims/expo-file-system.ts'),
        'expo-router/head': path.resolve(__dirname, './src/shims/expo-router-head.tsx'),
        'expo-router': path.resolve(__dirname, './src/shims/expo-router.tsx'),
        'react-native-calendars': path.resolve(__dirname, './src/shims/react-native-calendars.tsx'),
        '@vercel/analytics/next': path.resolve(__dirname, './src/shims/vercel-analytics.tsx'),
      },
      extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 3000,
    },
  };
});
