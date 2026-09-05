import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDb, REGISTRATIONS } from "../db";
import { generateToken } from "../services/token";
import { generateQrDataUrl } from "../services/qr";
import { sendTicketEmail, sendTeamTicketEmail } from "../services/email";
import { appendRegistrationRow, appendTeamRegistrationRow } from "../services/sheets";

const router = Router();

// ─── Register for an event ───────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  const { eventId, eventName, eventDate, eventVenue, name, email, phone, rollNumber, year, branch } =
    req.body;

  if (!eventId || !eventName || !eventDate || !eventVenue || !name || !email || !rollNumber || !year || !branch) {
    res.status(400).json({ error: "Missing required fields." });
    return;
  }

  const emailLower = (email as string).trim().toLowerCase();
  const db = getDb();

  // Duplicate registration check disabled for testing mode
  /*
  const duplicateCheck = await db
    .collection(REGISTRATIONS)
    .where("eventId", "==", eventId)
    .where("participantEmail", "==", emailLower)
    .limit(1)
    .get();

  if (!duplicateCheck.empty) {
    res.status(409).json({ 
      error: "You are already registered for this event with this email. Please use a different email or check your existing ticket." 
    });
    return;
  }
  */

  const id = uuidv4();
  const verificationToken = generateToken();

  let qrDataUrl: string;
  try {
    qrDataUrl = await generateQrDataUrl({
      registrationId: id,
      eventId,
      verificationToken,
    });
  } catch (err: any) {
    console.error("[register] QR generation failed:", err.message);
    res.status(500).json({ error: "Failed to generate ticket." });
    return;
  }

  const registration = {
    eventId,
    eventName,
    eventDate,
    eventVenue,
    participantName: name.trim(),
    participantEmail: emailLower,
    phone: phone?.trim() ?? null,
    rollNumber: rollNumber.trim(),
    year: year.trim(),
    branch: branch.trim(),
    verificationToken,
    qrDataUrl,
    emailStatus: "pending",
    checkedIn: false,
    checkedInAt: null,
    createdAt: new Date().toISOString(),
  };

  await db.collection(REGISTRATIONS).doc(id).set(registration);

  // Return HTTP 201 response immediately for instant UI feedback (~100ms)
  res.status(201).json({
    id,
    ...registration,
    emailStatus: "pending",
  });

  // Background non-blocking operations (Google Sheets append + Ticket Email dispatch)
  (async () => {
    try {
      const sheetRes = await appendRegistrationRow({
        id,
        participantName: registration.participantName,
        participantEmail: registration.participantEmail,
        phone: registration.phone,
        rollNumber: registration.rollNumber,
        year: registration.year,
        branch: registration.branch,
        eventName: registration.eventName,
        eventDate: registration.eventDate,
        eventVenue: registration.eventVenue,
        createdAt: registration.createdAt,
      });
      if (!sheetRes.success) {
        console.warn(`[register] Google Sheets warning for ${id}: ${sheetRes.error}`);
      }
    } catch (err: any) {
      console.error(`[register] Failed to append registration to sheets for ${id}:`, err.message);
    }

    try {
      const emailRes = await sendTicketEmail({
        to: emailLower,
        participantName: name.trim(),
        rollNumber: rollNumber.trim(),
        branch: branch.trim(),
        year: year.trim(),
        phone: phone?.trim(),
        eventName,
        eventDate,
        eventTime: req.body.eventTime || req.body.eventTiming || "10:00 AM onwards",
        eventVenue,
        registrationId: id,
        eventId,
        verificationToken,
      });

      const emailStatus = emailRes.success ? "sent" : "failed";
      await db.collection(REGISTRATIONS).doc(id).set({ emailStatus }, { merge: true });
      if (!emailRes.success) {
        console.error(`[register] Email send failed for ${id}:`, emailRes.error);
      }
    } catch (emailErr: any) {
      console.error(`[register] Email exception for ${id}:`, emailErr.message);
      await db.collection(REGISTRATIONS).doc(id).set({ emailStatus: "failed" }, { merge: true });
    }
  })();
});

// ─── List registrations by email ────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  const { email } = req.query;

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email query parameter is required." });
    return;
  }

  const emailStr = (email as string).trim().toLowerCase();
  const db = getDb();
  const snapshot = await db
    .collection(REGISTRATIONS)
    .where("participantEmail", "==", emailStr)
    .orderBy("createdAt", "desc")
    .get();

  const rows = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      eventId: data.eventId,
      eventName: data.eventName,
      eventDate: data.eventDate,
      eventVenue: data.eventVenue,
      participantName: data.participantName,
      participantEmail: data.participantEmail,
      qrDataUrl: data.qrDataUrl,
      emailStatus: data.emailStatus,
      checkedIn: data.checkedIn,
      createdAt: data.createdAt,
    };
  });

  res.json(rows);
});

// ─── Get single registration ────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  const db = getDb();
  const doc = await db.collection(REGISTRATIONS).doc(req.params.id as string).get();

  if (!doc.exists) {
    res.status(404).json({ error: "Registration not found." });
    return;
  }

  res.json({ id: doc.id, ...doc.data() });
});

