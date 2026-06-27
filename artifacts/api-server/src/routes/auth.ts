import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  createAccessToken,
  hashPassword,
  verifyPassword,
  requireAuth,
  type AuthedRequest,
} from "../lib/auth";
import { userDict } from "../lib/serialize";

const router: IRouter = Router();

router.post("/auth/register", async (req: Request, res: Response) => {
  const { username, email, password, full_name } = req.body ?? {};
  if (!username || !email || !password) {
    res.status(400).json({ detail: "username, email and password are required" });
    return;
  }

  const existingUsername = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  if (existingUsername[0]) {
    res.status(400).json({ detail: "Username already taken" });
    return;
  }
  const existingEmail = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existingEmail[0]) {
    res.status(400).json({ detail: "Email already registered" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const inserted = await db
    .insert(usersTable)
    .values({
      username,
      email,
      passwordHash,
      fullName: full_name ?? null,
      role: "user",
    })
    .returning();
  const user = inserted[0]!;

  const token = createAccessToken(user.id, user.username, user.role);
  res
    .status(201)
    .json({ access_token: token, token_type: "bearer", user: userDict(user) });
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ detail: "username and password are required" });
    return;
  }

  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ detail: "Invalid credentials" });
    return;
  }

  const token = createAccessToken(user.id, user.username, user.role);
  res.json({ access_token: token, token_type: "bearer", user: userDict(user) });
});

router.get("/auth/me", requireAuth, (req: AuthedRequest, res: Response) => {
  res.json(userDict(req.user!));
});

export default router;
