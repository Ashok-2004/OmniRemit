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
      // `true`, not the string "0.0.0.0": the string binds the IPv4 wildcard ONLY. ModuleRegistry's
      // background health prober is a .NET HttpClient resolving "localhost", which on this platform
      // sometimes tries ::1 first — with no IPv6 listener that attempt is refused, and if the IPv4
      // fallback doesn't complete inside the prober's 5s timeout the app flaps to "Unreachable" even
      // though it's actually up. `true` listens on both address families, removing the race entirely.
      host: true,
      port,
      // strictPort on both server and preview: a silent rebind would serve the manifest on a port
      // the registry knows nothing about, which surfaces to the user as an unexplained
      // "failed to get manifest" in the host rather than an obvious startup error here.
      strictPort: true,
      cors: true,
    },

    preview: {
      // `true`, not the string "0.0.0.0": the string binds the IPv4 wildcard ONLY. ModuleRegistry's
      // background health prober is a .NET HttpClient resolving "localhost", which on this platform
      // sometimes tries ::1 first — with no IPv6 listener that attempt is refused, and if the IPv4
      // fallback doesn't complete inside the prober's 5s timeout the app flaps to "Unreachable" even
      // though it's actually up. `true` listens on both address families, removing the race entirely.
      host: true,
      port,
      strictPort: true,
      cors: true,
    },
  };
});
