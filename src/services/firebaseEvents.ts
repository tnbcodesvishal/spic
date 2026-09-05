import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { upcomingEvents, pastEvents, type Event } from "@/data/events";
import { api } from "./api";

const EVENTS_COLLECTION = "events";

const DEFAULT_EVENTS: Event[] = [...upcomingEvents, ...pastEvents];

let isSeeded = false;

// ─── Sanitizer to ensure no `undefined` values reach Firestore ────────
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item));
  }
  if (typeof obj === "object") {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned;
  }
  return obj;
}

// ─── Sort Events Helper (Featured first, then open/upcoming, then creation date) ───
export function sortEventsList(events: Event[]): Event[] {
  return [...events].sort((a, b) => {
    // Featured first
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;

    // Status precedence: open, upcoming, closed, ended
    const order: Record<string, number> = { open: 1, upcoming: 2, closed: 3, ended: 4 };
    const orderA = order[a.status] || 5;
    const orderB = order[b.status] || 5;
    if (orderA !== orderB) return orderA - orderB;

    // By createdAt descending (newest first)
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });
}

// ─── Seed default events into Firebase Firestore if missing ───
export async function seedFirebaseEventsIfEmpty(): Promise<void> {
  if (isSeeded) return;
  try {
    const colRef = collection(db, EVENTS_COLLECTION);
    const snap = await getDocs(colRef);
    const existingIds = new Set(snap.docs.map((d) => d.id));

    // Ensure all DEFAULT_EVENTS (including Ideation '26) exist in Firestore
    for (const ev of DEFAULT_EVENTS) {
      if (!existingIds.has(ev.id)) {
        const cleanEv = sanitizeForFirestore({
          ...ev,
          whatsappGroupUrl: ev.whatsappGroupUrl || "",
          image: ev.image || "",
          highlightsUrl: ev.highlightsUrl || "",
          createdAt: ev.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await setDoc(doc(db, EVENTS_COLLECTION, ev.id), cleanEv, { merge: true });
        console.log(`[Firebase] Seeded missing event "${ev.id}" (${ev.name}) to Firestore.`);
      }
    }
    isSeeded = true;
  } catch (err: any) {
    console.warn("[Firebase] Could not seed Firestore events (check security rules or network):", err.message);
  }
}

// ─── Fetch All Events from Firebase ─────────────────────────────────
export async function getFirebaseEvents(): Promise<Event[]> {
  try {
    await seedFirebaseEventsIfEmpty();
    const colRef = collection(db, EVENTS_COLLECTION);
    const snap = await getDocs(colRef);

    const list: Event[] = !snap.empty
      ? snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      : [];

    // Always merge any DEFAULT_EVENTS missing from Firestore map so Ideation '26 is never lost
    const eventMap = new Map<string, Event>();
    DEFAULT_EVENTS.forEach((e) => eventMap.set(e.id, e));
    list.forEach((e) => eventMap.set(e.id, e));

    return sortEventsList(Array.from(eventMap.values()));
  } catch (err: any) {
    console.warn("[Firebase] Error fetching from Firestore, falling back to API / local:", err.message);
  }

  // Fallback to Express backend API
  try {
    const fromApi = await api.getEvents();
    if (fromApi && fromApi.length > 0) return sortEventsList(fromApi);
  } catch (err) {
    // ignore
  }

  return sortEventsList(DEFAULT_EVENTS);
}

// ─── Fetch Single Event from Firebase ───────────────────────────────
export async function getFirebaseEvent(id: string): Promise<Event | null> {
  try {
    const docRef = doc(db, EVENTS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as any) };
    }
  } catch (err: any) {
    console.warn(`[Firebase] Error fetching event "${id}" from Firestore:`, err.message);
  }

  // Fallback to backend API
  try {
    const fromApi = await api.getEvent(id);
    if (fromApi) return fromApi;
  } catch (err) {
    // ignore
  }

  return DEFAULT_EVENTS.find((e) => e.id === id) || null;
}

