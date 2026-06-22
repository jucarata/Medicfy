import type { APIRoute } from 'astro';
import * as store from '../../../lib/server/store.js';
import { json, error } from '../../../lib/server/api.js';

export const GET: APIRoute = () => {
  return json(store.getSchedules());
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { time, message } = body;

  if (!time || !message) {
    return error('Hora y mensaje son obligatorios');
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return error('La hora debe tener formato HH:MM (ej: 08:00)');
  }

  const schedule = store.createSchedule(time, message.trim());
  return json(schedule, 201);
};
