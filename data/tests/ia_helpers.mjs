// Shared helpers for the web IA tests (not a test file itself).
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import { ROUTE_MOVES, matchesRoute, moveForPath } from '../route_moves.mjs';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Every page route under src/app, as a pattern ('/cuet/[subject]'), route groups removed. */
export function appPageRoutes(root = ROOT) {
  const appDir = join(root, 'src', 'app');
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/^page\.(js|jsx)$/.test(name)) continue;
      const rel = relative(appDir, dir).split(sep).filter((seg) => seg && !/^\(.*\)$/.test(seg));
      out.push(`/${rel.join('/')}`.replace(/\/$/, '') || '/');
    }
  };
  walk(appDir);
  return [...new Set(out)].sort();
}

/**
 * Does an internal href land somewhere real? A page that exists, or a planned move that serves it
 * (rewrite, redirect, or a new page a packet builds). Hash fragments and queries are ignored.
 */
export function resolvesHref(href, pages = appPageRoutes()) {
  const path = String(href || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (pages.some((pattern) => matchesRoute(pattern, path))) return true;
  const move = moveForPath(path);
  return Boolean(move && ['rewrite', 'redirect', 'new'].includes(move.action));
}

export { ROUTE_MOVES };
