import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import fs from "node:fs";
import path from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "billing-secret-key-offline",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.COOKIE_SECURE === "true",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  }),
);

app.use("/api", router);

// Serve the Vite SPA for desktop and browser
function getPublicDir(): string {
  const candidates = [
    process.env.STATIC_DIR,
    path.resolve(process.cwd(), "artifacts/billing-app/dist/public"),
    path.resolve(__dirname, "../../billing-app/dist/public"),
    path.resolve(__dirname, "../billing-app/dist/public"),
    path.resolve(process.cwd(), "resources/app/artifacts/billing-app/dist/public"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.resolve(process.cwd(), "artifacts/billing-app/dist/public");
}

const publicDir = getPublicDir();

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });
} else {
  logger.warn({ publicDir }, "SPA public directory not found; API-only mode");
}

export default app;
