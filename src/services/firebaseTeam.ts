import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import {
  facultyAdvisor,
  coreLeadership,
  departmentHeads,
  teamMembers,
  type TeamMember,
} from "@/data/team";

const TEAM_COLLECTION = "team";

let isTeamSeeded = false;

export interface TeamMemberDoc extends TeamMember {
  category: "faculty" | "core" | "department" | "member";
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Initial Seed Data ────────────────────────────────────────────────
const INITIAL_TEAM_DOCS: TeamMemberDoc[] = [
  { ...facultyAdvisor, category: "faculty", order: 1 },
  ...coreLeadership.map((m, idx) => ({
    ...m,
    category: "core" as const,
    order: idx + 2,
  })),
  ...departmentHeads.map((m, idx) => ({
    ...m,
    category: "department" as const,
    order: idx + 100,
  })),
  ...teamMembers.map((m, idx) => ({
    ...m,
    category: "member" as const,
    order: idx + 200,
  })),
];

// ─── Upload Team Image to Firebase Storage ────────────────────────────
export async function uploadTeamImage(file: File): Promise<string> {
  const fileExt = file.name.split(".").pop() || "png";
  const fileName = `team_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
  const storageRef = ref(storage, `team/${fileName}`);
  
  const snapshot = await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}

// ─── Seed Team if Empty ───────────────────────────────────────────────
export async function seedTeamIfEmpty(): Promise<void> {
  if (isTeamSeeded) return;
  try {
    const colRef = collection(db, TEAM_COLLECTION);
    const snap = await getDocs(colRef);
    if (snap.empty) {
      console.log("[firebaseTeam] Seeding initial team members into Firestore...");
      for (const member of INITIAL_TEAM_DOCS) {
        const docRef = doc(db, TEAM_COLLECTION, member.id);
        const payload = {
          ...member,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(docRef, payload, { merge: true });
      }
    }
    isTeamSeeded = true;
  } catch (err) {
    console.error("[firebaseTeam] Failed to seed team collection:", err);
  }
}

// ─── Realtime Listener ────────────────────────────────────────────────
export function subscribeToTeam(
  callback: (teamList: TeamMemberDoc[]) => void
): () => void {
  seedTeamIfEmpty();

  const colRef = collection(db, TEAM_COLLECTION);
  const q = query(colRef);

  return onSnapshot(
    q,
    (snapshot) => {
      let list: TeamMemberDoc[] = [];
      if (!snapshot.empty) {
        list = snapshot.docs.map((d) => ({
          ...(d.data() as TeamMemberDoc),
          id: d.id,
        }));
      } else {
        list = INITIAL_TEAM_DOCS;
      }

      // Sort by order ascending or createdAt descending
      list.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      callback(list);
    },
    (err) => {
      console.error("[firebaseTeam] Realtime subscription error:", err);
      callback(INITIAL_TEAM_DOCS);
    }
  );
}

// ─── Add Team Member ─────────────────────────────────────────────────
export async function addTeamMember(
  data: Omit<TeamMemberDoc, "id"> & { id?: string }
): Promise<TeamMemberDoc> {
  const memberId = data.id || `team-${Date.now()}`;
  const docRef = doc(db, TEAM_COLLECTION, memberId);
  const now = new Date().toISOString();

  const payload: TeamMemberDoc = {
    ...data,
    id: memberId,
    order: data.order ?? Date.now(),
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, payload, { merge: true });
  return payload;
}

// ─── Update Team Member ──────────────────────────────────────────────
export async function updateTeamMember(
  id: string,
  data: Partial<TeamMemberDoc>
): Promise<void> {
  const docRef = doc(db, TEAM_COLLECTION, id);
  const payload = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(docRef, payload, { merge: true });
}

// ─── Delete Team Member ──────────────────────────────────────────────
export async function deleteTeamMember(id: string, imageUrl?: string): Promise<void> {
  const docRef = doc(db, TEAM_COLLECTION, id);
  await deleteDoc(docRef);

  // If image URL is from Firebase Storage, clean up optional storage object
  if (imageUrl && imageUrl.includes("firebasestorage.googleapis.com")) {
    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch (e) {
      console.warn("[firebaseTeam] Could not delete image from Storage:", e);
    }
  }
}
