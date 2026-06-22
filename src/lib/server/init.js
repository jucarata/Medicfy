import 'dotenv/config';
import * as whatsapp from './whatsapp.js';
import { startScheduler } from './scheduler.js';

let started = false;

export function ensureServerStarted() {
  if (started) return;
  started = true;

  whatsapp.initClient();
  startScheduler();

  const port = process.env.PORT || 4321;
  console.log(`\n  MedicFy listo (puerto ${port})\n`);
}
