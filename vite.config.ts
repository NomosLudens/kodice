import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";

export default defineConfig(({ command }) => ({
  publicDir: command === "build" ? "public" : false,
  plugins: [
    command === "serve"
      ? {
          name: "dev-public-serve",
          configureServer(server) {
            server.middlewares.use((req, res, next) => {
              const urlPath = req.url ? req.url.split("?")[0] : "";
              if (urlPath && urlPath !== "/" && urlPath !== "/index.html") {
                const filePath = path.resolve("public", "." + urlPath);
                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                  const ext = path.extname(filePath);
                  const types: Record<string, string> = {
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".webmanifest": "application/manifest+json",
                    ".js": "text/javascript",
                    ".css": "text/css",
                    ".svg": "image/svg+xml",
                    ".ico": "image/x-icon",
                  };
                  res.setHeader("Content-Type", types[ext] || "application/octet-stream");
                  return fs.createReadStream(filePath).pipe(res);
                }
              }
              next();
            });
          },
        }
      : null,
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    manifest: true,
  },
}));
