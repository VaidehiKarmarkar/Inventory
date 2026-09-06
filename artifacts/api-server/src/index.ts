import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "./lib/startup-seed";

import fs from "node:fs";
import path from "node:path";

if (!process.env["PORT"]) {
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../.env"),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        process.loadEnvFile(envPath);
        if (process.env["PORT"]) break;
      } catch (e) {}
    }
  }
}

const rawPort = process.env["PORT"] || "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Start HTTP listener immediately so health checks pass on Replit / Hostinger / Cloud deployments
app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, `Server listening on 0.0.0.0:${port}`);

  // Run startup database seed in background without blocking server bind
  seedIfEmpty()
    .then(() => {
      logger.info("Startup seed completed successfully");
    })
    .catch((err) => {
      logger.error({ err }, "Startup seed failed — verify DATABASE_URL is set in environment secrets");
    });
});
