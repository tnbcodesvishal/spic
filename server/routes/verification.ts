import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { getDb, REGISTRATIONS } from "../db";
import { appendAttendanceRow } from "../services/sheets";

const router = Router();

// ─── Verify & check-in a participant ────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  const { registrationId, eventId, verificationToken } = req.body;

  const isTeam = req.body.isTeam === true;

  if (!registrationId || !eventId || !verificationToken) {
    res.status(400).json({ error: "Invalid QR data." });
    return;
  }

  const db = getDb();
  
  const collectionName = isTeam ? "team_registrations" : REGISTRATIONS;
  const doc = await db.collection(collectionName).doc(registrationId).get();

  if (!doc.exists) {
    res.status(404).json({ valid: false, error: "Registration not found." });
    return;
  }

  const row = doc.data()!;

  if (row.eventId !== eventId) {
    res.status(404).json({ valid: false, error: "Registration not found for this event." });
    return;
  }

  // Find the exact member if it's a team
  let storedToken: string;
  let isCheckedIn: boolean;
  let participantNameResponse: string;
  let participantEmailResponse: string;

  if (isTeam) {
    const memberIndex = req.body.memberIndex;
    if (typeof memberIndex !== "number" || !row.members || !row.members[memberIndex]) {
      res.status(400).json({ error: "Invalid QR data. Missing or invalid member index." });
      return;
    }
    const member = row.members[memberIndex];
    storedToken = member.verificationToken;
    isCheckedIn = member.checkedIn;
    participantNameResponse = `${member.name} (Team ${row.teamName})`;
    participantEmailResponse = member.email;
  } else {
    storedToken = row.verificationToken;
    isCheckedIn = row.checkedIn;
    participantNameResponse = row.participantName;
    participantEmailResponse = row.participantEmail;
  }

  // Constant-time comparison to prevent timing attacks
  const tokenBuffer = Buffer.from(storedToken, "utf8");
  const inputBuffer = Buffer.from(verificationToken, "utf8");

  if (
    tokenBuffer.length !== inputBuffer.length ||
    !crypto.timingSafeEqual(tokenBuffer, inputBuffer)
  ) {
    res.status(403).json({ valid: false, error: "Invalid verification token." });
    return;
  }

  if (isCheckedIn) {
    res.status(409).json({
      valid: false,
      error: "This ticket has already been used.",
      participantName: participantNameResponse,
    });
    return;
  }

  // Mark as checked-in
  const checkedInAt = new Date().toISOString();
  
  if (isTeam) {
    const memberIndex = req.body.memberIndex;
    const updatedMembers = [...row.members];
    updatedMembers[memberIndex] = {
      ...updatedMembers[memberIndex],
      checkedIn: true,
      checkedInAt
    };
    await db.collection(collectionName).doc(doc.id).update({
      members: updatedMembers
    });
  } else {
    await db.collection(collectionName).doc(doc.id).update({
      checkedIn: true,
      checkedInAt,
    });
  }

  // Log attendance to Google Sheet (non-blocking)
  const sheetData = isTeam
    ? {
        participantName: row.members[req.body.memberIndex].name,
        participantEmail: row.members[req.body.memberIndex].email,
        phone: row.members[req.body.memberIndex].phone ?? null,
        rollNumber: row.members[req.body.memberIndex].rollNumber ?? null,
        year: row.members[req.body.memberIndex].year ?? null,
        eventName: row.eventName,
        eventDate: row.eventDate,
        eventVenue: row.eventVenue,
      }
    : {
        participantName: row.participantName,
        participantEmail: row.participantEmail,
        phone: row.phone ?? null,
        rollNumber: row.rollNumber ?? null,
        year: row.year ?? null,
        eventName: row.eventName,
        eventDate: row.eventDate,
        eventVenue: row.eventVenue,
      };

  appendAttendanceRow(sheetData)
    .then((result) => {
      if (!result.success) {
        console.error("[verify] Sheet attendance update failed:", result.error);
      } else {
        console.log(`[verify] ✅ Sheet attendance marked as Present for ${sheetData.participantName}`);
      }
    })
    .catch((err) => console.error("[verify] Sheet attendance error:", err));

  res.json({
    valid: true,
    participantName: participantNameResponse,
    participantEmail: participantEmailResponse,
    eventName: row.eventName,
    attendance: "Present",
  });
});

export default router;
