// The preview registry for /preview/arena (web IA, IA0). Development only: the page returns
// notFound() in production.
//
// Each packet owns one file here (shell, today, onboarding, practice, review, you) and adds its
// views and fixture handlers there, so parallel builders never edit the same file. legacy.jsx holds
// the views that existed before; a packet view with the same name replaces it. The contract is in
// the header of each packet file.
import { LEGACY_VIEWS, LEGACY_ORDER } from './legacy';
import * as shell from './shell';
import * as today from './today';
import * as onboarding from './onboarding';
import * as practice from './practice';
import * as review from './review';
import * as you from './you';

export const PACKETS = Object.freeze({ shell, today, onboarding, practice, review, you });

const packetViews = Object.assign({}, ...Object.values(PACKETS).map((p) => p.views || {}));

/** Every view by name: legacy first, packet views on top. */
export const PREVIEW_VIEWS = Object.freeze({ ...LEGACY_VIEWS, ...packetViews });

/** Fixture API handlers from the packets, tried in packet order before the built-in fixtures. */
export const PREVIEW_HANDLERS = Object.freeze(Object.values(PACKETS).flatMap((p) => p.handlers || []));

/** View names for the picker: the original order, then new names in packet order. */
export function viewNames({ moderator = false } = {}) {
  const extra = Object.keys(packetViews).filter((name) => !LEGACY_ORDER.includes(name));
  return [...LEGACY_ORDER, ...extra].filter((name) => PREVIEW_VIEWS[name] && (moderator || !PREVIEW_VIEWS[name].moderatorOnly));
}

/** The view for a name (dashboard when unknown or not allowed), with its name. */
export function resolveView(name, { moderator = false } = {}) {
  const names = viewNames({ moderator });
  const key = names.includes(name) ? name : 'dashboard';
  return { name: key, view: PREVIEW_VIEWS[key] };
}

/** The previewLinks map the shell reads: the last route segment (and any linkKeys) to a preview href. */
export function previewLinksFor(previewHref, { moderator = false } = {}) {
  const links = {};
  for (const name of viewNames({ moderator })) {
    const view = PREVIEW_VIEWS[name];
    const key = String(view.route || `/${name}`).split('/').filter(Boolean)[0] || name;
    if (!(key in links)) links[key] = previewHref(name);
    for (const extra of view.linkKeys || []) if (!(extra in links)) links[extra] = previewHref(name);
  }
  return links;
}

/** Runs the packet handlers; the first non-null reply wins. */
export function packetFixtureReply(req) {
  for (const handler of PREVIEW_HANDLERS) {
    const reply = handler(req);
    if (reply) return reply;
  }
  return null;
}
