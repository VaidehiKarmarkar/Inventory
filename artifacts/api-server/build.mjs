import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import fs from "node:fs";
import { rm, cp } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Externalize packages that use native modules or can't be bundled.
    external: [
      "*.node",
      "pdfkit",       // Uses native font handling, must stay external
      "pg-native",    // Optional native pg driver
      "bcrypt",       // Native bcrypt (we use bcryptjs which IS bundled)
      "fsevents",     // macOS-only native module
      "sharp",        // Image processing with native deps
      "better-sqlite3", // Native SQLite (not used, but safe to keep)
      "canvas",       // Native canvas (not used, but safe to keep)
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });

  // Copy native libsql node binding into dist/node_modules/@libsql so standalone/packaged execution works out of the box
  const rootDir = path.resolve(artifactDir, "../..");
  const pnpmDir = path.resolve(rootDir, "node_modules/.pnpm");
  if (fs.existsSync(pnpmDir)) {
    const entries = fs.readdirSync(pnpmDir);
    const winLibsql = entries.find(e => e.startsWith("@libsql+win32-x64-msvc"));
    if (winLibsql) {
      const src = path.resolve(pnpmDir, winLibsql, "node_modules/@libsql/win32-x64-msvc");
      const dest = path.resolve(distDir, "node_modules/@libsql/win32-x64-msvc");
      await cp(src, dest, { recursive: true });
    }
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
