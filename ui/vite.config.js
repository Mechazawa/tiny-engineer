import { minify } from "html-minifier-terser";
import { defineConfig } from "vite";

const robot = process.env.TINY_ENGINEER_URL || "http://tiny-engineer.local";
const apiPaths = ["/auth", "/health", "/settings", "/anim", "/test", "/setup"];

const minifyHtml = {
  name: "minify-html",
  apply: "build",
  enforce: "post",
  transformIndexHtml: (html) =>
    minify(html, { collapseWhitespace: true, removeComments: true, minifyCSS: true }),
};

export default defineConfig(({ command }) => ({
  // The firmware serves the built files from LittleFS under /ui/.
  base: command === "build" ? "/ui/" : "/",
  plugins: [minifyHtml],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    proxy: Object.fromEntries(apiPaths.map((path) => [path, robot])),
  },
}));
