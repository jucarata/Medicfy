import {
  buildRecipientPhone,
  DEFAULT_COUNTRY_DIAL,
  parseRecipientPhone,
} from '../lib/countryCodes.ts';
import {
  createSchedule,
  deleteSchedule,
  getSchedules,
  getSetting,
  setSetting,
  syncToServer,
  updateSchedule,
  type Schedule,
} from '../lib/client/idb.ts';

const STATUS_CONNECTED = 'Conectado';
const STATUS_DISCONNECTED = 'Desconectado';

let recipientEditing = false;
let alertEmailEditing = false;

function showToast(message: string, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Error de servidor');
  return data as T;
}

interface StatusResponse {
  whatsapp: {
    status: string;
    statusDetail: string;
    qr?: string;
    connectedNumber?: string;
  };
  email: { smtpConfigured: boolean; configured: boolean };
}

interface LogEntry {
  status: string;
  sent_at: string;
  time?: string;
  message?: string;
  error?: string;
}

function isRecipientFieldFocused(): boolean {
  const active = document.activeElement;
  return (
    active?.id === 'recipient-country' ||
    active?.id === 'recipient-input'
  );
}

function setRecipientFields(dial: string, number: string) {
  const countrySelect = document.getElementById('recipient-country') as HTMLSelectElement | null;
  const recipientInput = document.getElementById('recipient-input') as HTMLInputElement | null;

  if (countrySelect) countrySelect.value = dial;
  if (recipientInput) recipientInput.value = number;
}

function isAlertEmailFieldFocused(): boolean {
  return document.activeElement?.id === 'alert-email-input';
}

function updateAlertEmailUI(hasAlertEmail: boolean) {
  const locked = hasAlertEmail && !alertEmailEditing;
  const input = document.getElementById('alert-email-input') as HTMLInputElement | null;
  const saveBtn = document.getElementById('save-alert-email');
  const editBtn = document.getElementById('edit-alert-email');
  const emailRow = document.querySelector('.email-row');

  input?.toggleAttribute('disabled', locked);
  saveBtn?.classList.toggle('hidden', locked);
  editBtn?.classList.toggle('hidden', !hasAlertEmail || alertEmailEditing);
  emailRow?.classList.toggle('recipient-locked', locked);
}

function enterAlertEmailEditMode() {
  alertEmailEditing = true;
  updateAlertEmailUI(true);
  (document.getElementById('alert-email-input') as HTMLInputElement | null)?.focus();
}

function getAlertEmailValue(): string {
  return (document.getElementById('alert-email-input') as HTMLInputElement).value.trim();
}

function updateRecipientUI(hasRecipient: boolean) {
  const locked = hasRecipient && !recipientEditing;
  const countrySelect = document.getElementById('recipient-country') as HTMLSelectElement | null;
  const recipientInput = document.getElementById('recipient-input') as HTMLInputElement | null;
  const saveBtn = document.getElementById('save-recipient');
  const editBtn = document.getElementById('edit-recipient');
  const phoneRow = document.querySelector('.phone-row');

  countrySelect?.toggleAttribute('disabled', locked);
  recipientInput?.toggleAttribute('disabled', locked);
  saveBtn?.classList.toggle('hidden', locked);
  editBtn?.classList.toggle('hidden', !hasRecipient || recipientEditing);
  phoneRow?.classList.toggle('recipient-locked', locked);
}

function enterRecipientEditMode() {
  recipientEditing = true;
  updateRecipientUI(true);
  (document.getElementById('recipient-input') as HTMLInputElement | null)?.focus();
}

function getRecipientPhone(): string {
  const countrySelect = document.getElementById('recipient-country') as HTMLSelectElement;
  const recipientInput = document.getElementById('recipient-input') as HTMLInputElement;
  return buildRecipientPhone(countrySelect.value, recipientInput.value.trim());
}

function shouldShowStatusReason(status: string, detail: string): boolean {
  if (status === 'error' || status === 'auth_failure') return Boolean(detail);
  if (status !== 'disconnected') return false;

  const ignored = [
    'Iniciando cliente de WhatsApp…',
    'Sin sesión activa',
    'Desconectando sesión…',
  ];
  return Boolean(detail) && !ignored.includes(detail);
}

