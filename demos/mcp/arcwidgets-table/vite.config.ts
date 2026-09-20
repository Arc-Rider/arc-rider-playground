import react from "@vitejs/plugin-react";
import { createLogger, defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error("INPUT environment variable is not set");
}

const isDevelopment = process.env.NODE_ENV === "development";

const prefixedLogger = createLogger();
for (const level of ["info", "warn", "error"] as const) {
  const fn = prefixedLogger[level];
  prefixedLogger[level] = (msg, opts) => fn(msg.replace(/^/gm, "[vite] "), opts);
}

export default defineConfig({
  customLogger: prefixedLogger,
  plugins: [react(), viteSingleFile()],
  resolve: { dedupe: ["react", "react-dom"] },
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {
      input: INPUT,
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
