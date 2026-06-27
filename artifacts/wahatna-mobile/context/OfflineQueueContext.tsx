import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiBase } from "@/constants/env";

const QUEUE_KEY = "wahatna_offline_queue";

export type QueueItemStatus = "pending" | "syncing" | "synced" | "failed";

export interface QueuePayload {
  lat: number;
  lon: number;
  reportText: string;
  category: string;
  imageUri?: string;
  phone_primary?: string;
  phone_secondary?: string;
  address_details?: string;
  location_source?: string;
}

export interface QueueItem {
  id: string;
  createdAt: string;
  status: QueueItemStatus;
  errorMessage?: string;
  payload: QueuePayload;
}

interface DuplicateWarning {
  messageKey: string;
  existingId: string;
}

interface OfflineQueueContextValue {
  queue: QueueItem[];
  pendingCount: number;
  addToQueue: (payload: QueuePayload, opts?: { force?: boolean }) => Promise<{ id: string; duplicate?: DuplicateWarning }>;
  retryAll: (token: string) => Promise<void>;
  clearSynced: () => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);

async function persistQueue(q: QueueItem[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

async function loadQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as QueueItem[]; } catch { return []; }
}

/** Returns true if two coordinates are within 0.001° (~100 m) of each other. */
function nearbyCoords(a: { lat: number; lon: number }, b: { lat: number; lon: number }): boolean {
  return Math.abs(a.lat - b.lat) < 0.001 && Math.abs(a.lon - b.lon) < 0.001;
}

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);

  useEffect(() => {
    loadQueue().then(q => { setQueue(q); queueRef.current = q; });
  }, []);

  const updateQueue = useCallback(async (newQ: QueueItem[]) => {
    queueRef.current = newQ;
    setQueue([...newQ]);
    await persistQueue(newQ);
  }, []);

  const addToQueue = useCallback(async (payload: QueuePayload, opts?: { force?: boolean }): Promise<{ id: string; duplicate?: DuplicateWarning }> => {
    if (!opts?.force) {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const duplicate = queueRef.current.find(item => {
        if (item.status === "synced") return false;
        if (item.payload.category !== payload.category) return false;
        if (new Date(item.createdAt).getTime() < fiveMinutesAgo) return false;
        return nearbyCoords(item.payload, payload);
      });

      if (duplicate) {
        return {
          id: duplicate.id,
          duplicate: {
            messageKey: "err_duplicate_report",
            existingId: duplicate.id,
          },
        };
      }
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: QueueItem = { id, createdAt: new Date().toISOString(), status: "pending", payload };
    await updateQueue([...queueRef.current, item]);
    return { id };
  }, [updateQueue]);

  const retryAll = useCallback(async (token: string) => {
    const pending = queueRef.current.filter(i => i.status === "pending" || i.status === "failed");
    if (!pending.length) return;

    const base = apiBase();

    for (const item of pending) {
      const current = queueRef.current.map(i => i.id === item.id ? { ...i, status: "syncing" as QueueItemStatus } : i);
      await updateQueue(current);

      try {
        const formData = new FormData();
        formData.append("lat", String(item.payload.lat));
        formData.append("lon", String(item.payload.lon));
        formData.append("report_text", item.payload.reportText);
        formData.append("category", item.payload.category);
        if (item.payload.phone_primary) formData.append("phone_primary", item.payload.phone_primary);
        if (item.payload.phone_secondary) formData.append("phone_secondary", item.payload.phone_secondary);
        if (item.payload.address_details) formData.append("address_details", item.payload.address_details);
        if (item.payload.location_source) formData.append("location_source", item.payload.location_source);
        if (item.payload.imageUri) {
          const ext = item.payload.imageUri.split(".").pop() ?? "jpg";
          formData.append("image", { uri: item.payload.imageUri, name: `photo.${ext}`, type: `image/${ext}` } as unknown as Blob);
        }
        const res = await fetch(`${base}/report`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const done = queueRef.current.map(i => i.id === item.id ? { ...i, status: "synced" as QueueItemStatus } : i);
        await updateQueue(done);
      } catch (e: unknown) {
        const fail = queueRef.current.map(i => i.id === item.id ? { ...i, status: "failed" as QueueItemStatus, errorMessage: (e as Error).message } : i);
        await updateQueue(fail);
      }
    }
  }, [updateQueue]);

  const clearSynced = useCallback(async () => {
    await updateQueue(queueRef.current.filter(i => i.status !== "synced"));
  }, [updateQueue]);

  const pendingCount = queue.filter(i => i.status === "pending" || i.status === "failed").length;

  return (
    <OfflineQueueContext.Provider value={{ queue, pendingCount, addToQueue, retryAll, clearSynced }}>
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue() {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) throw new Error("useOfflineQueue must be inside OfflineQueueProvider");
  return ctx;
}
