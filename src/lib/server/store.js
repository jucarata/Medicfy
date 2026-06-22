import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.js';

const STORE_PATH = path.join(DATA_DIR, 'store.json');

const DEFAULT_STORE = {
  settings: {},
  schedules: [],
  send_log: [],
};

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, item.id ?? 0), 0) + 1;
}

function normalizeStore(raw) {
  const store = { ...structuredClone(DEFAULT_STORE), ...raw };
  delete store.nextScheduleId;
  delete store.nextLogId;
  return store;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore() {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    return structuredClone(DEFAULT_STORE);
  }
  try {
    return normalizeStore(JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')));
  } catch {
    return structuredClone(DEFAULT_STORE);
  }
}

function saveStore(store) {
  ensureDataDir();
  const normalized = normalizeStore(store);
  fs.writeFileSync(STORE_PATH, JSON.stringify(normalized, null, 2), 'utf8');
}

function withStore(mutator) {
  const store = loadStore();
  const result = mutator(store);
  saveStore(store);
  return result;
}

export function getSetting(key, defaultValue = '') {
  const store = loadStore();
  return store.settings[key] ?? defaultValue;
}

export function setSetting(key, value) {
  return withStore((store) => {
    store.settings[key] = value;
  });
}

export function getAllSettings() {
  const store = loadStore();
  return { ...store.settings };
}

export function replaceSettings(settings) {
  return withStore((store) => {
    store.settings = { ...settings };
  });
}

export function getSchedules() {
  return loadStore().schedules.slice().sort((a, b) => a.time.localeCompare(b.time));
}

export function replaceSchedules(schedules) {
  return withStore((store) => {
    store.schedules = schedules.map((s) => ({
      id: s.id,
      time: s.time,
      message: s.message,
      enabled: s.enabled ?? 1,
      created_at: s.created_at || new Date().toISOString(),
    }));
  });
}

export function getSchedule(id) {
  return loadStore().schedules.find((s) => s.id === id) || null;
}

export function createSchedule(time, message) {
  return withStore((store) => {
    const schedule = {
      id: nextId(store.schedules),
      time,
      message,
      enabled: 1,
      created_at: new Date().toISOString(),
    };
    store.schedules.push(schedule);
    return schedule;
  });
}

export function updateSchedule(id, { time, message, enabled }) {
  return withStore((store) => {
    const index = store.schedules.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const existing = store.schedules[index];
    const updated = {
      ...existing,
      time: time ?? existing.time,
      message: message ?? existing.message,
      enabled: enabled ?? existing.enabled,
    };
    store.schedules[index] = updated;
    return updated;
  });
}

export function deleteSchedule(id) {
  return withStore((store) => {
    const before = store.schedules.length;
    store.schedules = store.schedules.filter((s) => s.id !== id);
    return store.schedules.length < before;
  });
}

export function logSend(scheduleId, status, error = null) {
  return withStore((store) => {
    store.send_log.unshift({
      id: nextId(store.send_log),
      schedule_id: scheduleId,
      status,
      error,
      sent_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
    if (store.send_log.length > 200) {
      store.send_log.length = 200;
    }
  });
}

export function getRecentLogs(limit = 20) {
  const store = loadStore();
  return store.send_log.slice(0, limit).map((log) => {
    const schedule = store.schedules.find((s) => s.id === log.schedule_id);
    return {
      ...log,
      time: schedule?.time,
      message: schedule?.message,
    };
  });
}

export function syncFromClient({ settings, schedules }) {
  return withStore((store) => {
    if (settings && typeof settings === 'object') {
      store.settings = { ...settings };
    }
    if (Array.isArray(schedules)) {
      store.schedules = schedules.map((s) => ({
        id: s.id,
        time: s.time,
        message: s.message,
        enabled: s.enabled ?? 1,
        created_at: s.created_at || new Date().toISOString(),
      }));
    }
  });
}

export function getFullStore() {
  return loadStore();
}

export function clearTable(tableKey) {
  const current = loadStore();
  if (!(tableKey in current)) {
    return { ok: false, error: 'Tabla no válida' };
  }

  return withStore((store) => {
    const value = store[tableKey];

    if (Array.isArray(value)) {
      store[tableKey] = [];
    } else if (value !== null && typeof value === 'object') {
      store[tableKey] = {};
    } else {
      return { ok: false, error: 'Tabla no válida' };
    }

    return { ok: true };
  });
}
