import type { APIRoute } from 'astro';
import * as store from '../../../../lib/server/store.js';
import { error, json } from '../../../../lib/server/api.js';

export const DELETE: APIRoute = ({ params }) => {
  const table = params.table;
  if (!table) {
    return error('Tabla no especificada', 400);
  }

  const result = store.clearTable(table);
  if (!result.ok) {
    return error(result.error || 'No se pudo borrar la tabla', 400);
  }

  return json({ ok: true });
};
