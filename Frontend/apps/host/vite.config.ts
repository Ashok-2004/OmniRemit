import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { federation } from '@module-federation/vite'

// This app is a Module Federation 2.0 *host* with zero build-time remotes. Every remote app is
// registered at runtime (see src/shared/federation/remoteLoader.ts) from a manifest URL fetched
// from the Module Registry API — nothing about which remotes exist is known at build time.
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'omniremit_host',
      shared: {
        react: { singleton: true, requiredVersion: '^19.2.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.2.0' },
      },
    }),
  ],
  css: {
    modules: {
      // Namespaced so hashed class names never collide with a remote app's own CSS Modules output
      // even if both bundles land in the same DOM — see shared/styles/README for the full rule.
      generateScopedName: 'omni-host-[name]__[local]__[hash:base64:5]',
    },
  },
  server: {
    port: 5173,
    // Fail loudly if 5173 is taken instead of silently rebinding to another port — a silent
    // fallback breaks CORS (AuthService/ModuleRegistry only allow http://localhost:5173) in a way
    // that's confusing to diagnose from the browser alone.
    strictPort: true,
  },
  build: {
    target: 'esnext',
  },
})
