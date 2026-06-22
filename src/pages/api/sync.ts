import type { APIRoute } from 'astro';
import * as store from '../../lib/server/store.js';
import { json, error } from '../../lib/server/api.js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { settings, schedules } = body;

  if (!settings || typeof settings !== 'object') {
    return error('Configuración inválida');
  }

  if (!Array.isArray(schedules)) {
    return error('Horarios inválidos');
  }

  store.syncFromClient({ settings, schedules });
  return json({ ok: true });
};