// ─── Save / Update Event in Firebase ────────────────────────────────
export async function saveFirebaseEvent(eventData: Partial<Event>, pin: string): Promise<Event> {
  const generatedSlug = (eventData.name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const id = (eventData.id && eventData.id.trim()) || generatedSlug || `event-${Date.now()}`;

  const fullEvent: Event = {
    id,
    name: (eventData.name || "").trim() || "Untitled Event",
    date: (eventData.date || "").trim(),
    time: (eventData.time || "").trim() || "10:00 AM onwards",
    venue: (eventData.venue || "").trim(),
    status: eventData.status || "open",
    category: eventData.category || "competition",
    description: (eventData.description || "").trim(),
    registrationType: eventData.registrationType || "individual",
    minTeamSize: eventData.registrationType === "team" ? Math.max(1, Number(eventData.minTeamSize) || 2) : 1,
    maxTeamSize: eventData.registrationType === "team" ? Math.max(1, Number(eventData.maxTeamSize) || 4) : 1,
    requirePpt: eventData.registrationType === "team" ? Boolean(eventData.requirePpt) : false,
    whatsappGroupUrl: eventData.whatsappGroupUrl ? eventData.whatsappGroupUrl.trim() : "",
    featured: Boolean(eventData.featured),
    image: eventData.image ? eventData.image.trim() : "",
    highlightsUrl: eventData.highlightsUrl ? eventData.highlightsUrl.trim() : "",
    createdAt: eventData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Preserve extra metadata if present
  if ((eventData as any).imageList) (fullEvent as any).imageList = (eventData as any).imageList;
  if ((eventData as any).attendees) (fullEvent as any).attendees = (eventData as any).attendees;
  if ((eventData as any).speakers) (fullEvent as any).speakers = (eventData as any).speakers;

  // 1. Direct write to Firebase Firestore
  const docRef = doc(db, EVENTS_COLLECTION, id);
  const firestoreData = sanitizeForFirestore(fullEvent);

  try {
    await setDoc(docRef, firestoreData, { merge: true });
    console.log(`[Firebase] Successfully saved event "${id}" to Firestore:`, firestoreData);
  } catch (firestoreErr: any) {
    console.error(`[Firebase] Failed to write event "${id}" to Firestore:`, firestoreErr);
    throw new Error(`Firebase Firestore save failed: ${firestoreErr.message || firestoreErr}`);
  }

  // 2. Best-effort sync with backend API (Express mock/cache)
  try {
    await api.createEvent(fullEvent, pin).catch(async () => {
      await api.updateEvent(id, fullEvent, pin);
    });
  } catch (err: any) {
    console.warn(`[Firebase] Backend sync note for "${id}":`, err.message);
  }

  return fullEvent;
}

// ─── Delete Event from Firebase ─────────────────────────────────────
export async function deleteFirebaseEvent(id: string, pin: string): Promise<void> {
  // 1. Direct delete from Firebase Firestore
  try {
    const docRef = doc(db, EVENTS_COLLECTION, id);
    await deleteDoc(docRef);
    console.log(`[Firebase] Successfully deleted event "${id}" from Firestore`);
  } catch (firestoreErr: any) {
    console.error(`[Firebase] Failed to delete event "${id}" from Firestore:`, firestoreErr);
    throw new Error(`Firebase Firestore delete failed: ${firestoreErr.message || firestoreErr}`);
  }

  // 2. Best-effort sync delete with backend API
  try {
    await api.deleteEvent(id, pin);
  } catch (err: any) {
    console.warn(`[Firebase] Backend delete sync note:`, err.message);
  }
}

// ─── Realtime Firestore Listener for Events ─────────────────────────
export function subscribeToFirebaseEvents(
  onUpdate: (events: Event[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const colRef = collection(db, EVENTS_COLLECTION);
    const q = query(colRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Event[] = !snapshot.empty
          ? snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as any),
            }))
          : [];

        const eventMap = new Map<string, Event>();
        DEFAULT_EVENTS.forEach((e) => eventMap.set(e.id, e));
        list.forEach((e) => eventMap.set(e.id, e));

        onUpdate(sortEventsList(Array.from(eventMap.values())));
      },
      (error) => {
        console.warn("[Firebase] Realtime snapshot error:", error.message);
        onError?.(error);
      }
    );

    return unsubscribe;
  } catch (err: any) {
    console.warn("[Firebase] Realtime listener setup error:", err.message);
    return () => {};
  }
}
