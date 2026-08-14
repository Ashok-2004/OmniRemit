import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";



export default defineConfig({

  base: "/mf/employee_mf/",
  optimizeDeps: {
    exclude: ['@myorg/shared']
  },


  plugins: [

    react(),

    federation({

      name: "employee_mf",
      filename: "remoteEntry.js",
      manifest: true,
      dts: false,

      exposes: {
        "./EmployeeApp": "./src/App.jsx",
      },

      shared: {
        react: {
          singleton: true,
          requiredVersion: false,
        },

        "react-dom": {
          singleton: true,
          requiredVersion: false,
        },


        "react-router-dom": {
          singleton: true,
          requiredVersion: false,
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
    watch: {
      ignored: ['!**/node_modules/@myorg/shared/**']
    }
  },

 preview: {
  host: "0.0.0.0",
  port: 5001,
  strictPort: true,
  cors: true,
  },
  
});