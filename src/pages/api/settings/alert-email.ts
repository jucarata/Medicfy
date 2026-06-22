import type { APIRoute } from 'astro';
import * as store from '../../../lib/server/store.js';
import { json, error } from '../../../lib/server/api.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const email = String(body.email || '').trim().toLowerCase();

  if (!email) {
    return error('Correo de alertas obligatorio');
  }

  if (!EMAIL_RE.test(email)) {
    return error('Correo inválido');
  }

  store.setSetting('alert_email', email);
  return json({ email });
};