// ─── Retry failed email ─────────────────────────────────────────────
router.post("/:id/resend", async (req: Request, res: Response) => {
  const db = getDb();
  const doc = await db.collection(REGISTRATIONS).doc(req.params.id as string).get();

  if (!doc.exists) {
    res.status(404).json({ error: "Registration not found." });
    return;
  }

  const row = doc.data()!;

  const result = await sendTicketEmail({
    to: row.participantEmail,
    participantName: row.participantName,
    rollNumber: row.rollNumber,
    branch: row.branch,
    year: row.year,
    phone: row.phone,
    eventName: row.eventName,
    eventDate: row.eventDate,
    eventTime: row.eventTime || row.eventTiming || "10:00 AM onwards",
    eventVenue: row.eventVenue,
    registrationId: doc.id,
    eventId: row.eventId,
    verificationToken: row.verificationToken,
  });

  const status = result.success ? "sent" : "failed";
  await db.collection(REGISTRATIONS).doc(doc.id).update({ emailStatus: status });

  if (result.success) {
    res.json({ message: "Email resent successfully." });
  } else {
    res.status(500).json({ error: "Email delivery failed.", detail: result.error });
  }
});

// ─── Register a team ──────────────────────────────────────────────────
router.post("/team", async (req: Request, res: Response) => {
  const { eventId, eventName, eventDate, eventVenue, teamName, members, pptLink } = req.body;

  const db = getDb();
  let requirePpt = false;
  let minTeamSize = 1;
  let maxTeamSize = 10;

  try {
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (eventDoc.exists) {
      const ev = eventDoc.data();
      if (ev.requirePpt === true) requirePpt = true;
      if (typeof ev.minTeamSize === "number") minTeamSize = ev.minTeamSize;
      if (typeof ev.maxTeamSize === "number") maxTeamSize = ev.maxTeamSize;
    }
  } catch (err) {
    console.warn("[registerTeam] Event lookup fallback:", err);
  }

  if (!eventId || !eventName || !teamName || !members || members.length < minTeamSize || members.length > maxTeamSize) {
    res.status(400).json({ error: `Team registrations for this event require between ${minTeamSize} and ${maxTeamSize} members.` });
    return;
  }

  if (requirePpt && !pptLink) {
    res.status(400).json({ error: "Presentation file / PPT link is required for this event." });
    return;
  }

  const emailLower = members[0].email.trim().toLowerCase();
  
  // Team duplicate check disabled for testing mode
  /*
  const duplicateNameCheck = await db
    .collection("team_registrations")
    .where("eventId", "==", eventId)
    .where("teamName", "==", teamName.trim())
    .limit(1)
    .get();

  if (!duplicateNameCheck.empty) {
    res.status(409).json({ error: "A team with this name is already registered." });
    return;
  }

  const duplicateLeadCheck2 = await db
    .collection("team_registrations")
    .where("eventId", "==", eventId)
    .where("leadEmail", "==", emailLower)
    .limit(1)
    .get();

  if (!duplicateLeadCheck2.empty) {
    res.status(409).json({ error: "The Team Lead's email is already registered." });
    return;
  }
  */

  const id = uuidv4();

  const membersWithTokens = [];

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const verificationToken = generateToken();
    let qrDataUrl = "";
    try {
      qrDataUrl = await generateQrDataUrl({
        registrationId: id,
        eventId,
        verificationToken,
        isTeam: true,
        memberIndex: i
      } as any);
    } catch (err: any) {
      console.error("[registerTeam] QR generation failed for member", i, ":", err.message);
      res.status(500).json({ error: "Failed to generate team tickets." });
      return;
    }
    membersWithTokens.push({
      name: m.name.trim(),
      email: m.email.trim().toLowerCase(),
      rollNumber: m.rollNumber.trim(),
      year: m.year,
      branch: m.branch,
      phone: m.phone.trim(),
      verificationToken,
      qrDataUrl,
      checkedIn: false,
      checkedInAt: null,
    });
  }

  const registration = {
    eventId,
    eventName,
    eventDate,
    eventVenue,
    teamName: teamName.trim(),
    leadEmail: emailLower,
    members: membersWithTokens,
    pptLink: pptLink || "",
    emailStatus: "pending",
    createdAt: new Date().toISOString(),
    isTeam: true
  };

  await db.collection("team_registrations").doc(id).set(registration);

  // Return HTTP 201 immediately for instant UX
  res.status(201).json({
    id,
    teamName: registration.teamName,
    message: "Team successfully registered"
  });

  // Background non-blocking operations (Google Sheets append + Team Ticket Email dispatch)
  (async () => {
    try {
      await appendTeamRegistrationRow({
        teamName: registration.teamName,
        members: registration.members,
        pptLink: registration.pptLink
      });
    } catch (err) {
      console.warn("[registerTeam] Sheets error:", err);
    }

    try {
      const emailRes = await sendTeamTicketEmail({
        teamName: registration.teamName,
        members: registration.members,
        eventName: registration.eventName,
        eventDate: registration.eventDate,
        eventVenue: registration.eventVenue,
        registrationId: id,
        eventId: registration.eventId
      });
      const status = emailRes.success ? "sent" : "failed";
      await db.collection("team_registrations").doc(id).set({ emailStatus: status }, { merge: true });
    } catch (emailErr: any) {
      console.error(`[registerTeam] Email exception for ${id}:`, emailErr.message);
      await db.collection("team_registrations").doc(id).set({ emailStatus: "failed" }, { merge: true });
    }
  })();
});

export default router;
