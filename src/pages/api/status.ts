import type { APIRoute } from 'astro';
import * as whatsapp from '../../lib/server/whatsapp.js';
import { isConfigured, isSmtpConfigured } from '../../lib/server/email.js';
import { json } from '../../lib/server/api.js';

export const GET: APIRoute = () => {
  return json({
    whatsapp: whatsapp.getState(),
    email: {
      smtpConfigured: isSmtpConfigured(),
      configured: isConfigured(),
    },
  });
};
