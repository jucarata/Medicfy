import nodemailer from 'nodemailer';
import * as store from './store.js';

let transporter = null;

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function getNotifyEmail() {
  return store.getSetting('alert_email', '') || process.env.NOTIFY_EMAIL || '';
}

export function isConfigured() {
  return isSmtpConfigured() && Boolean(getNotifyEmail());
}

function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendToNotifyEmail(subject, text) {
  const transport = getTransporter();
  const to = getNotifyEmail();
  if (!transport || !to) return false;

  try {
    await transport.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error('[email] No se pudo enviar:', err.message);
    return false;
  }
}

export async function notifyFailure({ schedule, error, whatsappStatus }) {
  if (!isConfigured()) {
    console.warn('[email] Alertas no configuradas — no se envió notificación');
    return false;
  }

  const time = schedule?.time || '—';
  const message = schedule?.message || '—';
  const subject = 'MedicFy: falló un recordatorio de WhatsApp';

  const body = `
MedicFy no pudo enviar un recordatorio.

Horario: ${time}
Mensaje: ${message}
Estado de WhatsApp: ${whatsappStatus}
Error: ${error}

Posibles causas:
- La sesión de WhatsApp expiró (vuelve a escanear el QR en la app)
- El teléfono está sin internet
- El número destino es incorrecto

— MedicFy
`.trim();

  const sent = await sendToNotifyEmail(subject, body);
  if (sent) console.log('[email] Notificación de fallo enviada');
  return sent;
}

export async function notifyDisconnected() {
  if (!isConfigured()) return false;

  const port = process.env.PORT || 4321;
  return sendToNotifyEmail(
    'MedicFy: WhatsApp desconectado',
    `La sesión de WhatsApp se desconectó. Abre MedicFy y escanea el QR de nuevo.\n\nhttp://localhost:${port}`
  );
}
