import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import {
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signAuthToken,
  type AuthUser,
} from "../lib/auth";

const router: IRouter = Router();

function publicUser(user: typeof usersTable.$inferSelect): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
  };
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const data = publicUser(user);
  setAuthCookie(res, signAuthToken(data));
  res.json({ user: data });
});

router.post("/auth/logout", (_req, res): void => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, (_req, res): void => {
  res.json({ user: res.locals.user as AuthUser });
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const confirmPassword = typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";
  const currentUser = res.locals.user as AuthUser;

  if (!currentPassword || !newPassword || !confirmPassword) {
    res.status(400).json({ error: "All password fields are required" });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: "New password and confirmation do not match" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, currentUser.id));

  if (!user?.active || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, currentUser.id));
  res.json({ ok: true });
});

export default router;
