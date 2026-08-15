import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
import { remoteFederationConfig } from "@omniremit/federation-config";

// Real registered remote app — see the root README's "Contract for future remote apps" and
// docs/ADDING-A-REMOTE-APP.md. The expose path and the shared-singleton set both come from
// @omniremit/federation-config so this remote cannot drift from what the host expects.
//
// The container name below ("employee_mf") is a GLOBAL identifier in the browser and must be unique
// across every remote app. ModuleRegistry reads it out of the built manifest at registration time
// and rejects a second app trying to claim the same one.
export default defineConfig(({ mode }) => {
  // The port is env-driven with a default, rather than hardcoded. It used to be written in four
  // separate places (server, preview, and twice in package.json's scripts) with strictPort: true —
  // so standing up a SECOND remote app meant hunting down every copy, and forgetting one produced a
  // confusing "port already in use" crash. A new remote now just sets VITE_PREVIEW_PORT in its own
  // .env. Whatever value is chosen must match the ManifestUrl registered in Module Registry.
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PREVIEW_PORT ?? 5001);

  return {
    plugins: [
      react(),

      federation(remoteFederationConfig("employee_mf", "./src/App.jsx")),
    ],

    build: {
      target: "esnext",
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          assetFileNames: "assets/[name].[ext]",
        },
      },
    },

    server: {
      host: "0.0.0.0",
      port,
      // strictPort on both server and preview: a silent rebind would serve the manifest on a port
      // the registry knows nothing about, which surfaces to the user as an unexplained
      // "failed to get manifest" in the host rather than an obvious startup error here.
      strictPort: true,
      cors: true,
    },

    preview: {
      host: "0.0.0.0",
      port,
      strictPort: true,
      cors: true,
    },
  };
});
