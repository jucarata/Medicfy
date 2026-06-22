import type { APIRoute } from 'astro';
import * as store from '../../../lib/server/store.js';
import { json } from '../../../lib/server/api.js';

export const GET: APIRoute = () => {
  return json(store.getFullStore());
};
