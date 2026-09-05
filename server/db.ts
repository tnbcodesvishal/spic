import path from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: any;

export function getServiceAccount(): any | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (err) {
      console.warn("[db] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env var.");
      return null;
    }
  }

  const keyPath = path.join(__dirname, "firebase-service-account.json");
  if (!existsSync(keyPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(keyPath, "utf-8"));
  } catch (err) {
    console.warn("[db] Failed to read firebase-service-account.json.");
    return null;
  }
}

// ─── Local Mock Firestore Fallback ──────────────────────────────────────────
class MockDocRef {
  id: string;
  private collectionMap: Map<string, any>;
  private saveCallback: () => void;

  constructor(id: string, collectionMap: Map<string, any>, saveCallback: () => void) {
    this.id = id;
    this.collectionMap = collectionMap;
    this.saveCallback = saveCallback;
  }

  async get() {
    const data = this.collectionMap.get(this.id);
    return {
      exists: !!data,
      id: this.id,
      data: () => (data ? { ...data } : undefined),
    };
  }

  async set(data: any, options?: { merge?: boolean }) {
    if (options?.merge && this.collectionMap.has(this.id)) {
      const existing = this.collectionMap.get(this.id);
      this.collectionMap.set(this.id, { ...existing, ...data });
    } else {
      this.collectionMap.set(this.id, { ...data });
    }
    this.saveCallback();
  }

  async update(data: any) {
    const existing = this.collectionMap.get(this.id) || {};
    this.collectionMap.set(this.id, { ...existing, ...data });
    this.saveCallback();
  }

  async delete() {
    this.collectionMap.delete(this.id);
    this.saveCallback();
  }
}

class MockQuery {
  private items: Array<{ id: string; data: any }>;
  private filters: Array<{ field: string; op: string; val: any }> = [];
  private sortField?: string;
  private sortDir: "asc" | "desc" = "asc";
  private limitVal?: number;

  constructor(items: Array<{ id: string; data: any }>) {
    this.items = items;
  }

  where(field: string, op: string, val: any) {
    const q = new MockQuery(this.items);
    q.filters = [...this.filters, { field, op, val }];
    q.sortField = this.sortField;
    q.sortDir = this.sortDir;
    q.limitVal = this.limitVal;
    return q;
  }

  orderBy(field: string, dir: "asc" | "desc" = "asc") {
    const q = new MockQuery(this.items);
    q.filters = [...this.filters];
    q.sortField = field;
    q.sortDir = dir;
    q.limitVal = this.limitVal;
    return q;
  }

  limit(n: number) {
    const q = new MockQuery(this.items);
    q.filters = [...this.filters];
    q.sortField = this.sortField;
    q.sortDir = this.sortDir;
    q.limitVal = n;
    return q;
  }

  async get() {
    let result = this.items.filter(({ data }) => {
      return this.filters.every(({ field, op, val }) => {
        const itemVal = data[field];
        if (op === "==") return itemVal === val;
        if (op === "!=") return itemVal !== val;
        if (op === ">") return itemVal > val;
        if (op === ">=") return itemVal >= val;
        if (op === "<") return itemVal < val;
        if (op === "<=") return itemVal <= val;
        return true;
      });
    });

    if (this.sortField) {
      const sf = this.sortField;
      const mult = this.sortDir === "desc" ? -1 : 1;
      result.sort((a, b) => {
        if (a.data[sf] < b.data[sf]) return -1 * mult;
        if (a.data[sf] > b.data[sf]) return 1 * mult;
        return 0;
      });
    }

    if (this.limitVal !== undefined) {
      result = result.slice(0, this.limitVal);
    }

    const docs = result.map((item) => ({
      id: item.id,
      data: () => ({ ...item.data }),
    }));

    return {
      empty: docs.length === 0,
      docs,
    };
  }
}

class MockCollectionRef {
  private collectionMap: Map<string, any>;
  private saveCallback: () => void;

  constructor(collectionMap: Map<string, any>, saveCallback: () => void) {
    this.collectionMap = collectionMap;
    this.saveCallback = saveCallback;
  }

  doc(id: string) {
    return new MockDocRef(id, this.collectionMap, this.saveCallback);
  }

  where(field: string, op: string, val: any) {
    return this.toQuery().where(field, op, val);
  }

  orderBy(field: string, dir: "asc" | "desc" = "asc") {
    return this.toQuery().orderBy(field, dir);
  }

  limit(n: number) {
    return this.toQuery().limit(n);
  }

  async get() {
    return this.toQuery().get();
  }

  private toQuery() {
    const items = Array.from(this.collectionMap.entries()).map(([id, data]) => ({
      id,
      data,
    }));
    return new MockQuery(items);
  }
}

class MockFirestore {
  private collections = new Map<string, Map<string, any>>();
  private filePath = path.join(__dirname, "../data/local_db.json");

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, "utf-8");
        const json = JSON.parse(raw);
        for (const [colName, docs] of Object.entries(json)) {
          const map = new Map<string, any>();
          for (const [docId, data] of Object.entries(docs as any)) {
            map.set(docId, data);
          }
          this.collections.set(colName, map);
        }
      }
    } catch (err) {
      console.warn("[db] Could not load local_db.json, starting empty:", err);
    }
  }

  private saveData = () => {
    try {
      const targetPath = process.env.VERCEL ? path.join("/tmp", "local_db.json") : this.filePath;
      const dataDir = path.dirname(targetPath);
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }
      const json: Record<string, Record<string, any>> = {};
      for (const [colName, map] of this.collections.entries()) {
        json[colName] = {};
        for (const [docId, val] of map.entries()) {
          json[colName][docId] = val;
        }
      }
      writeFileSync(targetPath, JSON.stringify(json, null, 2), "utf-8");
    } catch (err: any) {
      console.warn("[db] Could not save local_db.json (retaining in-memory state):", err.message);
    }
  };

  collection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    return new MockCollectionRef(this.collections.get(name)!, this.saveData);
  }
}

export function getDb(): any {
  if (!db) {
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) {
      console.log("[db] No Firebase Service Account found. Using Mock Firestore.");
      db = new MockFirestore() as any;
    } else {
      try {
        const { initializeApp, cert, getApps } = require("firebase-admin/app");
        const { getFirestore } = require("firebase-admin/firestore");
        if (!getApps().length) {
          initializeApp({ credential: cert(serviceAccount) });
        }
        db = getFirestore();
      } catch (err: any) {
        console.warn("[db] firebase-admin init failed, using Mock Firestore fallback:", err.message);
        db = new MockFirestore() as any;
      }
    }
  }
  return db;
}

export const REGISTRATIONS = "registrations";
export const TEAM_REGISTRATIONS = "team_registrations";
