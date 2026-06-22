import type { APIRoute } from 'astro';
import * as store from '../../lib/server/store.js';
import * as whatsapp from '../../lib/server/whatsapp.js';
import { json, error } from '../../lib/server/api.js';

export const POST: APIRoute = async ({ request }) => {
  const recipient = store.getSetting('recipient_phone');
  if (!recipient) {
    return error('Configura primero el número destino');
  }

  const body = await request.json().catch(() => ({}));
  const message = body.message || 'Prueba de MedicFy — si ves esto, todo funciona.';

  try {
    await whatsapp.sendMessage(recipient, message);
    store.logSend(null, 'sent');
    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    store.logSend(null, 'failed', message);
    return error(message, 500);
  }
};
