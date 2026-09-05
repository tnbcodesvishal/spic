import { Router, type Request, type Response } from "express";
import { getDb, REGISTRATIONS, TEAM_REGISTRATIONS } from "../db";
import { sendTicketEmail, sendTeamTicketEmail } from "../services/email";

const router = Router();
const ADMIN_PIN = process.env.ADMIN_PIN || "spic@2026";

function checkAdminAuth(req: Request): boolean {
  const pin = req.headers["x-admin-pin"] || req.query.adminPin || req.body?.adminPin;
  return pin === ADMIN_PIN;
}

// ─── POST /api/admin/auth ─────────────────────────────────────────────
router.post("/auth", (req: Request, res: Response) => {
  const { pin } = req.body;
  if (pin === ADMIN_PIN) {
    res.json({ success: true, message: "Authentication successful." });
  } else {
    res.status(401).json({ success: false, error: "Invalid Admin PIN." });
  }
});

// ─── GET /api/admin/stats ─────────────────────────────────────────────
router.get("/stats", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const db = getDb();

    // Fetch individual registrations
    const indSnap = await db.collection(REGISTRATIONS).get();
    const indDocs = indSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    // Fetch team registrations
    const teamSnap = await db.collection(TEAM_REGISTRATIONS).get();
    const teamDocs = teamSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    // Fetch events
    const eventsSnap = await db.collection("events").get();
    const events = eventsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    let totalCheckedIn = 0;
    let totalParticipants = indDocs.length;

    indDocs.forEach((r: any) => {
      if (r.checkedIn) totalCheckedIn++;
    });

    teamDocs.forEach((t: any) => {
      const membersCount = t.members?.length || 0;
      totalParticipants += membersCount;
      (t.members || []).forEach((m: any) => {
        if (m.checkedIn) totalCheckedIn++;
      });
    });

    // Breakdown per event
    const eventStats: Record<string, { totalRegistrations: number; totalParticipants: number; checkedIn: number }> = {};

    events.forEach((ev: any) => {
      eventStats[ev.id] = { totalRegistrations: 0, totalParticipants: 0, checkedIn: 0 };
    });

    indDocs.forEach((r: any) => {
      const eid = r.eventId;
      if (!eventStats[eid]) eventStats[eid] = { totalRegistrations: 0, totalParticipants: 0, checkedIn: 0 };
      eventStats[eid].totalRegistrations += 1;
      eventStats[eid].totalParticipants += 1;
      if (r.checkedIn) eventStats[eid].checkedIn += 1;
    });

    teamDocs.forEach((t: any) => {
      const eid = t.eventId;
      if (!eventStats[eid]) eventStats[eid] = { totalRegistrations: 0, totalParticipants: 0, checkedIn: 0 };
      eventStats[eid].totalRegistrations += 1;
      const count = t.members?.length || 0;
      eventStats[eid].totalParticipants += count;
      (t.members || []).forEach((m: any) => {
        if (m.checkedIn) eventStats[eid].checkedIn += 1;
      });
    });

    res.json({
      totalEvents: events.length,
      totalRegistrations: indDocs.length + teamDocs.length,
      totalParticipants,
      totalCheckedIn,
      eventStats,
    });
  } catch (err: any) {
    console.error("[admin] Error getting stats:", err);
    res.status(500).json({ error: "Failed to get stats." });
  }
});

// ─── GET /api/admin/registrations ─────────────────────────────────────
router.get("/registrations", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { eventId } = req.query;

  try {
    const db = getDb();

    // Individual registrations
    let indQuery = db.collection(REGISTRATIONS);
    if (eventId) {
      indQuery = indQuery.where("eventId", "==", eventId);
    }
    const indSnap = await indQuery.get();
    const individuals = indSnap.docs.map((d: any) => ({
      id: d.id,
      type: "individual",
      ...d.data(),
    }));

    // Team registrations
    let teamQuery = db.collection(TEAM_REGISTRATIONS);
    if (eventId) {
      teamQuery = teamQuery.where("eventId", "==", eventId);
    }
    const teamSnap = await teamQuery.get();
    const teams = teamSnap.docs.map((d: any) => ({
      id: d.id,
      type: "team",
      ...d.data(),
    }));

    // Merge and sort by createdAt desc (newest first)
    const combined = [...individuals, ...teams].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const timeA = isNaN(dateA) ? 0 : dateA;
      const timeB = isNaN(dateB) ? 0 : dateB;
      return timeB - timeA;
    });

    res.json(combined);
  } catch (err: any) {
    console.error("[admin] Error getting registrations:", err);
    res.status(500).json({ error: "Failed to fetch registrations." });
  }
});

// ─── POST /api/admin/resend-ticket ────────────────────────────────────
router.post("/resend-ticket", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { registrationId, isTeam } = req.body;
  if (!registrationId) {
    res.status(400).json({ error: "registrationId is required" });
    return;
  }

  try {
    const db = getDb();
    const collectionName = isTeam ? TEAM_REGISTRATIONS : REGISTRATIONS;
    const doc = await db.collection(collectionName).doc(registrationId).get();

    if (!doc.exists) {
      res.status(404).json({ error: "Registration not found" });
      return;
    }

    const row = doc.data();

    if (isTeam) {
      const emailRes = await sendTeamTicketEmail({
        teamName: row.teamName,
        members: row.members,
        eventName: row.eventName,
        eventDate: row.eventDate,
        eventVenue: row.eventVenue,
        registrationId,
        eventId: row.eventId,
      });
      res.json({ success: emailRes.success, message: emailRes.success ? "Team tickets sent" : emailRes.error });
    } else {
      const emailRes = await sendTicketEmail({
        to: row.participantEmail,
        participantName: row.participantName,
        rollNumber: row.rollNumber,
        branch: row.branch,
        year: row.year,
        phone: row.phone,
        eventName: row.eventName,
        eventDate: row.eventDate,
        eventTime: row.eventTime || "10:00 AM onwards",
        eventVenue: row.eventVenue,
        registrationId,
        eventId: row.eventId,
        verificationToken: row.verificationToken,
      });
      res.json({ success: emailRes.success, message: emailRes.success ? "Ticket email sent" : emailRes.error });
    }
  } catch (err: any) {
    console.error("[admin] Error resending ticket:", err);
    res.status(500).json({ error: "Failed to resend ticket." });
  }
});

export default router;