function updateStatus(
  whatsapp: StatusResponse['whatsapp'],
  email: StatusResponse['email'],
  recipient: string,
  alertEmail: string
) {
  const badge = document.getElementById('status-badge');
  const statusDetailEl = document.getElementById('status-detail');
  const qrContainer = document.getElementById('qr-container');
  const qrWaiting = document.getElementById('qr-waiting');
  const qrImage = document.getElementById('qr-image') as HTMLImageElement | null;
  const numberEl = document.getElementById('connected-number');
  const emailSmtpHint = document.getElementById('email-smtp-hint');
  const alertEmailInput = document.getElementById('alert-email-input') as HTMLInputElement | null;

  const isConnected = whatsapp.status === 'ready';

  if (badge) {
    badge.textContent = isConnected ? STATUS_CONNECTED : STATUS_DISCONNECTED;
    badge.className = `badge ${isConnected ? 'connected' : 'disconnected'}`;
  }

  if (statusDetailEl) {
    const showReason = shouldShowStatusReason(whatsapp.status, whatsapp.statusDetail || '');
    statusDetailEl.textContent = showReason ? whatsapp.statusDetail : '';
    statusDetailEl.classList.toggle('hidden', !showReason);
  }

  const disconnectSection = document.getElementById('disconnect-section');
  disconnectSection?.classList.toggle('hidden', !isConnected);

  const showQr = !isConnected && !!whatsapp.qr;

  if (qrContainer && qrImage) {
    qrContainer.classList.toggle('hidden', !showQr);
    if (showQr) qrImage.src = whatsapp.qr!;
  }

  if (qrWaiting) {
    const waitingText =
      whatsapp.status === 'authenticated'
        ? 'Conectando con sesión guardada…'
        : 'Generando código QR…';
    qrWaiting.textContent = waitingText;
    qrWaiting.classList.toggle('hidden', isConnected || showQr);
  }

  if (numberEl) {
    numberEl.textContent = whatsapp.connectedNumber
      ? `Tu número: +${whatsapp.connectedNumber}`
      : '';
  }

  const hasRecipient = Boolean(recipient?.replace(/\D/g, ''));

  if (!recipientEditing && (hasRecipient || !isRecipientFieldFocused())) {
    const { dial, number } = parseRecipientPhone(recipient || '');
    setRecipientFields(dial || DEFAULT_COUNTRY_DIAL, number);
  }

  updateRecipientUI(hasRecipient);

  const hasAlertEmail = Boolean(alertEmail?.trim());

  if (!alertEmailEditing && (hasAlertEmail || !isAlertEmailFieldFocused())) {
    if (alertEmailInput) alertEmailInput.value = alertEmail || '';
  }

  updateAlertEmailUI(hasAlertEmail);

  const testSendSection = document.getElementById('test-send-section');
  testSendSection?.classList.toggle('hidden', !(isConnected && hasRecipient));

  if (emailSmtpHint) {
    if (!hasAlertEmail) {
      emailSmtpHint.textContent = 'Guarda el correo destino arriba para activar las alertas.';
    } else if (email.configured) {
      emailSmtpHint.textContent = 'Alertas por correo activas.';
    } else {
      emailSmtpHint.textContent = '';
    }
  }
}

function escapeHtml(str: string) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function renderSchedules(schedules: Schedule[]) {
  const list = document.getElementById('schedule-list');
  if (!list) return;

  if (!schedules.length) {
    list.innerHTML = '<li class="hint notification-empty">No hay notificaciones programadas.</li>';
    return;
  }

  list.innerHTML = schedules
    .map(
      (s) => `
    <li class="notification-box${s.enabled ? '' : ' notification-disabled'}" data-id="${s.id}">
      <button type="button" class="notification-delete delete-schedule" aria-label="Eliminar notificación" title="Eliminar">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
      <div class="notification-box-main">
        <span class="notification-box-time">${s.time}</span>
        <span class="notification-box-sep" aria-hidden="true">|</span>
        <p class="notification-box-message">${escapeHtml(s.message)}</p>
      </div>
      <label class="notification-enable">
        <input type="checkbox" class="toggle-schedule" ${s.enabled ? 'checked' : ''}>
        <span>${s.enabled ? 'Activa — se envía todos los días' : 'Pausada — no se enviará'}</span>
      </label>
    </li>
  `
    )
    .join('');
}

