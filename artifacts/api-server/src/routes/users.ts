import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { requireAdmin, type AuthUser } from "../lib/auth";

const router: IRouter = Router();

type PublicUserRow = {
  id: number;
  email: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
};

const validRoles = new Set(["admin", "user"]);

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanRole(value: unknown) {
  return typeof value === "string" && validRoles.has(value) ? value : "";
}

function publicUser(row: PublicUserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
  };
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "23505";
}

async function activeAdminCount(excludingUserId?: number) {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM users
     WHERE role = 'admin'
       AND active = TRUE
       AND ($1::int IS NULL OR id <> $1)`,
    [excludingUserId ?? null],
  );

  return Number(result.rows[0]?.count ?? 0);
}

async function wouldRemoveLastActiveAdmin(userId: number, nextRole?: string, nextActive?: boolean) {
  const result = await pool.query<{ role: string; active: boolean }>(
    "SELECT role, active FROM users WHERE id = $1",
    [userId],
  );
  const current = result.rows[0];

  if (!current || current.role !== "admin" || !current.active) {
    return false;
  }

  const remainsAdmin = (nextRole ?? current.role) === "admin";
  const remainsActive = nextActive ?? current.active;

  if (remainsAdmin && remainsActive) {
    return false;
  }

  return (await activeAdminCount(userId)) === 0;
}

router.get("/users", requireAdmin, async (_req, res): Promise<void> => {
  const result = await pool.query<PublicUserRow>(
    "SELECT id, email, name, role, active, created_at FROM users ORDER BY id ASC",
  );
  res.json(result.rows.map(publicUser));
});

router.post("/users", requireAdmin, async (req, res): Promise<void> => {
  const name = cleanName(req.body?.name);
  const email = cleanEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const role = cleanRole(req.body?.role);
  const active = typeof req.body?.active === "boolean" ? req.body.active : true;

  if (!name || !email || !password || !role) {
    res.status(400).json({ error: "Name, email, password, and role are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  if (role === "admin" && !active && (await activeAdminCount()) === 0) {
    res.status(400).json({ error: "At least one active admin account is required" });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query<PublicUserRow>(
      `INSERT INTO users (email, password_hash, name, role, active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, active, created_at`,
      [email, passwordHash, name, role, active],
    );
    res.status(201).json(publicUser(result.rows[0]!));
  } catch (error) {
    const message = isUniqueViolation(error)
      ? "A user with this email already exists"
      : "Could not create user";
    res.status(400).json({ error: message });
  }
});

router.put("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const name = cleanName(req.body?.name);
  const email = cleanEmail(req.body?.email);
  const role = cleanRole(req.body?.role);
  const active = typeof req.body?.active === "boolean" ? req.body.active : undefined;

  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (!name || !email || !role || active === undefined) {
    res.status(400).json({ error: "Name, email, role, and active status are required" });
    return;
  }

  if (await wouldRemoveLastActiveAdmin(id, role, active)) {
    res.status(400).json({ error: "Cannot disable or remove the last active admin account" });
    return;
  }

  try {
    const result = await pool.query<PublicUserRow>(
      `UPDATE users
       SET name = $1, email = $2, role = $3, active = $4
       WHERE id = $5
       RETURNING id, email, name, role, active, created_at`,
      [name, email, role, active, id],
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(publicUser(result.rows[0]));
  } catch (error) {
    const message = isUniqueViolation(error)
      ? "A user with this email already exists"
      : "Could not update user";
    res.status(400).json({ error: message });
  }
});

router.patch("/users/:id/password", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, id]);

  if (result.rowCount === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const currentUser = res.locals.user as AuthUser;
  if (currentUser.id === id) {
    res.json({ ok: true, message: "Password updated. Sign in again with the new password." });
    return;
  }

  res.json({ ok: true });
});

router.patch("/users/:id/disable", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);

  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (await wouldRemoveLastActiveAdmin(id, undefined, false)) {
    res.status(400).json({ error: "Cannot disable the last active admin account" });
    return;
  }

  const result = await pool.query<PublicUserRow>(
    `UPDATE users SET active = FALSE WHERE id = $1
     RETURNING id, email, name, role, active, created_at`,
    [id],
  );

  if (!result.rows[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(publicUser(result.rows[0]));
});

router.patch("/users/:id/enable", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);

  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const result = await pool.query<PublicUserRow>(
    `UPDATE users SET active = TRUE WHERE id = $1
     RETURNING id, email, name, role, active, created_at`,
    [id],
  );

  if (!result.rows[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(publicUser(result.rows[0]));
});

export default router;
