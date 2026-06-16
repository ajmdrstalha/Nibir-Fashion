import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const cookieName = "nibir_fashion_auth";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  active?: boolean;
};

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required.");
  }

  return secret;
}

export function signAuthToken(user: AuthUser) {
  return jwt.sign(user, getJwtSecret(), {
    expiresIn: "7d",
  });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[cookieName];

  if (!token || typeof token !== "string") {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const tokenUser = jwt.verify(token, getJwtSecret()) as AuthUser;
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        active: usersTable.active,
      })
      .from(usersTable)
      .where(eq(usersTable.id, tokenUser.id));

    if (!user?.active) {
      clearAuthCookie(res);
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    res.locals.user = user;
    next();
  } catch {
    clearAuthCookie(res);
    res.status(401).json({ error: "Authentication required" });
  }
}

export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user as AuthUser | undefined;

  if (user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}
