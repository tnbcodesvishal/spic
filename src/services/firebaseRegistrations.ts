import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sanitizeForFirestore } from "./firebaseEvents";
import type { Registration } from "./api";

const REGISTRATIONS_COLLECTION = "registrations";
const TEAM_REGISTRATIONS_COLLECTION = "team_registrations";

export interface TeamMemberRegistration {
  name: string;
  email: string;
  rollNumber: string;
  year: string;
  branch: string;
  phone: string;
  verificationToken: string;
  qrDataUrl: string;
  checkedIn: boolean;
  checkedInAt: string | null;
}

export interface TeamRegistration {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  teamName: string;
  leadEmail: string;
  members: TeamMemberRegistration[];
  pptLink: string;
  emailStatus: "pending" | "sent" | "failed";
  createdAt: string;
  isTeam: boolean;
}

let isMigrated = false;

// ─── Save Individual Registration to Firebase Firestore ─────────────────
export async function saveFirebaseRegistration(data: any): Promise<void> {
  if (!data.id) throw new Error("Registration ID is required");
  const docRef = doc(db, REGISTRATIONS_COLLECTION, data.id);
  const cleanData = sanitizeForFirestore({
    ...data,
    checkedIn: data.checkedIn ?? false,
    checkedInAt: data.checkedInAt ?? null,
    createdAt: data.createdAt || new Date().toISOString(),
  });
  await setDoc(docRef, cleanData, { merge: true });
  console.log(`[Firebase] Saved registration ${data.id} to Firestore.`);
}

// ─── Save Team Registration to Firebase Firestore ──────────────────────
export async function saveFirebaseTeamRegistration(data: any): Promise<void> {
  if (!data.id) throw new Error("Team Registration ID is required");
  const docRef = doc(db, TEAM_REGISTRATIONS_COLLECTION, data.id);
  const cleanData = sanitizeForFirestore({
    ...data,
    isTeam: true,
    createdAt: data.createdAt || new Date().toISOString(),
  });
  await setDoc(docRef, cleanData, { merge: true });
  console.log(`[Firebase] Saved team registration ${data.id} to Firestore.`);
}

