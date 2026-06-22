import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { notifyDisconnected } from './email.js';
import { SESSION_PATH } from './paths.js';

const { Client, LocalAuth } = pkg;

let client = null;
let status = 'disconnected';
let statusDetail = 'Iniciando cliente de WhatsApp…';
let qrDataUrl = null;
let connectedNumber = null;
let lastDisconnectNotified = false;
let reconnectTimer = null;
let skipDisconnectNotify = false;

const statusListeners = new Set();

function defaultDetailForStatus(nextStatus) {
  switch (nextStatus) {
    case 'qr':
      return 'Escanea el código QR con WhatsApp en tu teléfono';
    case 'authenticated':
      return 'Sesión autenticada, conectando…';
    case 'ready':
      return connectedNumber
        ? `Sesión activa (+${connectedNumber})`
        : 'Sesión activa';
    case 'auth_failure':
      return 'No se pudo autenticar la sesión';
    case 'error':
      return 'Error al iniciar el cliente de WhatsApp';
    default:
      return 'Sin sesión activa';
  }
}

function formatDisconnectReason(reason) {
  if (!reason) return 'WhatsApp cerró la sesión';
  if (typeof reason === 'string') return reason;
  if (typeof reason === 'object') {
    return reason.message || reason.reason || JSON.stringify(reason);
  }
  return String(reason);
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(delayMs = 3000) {
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    restartClient();
  }, delayMs);
}

function restartClient() {
  if (client) {
    client.destroy().catch(() => {});
    client = null;
  }
  qrDataUrl = null;
  connectedNumber = null;
  initClient();
}

function setStatus(newStatus, detail = null) {
  const nextDetail = detail ?? defaultDetailForStatus(newStatus);
  status = newStatus;
  statusDetail = nextDetail;
  statusListeners.forEach((fn) => fn(getState()));
}

export function onStatusChange(listener) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function getState() {
  return {
    status,
    statusDetail,
    qr: qrDataUrl,
    connectedNumber,
  };
}

function formatPhone(number) {
  const digits = number.replace(/\D/g, '');
  return digits.includes('@') ? digits : `${digits}@c.us`;
}

export function initClient() {
  if (client) return client;

  setStatus('disconnected', 'Iniciando cliente de WhatsApp…');

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', async (qr) => {
    qrDataUrl = await qrcode.toDataURL(qr);
    connectedNumber = null;
    lastDisconnectNotified = false;
    setStatus('qr');
    console.log('[whatsapp] Escanea el QR en la interfaz web');
  });

  client.on('authenticated', () => {
    qrDataUrl = null;
    setStatus('authenticated');
    console.log('[whatsapp] Autenticado');
  });

  client.on('ready', async () => {
    clearReconnectTimer();
    qrDataUrl = null;
    lastDisconnectNotified = false;
    try {
      const info = client.info;
      connectedNumber = info?.wid?.user || null;
    } catch {
      connectedNumber = null;
    }
    setStatus('ready');
    console.log('[whatsapp] Listo', connectedNumber ? `(${connectedNumber})` : '');
  });

  client.on('auth_failure', (msg) => {
    console.error('[whatsapp] Fallo de autenticación:', msg);
    qrDataUrl = null;
    setStatus('auth_failure', `Fallo de autenticación: ${msg}`);
    scheduleReconnect();
  });

  client.on('disconnected', async (reason) => {
    const detail = formatDisconnectReason(reason);
    console.warn('[whatsapp] Desconectado:', detail);
    connectedNumber = null;
    qrDataUrl = null;
    setStatus('disconnected', detail);

    const shouldNotify = !skipDisconnectNotify && !lastDisconnectNotified;
    skipDisconnectNotify = false;

    if (shouldNotify) {
      lastDisconnectNotified = true;
      await notifyDisconnected();
    }

    scheduleReconnect();
  });

  client.initialize().catch((err) => {
    console.error('[whatsapp] Error al iniciar:', err.message);
    qrDataUrl = null;
    setStatus('error', `Error al iniciar: ${err.message}`);
    scheduleReconnect();
  });

  return client;
}

export async function disconnectSession() {
  skipDisconnectNotify = true;
  clearReconnectTimer();

  if (!client) {
    setStatus('disconnected', 'Desconectado manualmente desde la app');
    scheduleReconnect();
    return;
  }

  try {
    setStatus('disconnected', 'Desconectando sesión…');
    await client.logout();
  } catch (err) {
    console.warn('[whatsapp] logout falló, destruyendo cliente:', err.message);
    await client.destroy().catch(() => {});
    client = null;
    qrDataUrl = null;
    connectedNumber = null;
    setStatus('disconnected', 'Desconectado manualmente desde la app');
    scheduleReconnect();
    return;
  }

  client = null;
  qrDataUrl = null;
  connectedNumber = null;
  setStatus('disconnected', 'Desconectado manualmente desde la app');
  scheduleReconnect();
}

export async function sendMessage(to, message) {
  if (status !== 'ready') {
    throw new Error(`WhatsApp no está listo (estado: ${status})`);
  }

  const chatId = formatPhone(to);
  await client.sendMessage(chatId, message);
}

export function destroyClient() {
  clearReconnectTimer();
  if (client) {
    client.destroy();
    client = null;
    qrDataUrl = null;
    setStatus('disconnected', 'Cliente detenido');
  }
}
