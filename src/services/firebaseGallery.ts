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
import { pastEvents } from "@/data/events";

const GALLERY_COLLECTION = "gallery";

let isGallerySeeded = false;

export interface GalleryAlbum {
  id: string;
  title: string;
  category?: string;
  description?: string;
  coverImage?: string;
  images: string[];
  date?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Initial Seed Data from Past Events ──────────────────────────────
const INITIAL_GALLERY_ALBUMS: GalleryAlbum[] = pastEvents
  .filter((ev) => ev.imageList && ev.imageList.length > 0)
  .map((ev) => {
    const folderName = ev.id.toLowerCase().replace(/\s+/g, "-");
    const imageList = (ev.imageList || []).map((imgName) =>
      imgName.startsWith("http") || imgName.startsWith("/")
        ? imgName
        : `/events/${folderName}/${imgName}`
    );
    return {
      id: `gallery-${ev.id}`,
      title: ev.name,
      category: ev.name,
      description: ev.description || "",
      coverImage: imageList[0] || "",
      images: imageList,
      date: ev.date || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

// ─── Upload Multiple Gallery Images to Firebase Storage ──────────────
export async function uploadGalleryImages(files: File[]): Promise<string[]> {
  const uploadPromises = files.map(async (file) => {
    const fileExt = file.name.split(".").pop() || "png";
    const fileName = `gallery_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const storageRef = ref(storage, `gallery/${fileName}`);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  });

  return Promise.all(uploadPromises);
}

// ─── Seed Gallery if Empty ───────────────────────────────────────────
export async function seedGalleryIfEmpty(): Promise<void> {
  if (isGallerySeeded) return;
  try {
    const colRef = collection(db, GALLERY_COLLECTION);
    const snap = await getDocs(colRef);
    if (snap.empty) {
      console.log("[firebaseGallery] Seeding initial gallery albums into Firestore...");
      for (const album of INITIAL_GALLERY_ALBUMS) {
        const docRef = doc(db, GALLERY_COLLECTION, album.id);
        await setDoc(docRef, album, { merge: true });
      }
    }
    isGallerySeeded = true;
  } catch (err) {
    console.error("[firebaseGallery] Failed to seed gallery collection:", err);
  }
}

// ─── Realtime Listener ────────────────────────────────────────────────
export function subscribeToGallery(
  callback: (albums: GalleryAlbum[]) => void
): () => void {
  seedGalleryIfEmpty();

  const colRef = collection(db, GALLERY_COLLECTION);
  const q = query(colRef);

  return onSnapshot(
    q,
    (snapshot) => {
      let list: GalleryAlbum[] = [];
      if (!snapshot.empty) {
        list = snapshot.docs.map((d) => ({
          ...(d.data() as GalleryAlbum),
          id: d.id,
        }));
      } else {
        list = INITIAL_GALLERY_ALBUMS;
      }

      // Sort by creation or updated date descending
      list.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      callback(list);
    },
    (err) => {
      console.error("[firebaseGallery] Realtime subscription error:", err);
      callback(INITIAL_GALLERY_ALBUMS);
    }
  );
}

// ─── Add Gallery Album ───────────────────────────────────────────────
export async function addGalleryItem(
  data: Omit<GalleryAlbum, "id"> & { id?: string }
): Promise<GalleryAlbum> {
  const albumId = data.id || `album-${Date.now()}`;
  const docRef = doc(db, GALLERY_COLLECTION, albumId);
  const now = new Date().toISOString();

  const payload: GalleryAlbum = {
    ...data,
    id: albumId,
    coverImage: data.coverImage || (data.images && data.images[0]) || "",
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, payload, { merge: true });
  return payload;
}

// ─── Update Gallery Album ────────────────────────────────────────────
export async function updateGalleryItem(
  id: string,
  data: Partial<GalleryAlbum>
): Promise<void> {
  const docRef = doc(db, GALLERY_COLLECTION, id);
  const payload = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(docRef, payload, { merge: true });
}

// ─── Delete Gallery Album ────────────────────────────────────────────
export async function deleteGalleryItem(
  id: string,
  images: string[] = []
): Promise<void> {
  const docRef = doc(db, GALLERY_COLLECTION, id);
  await deleteDoc(docRef);

  // Clean up photos from Firebase Storage
  for (const imgUrl of images) {
    if (imgUrl && imgUrl.includes("firebasestorage.googleapis.com")) {
      try {
        const imageRef = ref(storage, imgUrl);
        await deleteObject(imageRef);
      } catch (e) {
        console.warn("[firebaseGallery] Could not delete image from Storage:", e);
      }
    }
  }
}
