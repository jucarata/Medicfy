import type { APIRoute } from 'astro';
import * as store from '../../../lib/server/store.js';
import { json, error } from '../../../lib/server/api.js';

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { phone } = body;

  if (!phone) {
    return error('Número destino obligatorio');
  }

  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 10) {
    return error('Número inválido (incluye código de país)');
  }

  store.setSetting('recipient_phone', cleaned);
  return json({ phone: cleaned });
};
