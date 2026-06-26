import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

const JWT_SECRET = process.env["JWT_SECRET"];
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required but not set");
}
const JWT_SECRET_VALUE: string = JWT_SECRET;

const JWT_ALGORITHM = "HS256" as const;
const JWT_EXPIRY = "7d" as const;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hashed: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export function createAccessToken(
  userId: number,
  username: string,
  role: string,
): string {
  return jwt.sign({ username, role }, JWT_SECRET_VALUE, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRY,
    subject: String(userId),
  });
}

function decodeToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, JWT_SECRET_VALUE, {
    algorithms: [JWT_ALGORITHM],
  }) as jwt.JwtPayload;
}

export interface AuthedRequest extends Request {
  user?: User;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0]!)) {
    return parts[1]!;
  }
  return null;
}

async function loadUser(token: string): Promise<User | null> {
  let payload: jwt.JwtPayload;
  try {
    payload = decodeToken(token);
  } catch {
    return null;
  }
  const sub = payload.sub;
  if (!sub) return null;
  const userId = Number(sub);
  if (Number.isNaN(userId)) return null;
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ detail: "Authentication required" });
    return;
  }
  const user = await loadUser(token);
  if (!user) {
    res.status(401).json({ detail: "Invalid or expired token" });
    return;
  }
  req.user = user;
  next();
}
