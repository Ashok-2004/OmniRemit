import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { remoteFederationConfig } from '@omniremit/federation-config';

// Customer 360 Remote Micro-Frontend
// Container Name: customer360_mf (must be unique across all remotes)
// Exposes: ./App pointing to ./src/App.tsx
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_PREVIEW_PORT ?? 5003);

  return {
    plugins: [
      react(),
      federation(remoteFederationConfig('customer360_mf', './src/App.tsx', ['zustand'])),
    ],

    build: {
      target: 'esnext',
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },

    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      cors: true,
    },

    preview: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      cors: true,
    },
  };
});
