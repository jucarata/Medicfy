import type { APIRoute } from 'astro';
import * as store from '../../../lib/server/store.js';
import { json, error } from '../../../lib/server/api.js';

export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const body = await request.json();
  const updated = store.updateSchedule(id, body);

  if (!updated) return error('No encontrado', 404);
  return json(updated);
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  const ok = store.deleteSchedule(id);

  if (!ok) return error('No encontrado', 404);
  return json({ ok: true });
};
