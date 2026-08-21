import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Permite importar archivos de ../shared, que está fuera de client/
    fs: { allow: [".."] },
  },
});
