type StoreRecord = Record<string, unknown>;

interface TableDef {
  key: string;
  label: string;
  type: 'object' | 'array' | 'scalar';
}

const TABLE_LABELS: Record<string, string> = {
  settings: 'Configuración',
  schedules: 'Horarios',
  send_log: 'Historial de envíos',
  whatsapp_log: 'Historial de WhatsApp',
};

const HIDDEN_TABLE_KEYS = new Set(['nextScheduleId', 'nextLogId']);

const loadingEl = document.getElementById('db-loading');
const errorEl = document.getElementById('db-error');
const tablesEl = document.getElementById('db-tables');
const refreshBtn = document.getElementById('db-refresh');

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getTableDefs(data: StoreRecord): TableDef[] {
  return Object.entries(data)
    .filter(([key]) => !HIDDEN_TABLE_KEYS.has(key))
    .map(([key, value]) => {
    let type: TableDef['type'] = 'scalar';
    if (Array.isArray(value)) type = 'array';
    else if (value !== null && typeof value === 'object') type = 'object';

    return {
      key,
      label: TABLE_LABELS[key] ?? key,
      type,
    };
  });
}

function renderObjectTable(rows: [string, unknown][]): string {
  if (rows.length === 0) {
    return '<p class="db-empty">Sin registros</p>';
  }

  const body = rows
    .map(
      ([key, value]) =>
        `<tr><td class="db-key">${escapeHtml(key)}</td><td>${escapeHtml(formatCell(value))}</td></tr>`
    )
    .join('');

  return `<table class="db-table"><thead><tr><th>Clave</th><th>Valor</th></tr></thead><tbody>${body}</tbody></table>`;
}

function renderArrayTable(rows: StoreRecord[]): string {
  if (rows.length === 0) {
    return '<p class="db-empty">Sin registros</p>';
  }

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const head = columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('');
  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => `<td>${escapeHtml(formatCell(row[col]))}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<div class="db-table-wrap"><table class="db-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderScalarTable(key: string, value: unknown): string {
  return renderObjectTable([[key, value]]);
}

function renderTableSection(def: TableDef, data: StoreRecord): string {
  const value = data[def.key];
  let content = '';

  if (def.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    content = renderObjectTable(Object.entries(value as StoreRecord));
  } else if (def.type === 'array') {
    content = renderArrayTable((value as StoreRecord[]) ?? []);
  } else {
    content = renderScalarTable(def.key, value);
  }

  const count =
    def.type === 'array'
      ? (value as unknown[]).length
      : def.type === 'object' && value && typeof value === 'object'
        ? Object.keys(value as StoreRecord).length
        : 1;

  return `
    <section class="card db-section">
      <div class="db-section-head">
        <div class="db-section-title">
          <h2>${escapeHtml(def.label)}</h2>
          <span class="db-count">${count} registro${count === 1 ? '' : 's'}</span>
        </div>
        <button
          type="button"
          class="danger small db-clear-btn"
          data-table="${escapeHtml(def.key)}"
          data-label="${escapeHtml(def.label)}"
        >
          Borrar registros
        </button>
      </div>
      <p class="db-table-name">${escapeHtml(def.key)}</p>
      ${content}
    </section>
  `;
}

function setLoading(isLoading: boolean) {
  loadingEl?.classList.toggle('hidden', !isLoading);
  if (isLoading) {
    tablesEl?.classList.add('hidden');
    errorEl?.classList.add('hidden');
  }
}

function showError(message: string, hideTables = true) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
  if (hideTables) {
    tablesEl?.classList.add('hidden');
  }
}

async function clearTable(tableKey: string, label: string) {
  const confirmed = window.confirm(
    `¿Borrar todos los registros de "${label}"?\n\nEsta acción no se puede deshacer.`
  );
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/admin/database/${encodeURIComponent(tableKey)}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error((data as { error?: string }).error || 'No se pudo borrar la tabla');
    }

    await loadDatabase();
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Error al borrar registros', false);
  }
}

tablesEl?.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('.db-clear-btn') as HTMLButtonElement | null;
  if (!target) return;

  const tableKey = target.dataset.table;
  const label = target.dataset.label;
  if (!tableKey || !label) return;

  clearTable(tableKey, label);
});

async function loadDatabase() {
  setLoading(true);

  try {
    const res = await fetch('/api/admin/database');
    const data = await res.json().catch(() => null);

    if (!res.ok || !data || typeof data !== 'object') {
      throw new Error('No se pudieron cargar los datos');
    }

    const defs = getTableDefs(data as StoreRecord);
    if (!tablesEl) return;

    tablesEl.innerHTML = defs.map((def) => renderTableSection(def, data as StoreRecord)).join('');
    tablesEl.classList.remove('hidden');
    errorEl?.classList.add('hidden');
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Error al cargar la base de datos');
  } finally {
    setLoading(false);
  }
}

refreshBtn?.addEventListener('click', () => loadDatabase());
loadDatabase();