// ─── Fetch All Registrations (Individual + Team) from Firebase ─────────
export async function getFirebaseRegistrations(): Promise<{
  individual: Registration[];
  team: TeamRegistration[];
  all: any[];
}> {
  try {
    await seedFirebaseRegistrationsFromLocalDb();

    const indSnap = await getDocs(collection(db, REGISTRATIONS_COLLECTION));
    const teamSnap = await getDocs(collection(db, TEAM_REGISTRATIONS_COLLECTION));

    const individual: any[] = indSnap.docs.map((d) => ({
      id: d.id,
      type: "individual",
      ...(d.data() as any),
    }));

    const team: any[] = teamSnap.docs.map((d) => ({
      id: d.id,
      type: "team",
      isTeam: true,
      ...(d.data() as any),
    }));

    // Sort by createdAt descending
    const sortByCreated = (a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();

    individual.sort(sortByCreated);
    team.sort(sortByCreated);

    const all = [...individual, ...team].sort(sortByCreated);

    return { individual, team, all };
  } catch (err: any) {
    console.warn("[Firebase] Error fetching registrations from Firestore:", err.message);
    return { individual: [], team: [], all: [] };
  }
}

// ─── Update Check-in Status in Firebase Firestore ──────────────────────
export async function updateFirebaseCheckIn(
  regId: string,
  isTeam: boolean,
  memberIndex?: number
): Promise<boolean> {
  try {
    const colName = isTeam ? TEAM_REGISTRATIONS_COLLECTION : REGISTRATIONS_COLLECTION;
    const docRef = doc(db, colName, regId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      console.warn(`[Firebase] Registration ${regId} not found in ${colName}`);
      return false;
    }

    const data = snap.data();
    const nowIso = new Date().toISOString();

    if (isTeam && typeof memberIndex === "number" && Array.isArray(data.members)) {
      const updatedMembers = [...data.members];
      if (updatedMembers[memberIndex]) {
        updatedMembers[memberIndex] = {
          ...updatedMembers[memberIndex],
          checkedIn: true,
          checkedInAt: nowIso,
        };
      }
      await updateDoc(docRef, { members: updatedMembers });
      console.log(`[Firebase] Updated check-in for team member ${memberIndex} in ${regId}`);
      return true;
    } else {
      await updateDoc(docRef, {
        checkedIn: true,
        checkedInAt: nowIso,
      });
      console.log(`[Firebase] Updated check-in for registration ${regId}`);
      return true;
    }
  } catch (err: any) {
    console.error(`[Firebase] Error updating check-in for ${regId}:`, err.message);
    return false;
  }
}

// ─── Subscribe to Realtime Registration Updates ─────────────────────────
export function subscribeToFirebaseRegistrations(
  onUpdate: (data: { individual: Registration[]; team: TeamRegistration[]; all: any[] }) => void,
  onError?: (err: Error) => void
): () => void {
  let individualList: any[] = [];
  let teamList: any[] = [];

  const emit = () => {
    const sortByCreated = (a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();

    individualList.sort(sortByCreated);
    teamList.sort(sortByCreated);
    const all = [...individualList, ...teamList].sort(sortByCreated);

    onUpdate({ individual: individualList, team: teamList, all });
  };

  try {
    const indUnsub = onSnapshot(
      collection(db, REGISTRATIONS_COLLECTION),
      (snap) => {
        individualList = snap.docs.map((d) => ({
          id: d.id,
          type: "individual",
          ...(d.data() as any),
        }));
        emit();
      },
      (err) => {
        console.warn("[Firebase] Realtime individual registrations snapshot error:", err.message);
        onError?.(err);
      }
    );

    const teamUnsub = onSnapshot(
      collection(db, TEAM_REGISTRATIONS_COLLECTION),
      (snap) => {
        teamList = snap.docs.map((d) => ({
          id: d.id,
          type: "team",
          isTeam: true,
          ...(d.data() as any),
        }));
        emit();
      },
      (err) => {
        console.warn("[Firebase] Realtime team registrations snapshot error:", err.message);
        onError?.(err);
      }
    );

    return () => {
      indUnsub();
      teamUnsub();
    };
  } catch (err: any) {
    console.warn("[Firebase] Error setting up realtime registrations listener:", err.message);
    return () => {};
  }
}

// ─── Seed Firebase from Local DB / Backend if empty ────────────────────
export async function seedFirebaseRegistrationsFromLocalDb(): Promise<void> {
  if (isMigrated) return;
  try {
    const indSnap = await getDocs(collection(db, REGISTRATIONS_COLLECTION));
    const teamSnap = await getDocs(collection(db, TEAM_REGISTRATIONS_COLLECTION));

    const existingIndIds = new Set(indSnap.docs.map((d) => d.id));
    const existingTeamIds = new Set(teamSnap.docs.map((d) => d.id));

    console.log("[Firebase] Checking initial registrations seed for Firestore...");
    // Local DB initial records backup seed
    const initialIndData: Record<string, any> = {
      "5063c8d9-855b-40f5-8175-3dc5f5284f1a": {
        eventId: "test-event-1",
        eventName: "Test Event",
        eventDate: "2026-09-01",
        eventVenue: "Main Hall",
        participantName: "John Doe",
        participantEmail: "john.doe@example.com",
        phone: "9876543210",
        rollNumber: "2100270100001",
        year: "3rd Year",
        branch: "CSE",
        verificationToken: "38317fd3eb5f76f5f15dd9ead8466c3f7993716a468ed4927f009940788720e8",
        emailStatus: "failed",
        checkedIn: false,
        checkedInAt: null,
        createdAt: "2026-08-30T04:52:35.799Z",
      },
      "66daaa1a-49a4-4794-a5c0-886b58240f6f": {
        eventId: "spic-innovate-2026",
        eventName: "Innovation Hackathon 2026",
        eventDate: "2026-09-15",
        eventVenue: "RKGIT Main Auditorium",
        participantName: "Rahul Sharma",
        participantEmail: "rahul.sharma@example.com",
        phone: "9876543210",
        rollNumber: "2100270100088",
        year: "3rd Year",
        branch: "CSE",
        verificationToken: "c09fc240397010fca4fca90f9d7135a3aca1952d8041ba3456001f4ddf609419",
        emailStatus: "sent",
        checkedIn: false,
        checkedInAt: null,
        createdAt: "2026-08-30T05:07:01.188Z",
      },
      "dc2f256b-3719-48c7-ada9-608fefa3c2a2": {
        eventId: "spic-innovate-2026",
        eventName: "Innovation Hackathon 2026",
        eventDate: "2026-09-15",
        eventVenue: "RKGIT Main Auditorium",
        participantName: "Test Student",
        participantEmail: "110cs2425@rkgit.edu.in",
        phone: "9876543210",
        rollNumber: "110CS2425",
        year: "2nd Year",
        branch: "CSE",
        verificationToken: "c5cf84209fe76a8812a5121f9642f8f1250ccc540927f2ea72102677b870acd9",
        emailStatus: "sent",
        checkedIn: false,
        checkedInAt: null,
        createdAt: "2026-08-30T05:14:18.735Z",
      },
      "a49e4d38-920e-4d56-89ef-f21c03a6dde2": {
        eventId: "spic-techfest-2026",
        eventName: "SPIC TechFest 2026",
        eventDate: "2026-09-20",
        eventVenue: "RKGIT Campus",
        participantName: "Vishal Singh",
        participantEmail: "110cs2425@rkgit.edu.in",
        phone: "9876543210",
        rollNumber: "110CS2425",
        year: "2nd Year",
        branch: "CSE",
        verificationToken: "6a7e9c4a18e8632f5647aa4170aa7321bbc662bc68e1aebf45e0c0f0963f93c6",
        emailStatus: "sent",
        checkedIn: false,
        checkedInAt: null,
        createdAt: "2026-08-30T05:28:41.881Z",
      },
      "e7452358-b0b8-4468-a027-2edcde8a4f08": {
        eventId: "spic-workshop-2026",
        eventName: "SPIC AI & Web Workshop 2026",
        eventDate: "2026-10-05",
        eventVenue: "RKGIT Computer Lab 2",
        participantName: "Vishal Singh",
        participantEmail: "110cs2425@rkgit.edu.in",
        phone: "9876543210",
        rollNumber: "110CS2425",
        year: "2nd Year",
        branch: "CSE",
        verificationToken: "9e8c281f6c7be596dd29a7fd7e9a7a20b30bf4bf96c3ae122f3f416c05c23e2b",
        emailStatus: "sent",
        checkedIn: false,
        checkedInAt: null,
        createdAt: "2026-08-30T05:29:01.065Z",
      },
      "0dfbd074-0641-4006-8517-1670ed3d288f": {
        eventId: "spic-hackathon-live-2026",
        eventName: "SPIC Hackathon 2026",
        eventDate: "2026-10-15",
        eventVenue: "RKGIT Auditorium",
        participantName: "Vishal Singh",
        participantEmail: "110cs2425@rkgit.edu.in",
        phone: "9876543210",
        rollNumber: "110CS2425",
        year: "2nd Year",
        branch: "CSE",
        verificationToken: "822b1bea10323f67c808ca169659d63723d15e7c0100259e0d38685039107b29",
        emailStatus: "sent",
        checkedIn: false,
        checkedInAt: null,
        createdAt: "2026-08-30T05:31:18.216Z",
      },
      "de3db200-1168-4fc3-bc0c-b1c6def5c1fb": {
        eventId: "spic-fresh-2026",
        eventName: "SPIC Grand Innovation Summit 2026",
        eventDate: "2026-11-01",
        eventVenue: "Main Auditorium, RKGIT",
        participantName: "Vishal Singh",
        participantEmail: "110cs2425@rkgit.edu.in",
        phone: "9876543210",
        rollNumber: "110CS2425",
        year: "2nd Year",
        branch: "CSE",
        verificationToken: "6b5d633476ae34e8bada4f1b33772c392518cc356e0564a5e8ac1679abbdcf1e",
        emailStatus: "sent",
        checkedIn: false,
        checkedInAt: null,
        createdAt: "2026-08-30T05:31:41.000Z",
      },
    };

    for (const [id, data] of Object.entries(initialIndData)) {
      if (!existingIndIds.has(id)) {
        await saveFirebaseRegistration({ id, ...data });
      }
    }

    isMigrated = true;
    console.log("[Firebase] Seeded registrations successfully into Firestore.");
  } catch (err: any) {
    console.warn("[Firebase] Registration seed skipped or failed:", err.message);
  }
}
