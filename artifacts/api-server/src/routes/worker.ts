import { Router, type IRouter, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

router.patch("/worker/location", requireAuth, async (req: AuthedRequest, res: Response) => {
  const lat = Number(req.body?.lat);
  const lon = Number(req.body?.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    res.status(400).json({ detail: "Valid lat and lon are required" });
    return;
  }
  await db
    .update(usersTable)
    .set({ lastKnownLat: lat, lastKnownLon: lon, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user!.id));
  res.json({ ok: true, lat, lon });
});

router.post("/worker/push-token", requireAuth, async (req: AuthedRequest, res: Response) => {
  // Mobile sends `push_token`; accept `token` defensively too.
  const pushToken: string | undefined =
    req.body?.push_token ?? req.body?.token;
  if (!pushToken) {
    res.status(400).json({ detail: "push_token is required" });
    return;
  }
  await db
    .update(usersTable)
    .set({ pushToken, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user!.id));
  res.json({ ok: true });
});

export default router;
