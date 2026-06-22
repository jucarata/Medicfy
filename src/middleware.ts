import type { MiddlewareHandler } from 'astro';
import { ensureServerStarted } from './lib/server/init.js';

ensureServerStarted();

export const onRequest: MiddlewareHandler = async (_context, next) => {
  return next();
};
