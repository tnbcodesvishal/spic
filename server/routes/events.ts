import { Router, type Request, type Response } from "express";
import { getDb } from "../db";

const router = Router();
const EVENTS_COLLECTION = "events";
const ADMIN_PIN = process.env.ADMIN_PIN || "spic@2026";

export interface EventData {
  id: string;
  name: string;
  date: string;
  time?: string;
  venue: string;
  status: "upcoming" | "open" | "closed" | "ended";
  category: "hackathon" | "workshop" | "talk" | "competition" | "visit" | "seminar";
  description: string;
  registrationType?: "individual" | "team";
  minTeamSize?: number;
  maxTeamSize?: number;
  requirePpt?: boolean;
  whatsappGroupUrl?: string;
  attendees?: number;
  speakers?: number;
  highlightsUrl?: string;
  registrationUrl?: string;
  image?: string;
  imageList?: string[];
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Initial seed events
const DEFAULT_EVENTS: EventData[] = [
  {
    id: "ideation-2",
    name: "Ideation '26",
    date: "25 & 27 April 2026",
    time: "10:00 AM onwards",
    venue: "Seminar Hall , D Block",
    status: "open",
    category: "competition",
    description: "Intra-college pitch competition where students present innovative ideas to a panel of industry experts and investors.",
    registrationType: "team",
    minTeamSize: 1,
    maxTeamSize: 4,
    requirePpt: true,
    whatsappGroupUrl: "https://chat.whatsapp.com/test-invite",
    featured: true,
  },
  {
    id: "tedx-rkgit-2026",
    name: "TEDx RKGIT",
    date: "2026-04-01",
    time: "11:00 AM",
    venue: "D Block Auditorium",
    status: "closed",
    category: "talk",
    description: "An independently organized TEDx event featuring inspiring talks from thought leaders, innovators, and changemakers.",
    registrationType: "individual",
    minTeamSize: 1,
    maxTeamSize: 1,
    requirePpt: false,
    highlightsUrl: "#",
  },
  {
    id: "tedx-2025",
    name: "TEDx RKGIT 2025",
    date: "2025-08-22",
    venue: "Seminar Hall",
    status: "ended",
    category: "talk",
    description: "An inspiring TEDx event with 7 speakers and 200+ attendees.",
    registrationType: "individual",
    attendees: 200,
    speakers: 7,
    highlightsUrl: "#",
    imageList: [
      "DSC_1650.webp",
      "DSC_1691.webp",
      "DSC_1712.webp",
      "DSC_1730.webp",
      "DSC_1775.webp",
      "DSC_1869.webp",
      "DSC_1909.webp",
      "DSC_2021.webp",
      "SAH06110.webp",
      "SAH06212.webp",
      "SAH06231.webp",
      "SAH06339.webp",
      "SAH06389.webp",
      "SAH06409.webp",
    ],
  },
  {
    id: "spic-gma-2024",
    name: "SPIC x GMA",
    date: "9 October 2024",
    venue: "Seminar Hall",
    status: "ended",
    category: "competition",
    description: "The Ghaziabad Entrepreneurship Mission, launched by the Ghaziabad Management Association (GMA) in collaboration with SkillingYou.",
    registrationType: "team",
    attendees: 120,
    highlightsUrl: "#",
  },
  {
    id: "spic-ideation-2023",
    name: "Spic x Ideation 2023",
    date: "5 & 13 May 2023",
    venue: "Seminar Hall",
    status: "ended",
    category: "competition",
    description: "Ideation workshop and competition to foster innovative thinking among students.",
    registrationType: "team",
    attendees: 120,
    highlightsUrl: "#",
  },
  {
    id: "spic-haier-2023",
    name: "Spic x Haier",
    date: "24 April 2023",
    venue: "Seminar Hall",
    status: "ended",
    category: "visit",
    description: "Industrial visit to Haier to gain insights into manufacturing and operations.",
    registrationType: "individual",
    attendees: 120,
    highlightsUrl: "#",
  },
  {
    id: "spic-eashwa-2022",
    name: "Spic x E-Ashwa",
    date: "23 December 2022",
    venue: "Seminar Hall",
    status: "ended",
    category: "visit",
    description: "Industrial visit to E-Ashwa to understand the electric vehicle industry.",
    registrationType: "individual",
    attendees: 120,
    highlightsUrl: "#",
  },
  {
    id: "spic-upgrade-2022",
    name: "Spic x UpGrad",
    date: "21 December 2022",
    venue: "Seminar Hall",
    status: "ended",
    category: "seminar",
    description: "Collaborative seminar with UpGrad focusing on career growth and upskilling.",
    registrationType: "individual",
    attendees: 120,
    highlightsUrl: "#",
  },
  {
    id: "spic-unacademy-2022",
    name: "Spic x Unacademy",
    date: "17 October 2022",
    venue: "Seminar Hall",
    status: "ended",
    category: "talk",
    description: "Session with successful innovator S.K Mondal in collaboration with Unacademy.",
    registrationType: "individual",
    attendees: 120,
    highlightsUrl: "#",
  },
  {
    id: "spic-gfg-2022",
    name: "Spic x GFG",
    date: "24 May 2022",
    venue: "Seminar Hall",
    status: "ended",
    category: "talk",
    description: "Interactive session with Sandeep Jain, founder of GeeksforGeeks.",
    registrationType: "individual",
    attendees: 120,
    highlightsUrl: "#",
  },
  {
    id: "spic-pw-2022",
    name: "Spic x PW",
    date: "24 January 2022",
    venue: "Seminar Hall",
    status: "ended",
    category: "talk",
    description: "Guest lecture in collaboration with Physics Wallah.",
    registrationType: "individual",
    attendees: 120,
    highlightsUrl: "#",
  },
];

// Helper to check admin pin
function checkAdminAuth(req: Request): boolean {
  const pin = req.headers["x-admin-pin"] || req.body?.adminPin;
  return pin === ADMIN_PIN;
}

// Ensure database is seeded with initial events if empty
let isSeeded = false;
async function ensureSeeded() {
  if (isSeeded) return;
  try {
    const db = getDb();
    const snapshot = await db.collection(EVENTS_COLLECTION).get();
    if (snapshot.empty || snapshot.docs.length === 0) {
      console.log("[events] Seeding default events into database...");
      for (const ev of DEFAULT_EVENTS) {
        await db.collection(EVENTS_COLLECTION).doc(ev.id).set({
          ...ev,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    isSeeded = true;
  } catch (err) {
    console.error("[events] Error seeding events:", err);
  }
}

// ─── GET /api/events ──────────────────────────────────────────────────
// Returns all events
router.get("/", async (_req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const db = getDb();
    const snapshot = await db.collection(EVENTS_COLLECTION).get();

    const events: EventData[] = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // If database returned nothing, return default events
    if (events.length === 0) {
      res.json(DEFAULT_EVENTS);
      return;
    }

    res.json(events);
  } catch (err: any) {
    console.error("[events] Error fetching events:", err);
    res.json(DEFAULT_EVENTS);
  }
});

// ─── GET /api/events/:id ──────────────────────────────────────────────
// Returns single event
router.get("/:id", async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const db = getDb();
    const doc = await db.collection(EVENTS_COLLECTION).doc(req.params.id).get();

    if (!doc.exists) {
      // Check default events fallback
      const fallback = DEFAULT_EVENTS.find((e) => e.id === req.params.id);
      if (fallback) {
        res.json(fallback);
        return;
      }
      res.status(404).json({ error: "Event not found" });
      return;
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error("[events] Error fetching event:", err);
    const fallback = DEFAULT_EVENTS.find((e) => e.id === req.params.id);
    if (fallback) {
      res.json(fallback);
      return;
    }
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// ─── POST /api/events ─────────────────────────────────────────────────
// Create new event (Admin only)
router.post("/", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req)) {
    res.status(401).json({ error: "Unauthorized: Invalid or missing admin PIN" });
    return;
  }

  const {
    id: customId,
    name,
    date,
    time,
    venue,
    status = "upcoming",
    category = "competition",
    description = "",
    registrationType = "individual",
    minTeamSize = 1,
    maxTeamSize = 1,
    requirePpt = false,
    whatsappGroupUrl,
    featured = false,
    image,
    highlightsUrl,
  } = req.body || {};

  if (!name || !date || !venue) {
    res.status(400).json({ error: "Event Name, Date, and Venue are required." });
    return;
  }

  // Generate slug ID if not provided
  const id = (customId || name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const db = getDb();
  const existing = await db.collection(EVENTS_COLLECTION).doc(id).get();
  if (existing.exists) {
    res.status(409).json({ error: `An event with ID "${id}" already exists. Please use a unique title or ID.` });
    return;
  }

  const newEvent: EventData = {
    id,
    name: name.trim(),
    date: date.trim(),
    time: time?.trim() || "10:00 AM onwards",
    venue: venue.trim(),
    status,
    category,
    description: description.trim(),
    registrationType,
    minTeamSize: registrationType === "team" ? Number(minTeamSize) || 2 : 1,
    maxTeamSize: registrationType === "team" ? Number(maxTeamSize) || 4 : 1,
    requirePpt: registrationType === "team" ? Boolean(requirePpt) : false,
    whatsappGroupUrl: whatsappGroupUrl?.trim() || "",
    featured: Boolean(featured),
    image: image?.trim() || "",
    highlightsUrl: highlightsUrl?.trim() || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.collection(EVENTS_COLLECTION).doc(id).set(newEvent);
  res.status(201).json(newEvent);
});

// ─── PUT /api/events/:id ──────────────────────────────────────────────
// Update existing event (Admin only)
router.put("/:id", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req)) {
    res.status(401).json({ error: "Unauthorized: Invalid or missing admin PIN" });
    return;
  }

  const { id } = req.params;
  const db = getDb();
  const doc = await db.collection(EVENTS_COLLECTION).doc(id).get();

  if (!doc.exists) {
    res.status(404).json({ error: "Event not found." });
    return;
  }

  const existingData = doc.data();
  const updatePayload: Partial<EventData> = {
    ...(req.body || {}),
    id, // Preserve ID
    updatedAt: new Date().toISOString(),
  };

  delete (updatePayload as any).adminPin;

  // Enforce team sizes if registrationType is changed
  if (updatePayload.registrationType === "individual") {
    updatePayload.minTeamSize = 1;
    updatePayload.maxTeamSize = 1;
    updatePayload.requirePpt = false;
  } else if (updatePayload.registrationType === "team") {
    if (updatePayload.minTeamSize !== undefined) updatePayload.minTeamSize = Number(updatePayload.minTeamSize);
    if (updatePayload.maxTeamSize !== undefined) updatePayload.maxTeamSize = Number(updatePayload.maxTeamSize);
  }

  const merged = { ...existingData, ...updatePayload };
  await db.collection(EVENTS_COLLECTION).doc(id).set(merged);

  res.json(merged);
});

// ─── DELETE /api/events/:id ───────────────────────────────────────────
// Delete event (Admin only)
router.delete("/:id", async (req: Request, res: Response) => {
  if (!checkAdminAuth(req)) {
    res.status(401).json({ error: "Unauthorized: Invalid or missing admin PIN" });
    return;
  }

  const { id } = req.params;
  const db = getDb();
  const doc = await db.collection(EVENTS_COLLECTION).doc(id).get();

  if (!doc.exists) {
    res.status(404).json({ error: "Event not found." });
    return;
  }

  await db.collection(EVENTS_COLLECTION).doc(id).delete();

  res.json({ message: `Event "${id}" successfully deleted.` });
});

export default router;