function renderLogs(logs: LogEntry[]) {
  const list = document.getElementById('log-list');
  if (!list) return;

  if (!logs.length) {
    list.innerHTML = '<li class="hint">Sin envíos aún.</li>';
    return;
  }

  list.innerHTML = logs
    .map((l) => {
      const label = l.status === 'sent' ? 'Enviado' : 'Falló';
      const detail = l.time ? `${l.time} — ${l.message}` : 'Mensaje de prueba';
      const err = l.error ? ` (${l.error})` : '';
      return `<li class="${l.status}">${l.sent_at} · ${label}: ${escapeHtml(detail || '')}${escapeHtml(err)}</li>`;
    })
    .join('');
}

async function refresh() {
  try {
    const status = await api<StatusResponse>('/api/status');
    const [recipient, alertEmail, schedules, logs] = await Promise.all([
      getSetting('recipient_phone', ''),
      getSetting('alert_email', ''),
      getSchedules(),
      api<LogEntry[]>('/api/logs'),
    ]);

    updateStatus(status.whatsapp, status.email, recipient, alertEmail);
    renderSchedules(schedules);
    renderLogs(logs);
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('edit-alert-email')?.addEventListener('click', enterAlertEmailEditMode);

document.getElementById('save-alert-email')?.addEventListener('click', async () => {
  const email = getAlertEmailValue().toLowerCase();
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRe.test(email)) {
    showToast('Correo inválido', true);
    return;
  }

  try {
    await setSetting('alert_email', email);
    await syncToServer();
    alertEmailEditing = false;
    updateAlertEmailUI(true);
    showToast('Correo de alertas guardado');
    await refresh();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Error', true);
  }
});

document.getElementById('edit-recipient')?.addEventListener('click', enterRecipientEditMode);

document.getElementById('save-recipient')?.addEventListener('click', async () => {
  const phone = getRecipientPhone().replace(/\D/g, '');

  if (phone.length < 10) {
    showToast('Número inválido (incluye código de país)', true);
    return;
  }

  try {
    await setSetting('recipient_phone', phone);
    await syncToServer();
    recipientEditing = false;
    updateRecipientUI(true);
    showToast('Número destino guardado');
    await refresh();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Error', true);
  }
});

document.getElementById('schedule-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const time = (document.getElementById('schedule-time') as HTMLInputElement).value;
  const messageInput = document.getElementById('schedule-message') as HTMLInputElement;
  const message = messageInput.value.trim();

  if (!/^\d{2}:\d{2}$/.test(time)) {
    showToast('La hora debe tener formato HH:MM', true);
    return;
  }

  try {
    await createSchedule(time, message);
    await syncToServer();
    messageInput.value = '';
    showToast('Horario agregado');
    await refresh();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Error', true);
  }
});

document.getElementById('schedule-list')?.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.delete-schedule')) return;

  const li = target.closest('li[data-id]') as HTMLElement | null;
  if (!li) return;
  const id = Number(li.dataset.id);

  try {
    const deleted = await deleteSchedule(id);
    if (!deleted) {
      showToast('No se encontró la notificación', true);
      await refresh();
      return;
    }
    await syncToServer();
    showToast('Notificación eliminada');
    await refresh();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Error', true);
  }
});

document.getElementById('schedule-list')?.addEventListener('change', async (e) => {
  const target = e.target as HTMLInputElement;
  if (!target.classList.contains('toggle-schedule')) return;
  const li = target.closest('li[data-id]') as HTMLElement;
  const id = Number(li.dataset.id);

  try {
    await updateSchedule(id, { enabled: target.checked ? 1 : 0 });
    await syncToServer();
    const schedules = await getSchedules();
    renderSchedules(schedules);
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Error', true);
    await refresh();
  }
});

document.getElementById('disconnect-wa')?.addEventListener('click', async () => {
  if (!confirm('¿Desconectar WhatsApp? Tendrás que escanear el QR de nuevo.')) return;

  try {
    await api('/api/whatsapp/disconnect', { method: 'POST', body: '{}' });
    showToast('WhatsApp desconectado');
    await refresh();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Error', true);
    await refresh();
  }
});

document.getElementById('test-send')?.addEventListener('click', async () => {
  try {
    await api('/api/test-send', { method: 'POST', body: '{}' });
    showToast('Mensaje de prueba enviado');
    refresh();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Error', true);
    refresh();
  }
});

async function init() {
  try {
    await syncToServer();
  } catch (err) {
    console.error('Sync inicial:', err);
  }
  await refresh();
  setInterval(() => refresh(), 5000);
}

init();
