import { Router, type IRouter, type Response } from "express";
import { desc, ne } from "drizzle-orm";
import { db, usersTable, incidentsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { dashboardIncidentDict } from "../lib/serialize";
import {
  isHeatBanActive,
  simulateTemperatureC,
  temperatureRiskLevel,
} from "../lib/heat";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (_req: AuthedRequest, res: Response) => {
  const incidents = await db
    .select()
    .from(incidentsTable)
    .where(ne(incidentsTable.status, "resolved"))
    .orderBy(desc(incidentsTable.createdAt))
    .limit(50);

  let critical = 0;
  let high = 0;
  let medium = 0;
  for (const inc of incidents) {
    const sev = inc.severity ?? 0;
    if (sev >= 5) critical += 1;
    else if (sev === 4) high += 1;
    else if (sev === 2 || sev === 3) medium += 1;
  }

  const topWorkers = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.hazardScore))
    .limit(5);

  const leaderboard = topWorkers.map((w, i) => ({
    username: w.username,
    score: w.hazardScore ?? 0,
    rank: i + 1,
  }));

  const tempC = simulateTemperatureC();

  res.json({
    active_incidents: incidents.map(dashboardIncidentDict),
    summary: {
      total_active: incidents.length,
      critical_count: critical,
      high_count: high,
      medium_count: medium,
    },
    heat_compliance: {
      ban_active: isHeatBanActive(),
      current_temp_c: tempC,
      risk_level: temperatureRiskLevel(tempC),
    },
    leaderboard,
    generated_at: new Date().toISOString(),
  });
});

export default router;
