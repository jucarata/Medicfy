import cron from 'node-cron';
import * as store from './store.js';
import * as whatsapp from './whatsapp.js';
import { notifyFailure } from './email.js';

const sentToday = new Map();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function scheduleKey(scheduleId, time) {
  return `${todayKey()}:${scheduleId}:${time}`;
}

function wasSentToday(scheduleId, time) {
  return sentToday.has(scheduleKey(scheduleId, time));
}

function markSentToday(scheduleId, time) {
  sentToday.set(scheduleKey(scheduleId, time), true);

  if (sentToday.size > 50) {
    const today = todayKey();
    for (const key of sentToday.keys()) {
      if (!key.startsWith(today)) sentToday.delete(key);
    }
  }
}

async function processSchedule(schedule) {
  if (!schedule.enabled) return;

  const recipient = store.getSetting('recipient_phone');
  if (!recipient) {
    console.warn('[scheduler] No hay número destino configurado');
    return;
  }

  if (wasSentToday(schedule.id, schedule.time)) return;

  const state = whatsapp.getState();

  try {
    await whatsapp.sendMessage(recipient, schedule.message);
    markSentToday(schedule.id, schedule.time);
    store.logSend(schedule.id, 'sent');
    console.log(`[scheduler] Enviado recordatorio de las ${schedule.time}`);
  } catch (err) {
    store.logSend(schedule.id, 'failed', err.message);
    console.error(`[scheduler] Falló recordatorio de las ${schedule.time}:`, err.message);

    await notifyFailure({
      schedule,
      error: err.message,
      whatsappStatus: state.status,
    });
  }
}

function getCurrentTime() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: process.env.TZ || undefined,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const hour = parts.find((p) => p.type === 'hour').value;
  const minute = parts.find((p) => p.type === 'minute').value;
  return `${hour}:${minute}`;
}

export function startScheduler() {
  cron.schedule('* * * * *', () => {
    const currentTime = getCurrentTime();
    const schedules = store.getSchedules().filter((s) => s.enabled && s.time === currentTime);
    schedules.forEach((schedule) => {
      processSchedule(schedule);
    });
  });

  console.log(`[scheduler] Activo (zona: ${process.env.TZ || 'sistema'})`);
}

export { processSchedule };
