// vite.config.js

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",  // Asegura que las rutas sean relativas
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ["path", "url", "fs"],  // Excluye módulos de Node.js que no deberían ser procesados por Vite
  },
  define: {
    "process.env": {},  // Define env vacío para evitar problemas con variables de entorno en el frontend
  },
});
