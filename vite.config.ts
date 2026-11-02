import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'EXPO_PUBLIC_']);

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
    define: {
      'process.env': JSON.stringify(env),
      global: 'window',
    },
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
