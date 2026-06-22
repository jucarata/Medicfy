const DB_NAME = 'medicfy';
const DB_VERSION = 1;

export interface Schedule {
  id: number;
  time: string;
  message: string;
  enabled: number;
  created_at: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
      if (!db.objectStoreNames.contains('schedules')) {
        db.createObjectStore('schedules', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = fn(store);

        transaction.oncomplete = () => {
          if (request instanceof IDBRequest) {
            resolve(request.result);
          } else {
            resolve(undefined);
          }
        };
        transaction.onerror = () => reject(transaction.error);
      })
  );
}

export async function getSetting(key: string, defaultValue = ''): Promise<string> {
  const value = await tx<string>('settings', 'readonly', (store) => store.get(key));
  return typeof value === 'string' ? value : defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await tx('settings', 'readwrite', (store) => store.put(value, key));
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.openCursor();
    const settings: Record<string, string> = {};

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        settings[cursor.key as string] = cursor.value as string;
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve(settings);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getSchedules(): Promise<Schedule[]> {
  const schedules = await tx<Schedule[]>('schedules', 'readonly', (store) => store.getAll());
  return (schedules || []).sort((a, b) => a.time.localeCompare(b.time));
}

async function getNextScheduleId(): Promise<number> {
  const schedules = await getSchedules();
  const maxId = schedules.reduce((max, schedule) => Math.max(max, schedule.id), 0);
  return maxId + 1;
}

export async function createSchedule(time: string, message: string): Promise<Schedule> {
  const id = await getNextScheduleId();
  const schedule: Schedule = {
    id,
    time,
    message,
    enabled: 1,
    created_at: new Date().toISOString(),
  };
  await tx('schedules', 'readwrite', (store) => store.put(schedule));
  return schedule;
}

export async function updateSchedule(
  id: number,
  patch: Partial<Pick<Schedule, 'time' | 'message' | 'enabled'>>
): Promise<Schedule | null> {
  const existing = await tx<Schedule>('schedules', 'readonly', (store) => store.get(id));
  if (!existing) return null;

  const updated: Schedule = {
    ...existing,
    time: patch.time ?? existing.time,
    message: patch.message ?? existing.message,
    enabled: patch.enabled ?? existing.enabled,
  };

  await tx('schedules', 'readwrite', (store) => store.put(updated));
  return updated;
}

export async function deleteSchedule(id: number): Promise<boolean> {
  const existing = await tx<Schedule>('schedules', 'readonly', (store) => store.get(id));
  if (!existing) return false;
  await tx('schedules', 'readwrite', (store) => store.delete(id));
  return true;
}

export async function syncToServer(): Promise<void> {
  const [settings, schedules] = await Promise.all([getAllSettings(), getSchedules()]);
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, schedules }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Error al sincronizar');
  }
}
