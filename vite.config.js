import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const staticDirs = [
  "images",
  "falling-letters",
  "speed-run",
  "memory-typing",
  "typing-dash",
  "typing-shooter",
  "road-dash",
];

function copyStandaloneGames() {
  return {
    name: "copy-standalone-games",
    writeBundle() {
      const rootDir = process.cwd();
      const distDir = resolve(rootDir, "docs");

      for (const dir of staticDirs) {
        const sourceDir = resolve(rootDir, dir);
        const targetDir = resolve(distDir, dir);

        if (!existsSync(sourceDir)) continue;

        rmSync(targetDir, { recursive: true, force: true });
        cpSync(sourceDir, targetDir, {
          recursive: true,
          force: true,
        });
      }
    },
  };
}

export default defineConfig({
  base: "/typing-arcade/",
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
  plugins: [react(), copyStandaloneGames()],
});
