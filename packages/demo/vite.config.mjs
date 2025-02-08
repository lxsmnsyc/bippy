import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    minify: false,
  },
  plugins: [react()],
  mode: "development",
  resolve: {
    alias: {
      bippy: path.resolve(__dirname, "../bippy"),
    },
  },
});
