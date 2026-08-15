import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

// Real registered remote app — see the root README's "Contract for future remote apps". Exposes
// ./App (the contract every remote must satisfy; the host always calls loadRemote(`${key}/App`)),
// shares react/react-dom as singletons matching the host's versions exactly.
export default defineConfig({
  plugins: [
    react(),

    federation({
      name: "employee_mf",
      filename: "remoteEntry.js",
      manifest: true,
      dts: false,

      exposes: {
        "./App": "./src/App.jsx",
      },

      shared: {
        react: {
          singleton: true,
          requiredVersion: "^19.2.0",
        },
        "react-dom": {
          singleton: true,
          requiredVersion: "^19.2.0",
        },
      },
    }),
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
    port: 5001,
    cors: true,
  },

  preview: {
    host: "0.0.0.0",
    port: 5001,
    strictPort: true,
    cors: true,
  },
});
