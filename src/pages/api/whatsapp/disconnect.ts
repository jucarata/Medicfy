import type { APIRoute } from 'astro';
import * as whatsapp from '../../../lib/server/whatsapp.js';
import { json } from '../../../lib/server/api.js';

export const POST: APIRoute = async () => {
  await whatsapp.disconnectSession();
  return json({ ok: true, whatsapp: whatsapp.getState() });
};
