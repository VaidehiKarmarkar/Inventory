import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router = Router();

// In-memory brute-force rate limiter for login
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const loginAttempts = new Map<string, RateLimitRecord>();
const MAX_LOGIN_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

router.post("/auth/login", async (req, res): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  const isLocalhost = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "unknown";
  const now = Date.now();
  const record = loginAttempts.get(ip);

  // In production, limit to 5 failed attempts. On localhost development, allow up to 20 attempts.
  const maxAttempts = isLocalhost && process.env.NODE_ENV !== "production" ? 20 : MAX_LOGIN_ATTEMPTS;

  if (record) {
    if (now > record.resetTime) {
      loginAttempts.delete(ip);
    } else if (record.count >= maxAttempts) {
      const remainingMinutes = Math.ceil((record.resetTime - now) / 60000);
      res.status(429).json({ error: `Too many failed login attempts. Please try again in ${remainingMinutes} minute(s).` });
      return;
    }
  }

  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;

  // Search by either username or email
  const [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.username, username), eq(usersTable.email, username)));

  const recordFailedAttempt = () => {
    const current = loginAttempts.get(ip);
    if (current && now <= current.resetTime) {
      current.count += 1;
    } else {
      loginAttempts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    }
  };

  if (!user || !user.isActive) {
    recordFailedAttempt();
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    recordFailedAttempt();
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Clear rate limit record on successful login
  loginAttempts.delete(ip);

  req.session.userId = user.id;

  res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId));

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  });
});

router.post("/auth/change-password", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || typeof currentPassword !== "string") {
    res.status(400).json({ error: "Current password is required" });
    return;
  }

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 4) {
    res.status(400).json({ error: "New password must be at least 4 characters long" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId));

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Password changed successfully" });
});

export default router;
