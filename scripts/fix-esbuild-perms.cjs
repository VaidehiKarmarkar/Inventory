/**
 * Hostinger/pnpm often hardlinks native bins from the store without +x.
 * Restore execute bits so esbuild/vite can spawn platform binaries.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "node_modules");

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full);
      continue;
    }
    if (ent.name === "esbuild" || ent.name === "esbuild.exe") {
      try {
        fs.chmodSync(full, 0o755);
      } catch {
        // ignore permission errors on individual files
      }
    }
  }
}

if (fs.existsSync(root)) {
  walk(root);
}
