/**
 * Re-invoke the same pnpm that started this script.
 * Hostinger's build shell often has no `pnpm` on PATH, but sets npm_execpath.
 */
const { spawnSync } = require("child_process");

const args = process.argv.slice(2);
const execPath = process.env.npm_execpath;

let status;
if (execPath && execPath.includes("pnpm")) {
  status = spawnSync(process.execPath, [execPath, ...args], {
    stdio: "inherit",
    env: process.env,
  }).status;
} else {
  status = spawnSync("pnpm", args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  }).status;
}

process.exit(status ?? 1);
