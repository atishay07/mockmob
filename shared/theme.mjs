// Theme and glass choice for the web, decided before first paint.
//
// Theme (owner D5, 14 Oct 2026): a saved choice always wins. Without one, the signed-in product
// opens in Night, as the app does, and a stranger on a marketing page opens in Light. "Signed-in
// product" means a product route, or any page when this browser's visitor hint says member
// (data/visitor_state.mjs writes that hint; it holds no personal data).
//
// Glass (owner D6): blur lives on chrome only. `full` is live blur, `lite` a dense tint with an
// edge light and no blur, `off` solid. A saved choice wins; otherwise touch screens start on
// `lite` (budget Android) and a fine pointer gets `full`. CSS also forces solid under
// prefers-reduced-transparency and prefers-contrast: more, whatever is saved here.
//
// Pure functions for tests; THEME_BOOT_SCRIPT is the same logic, inlined into <head>.

export const THEME_KEY = 'mm:theme:v1';
export const GLASS_KEY = 'mm:glass:v1';
export const VISITOR_HINT_KEY = 'mm:visitor:v1';
export const THEMES = Object.freeze(['dark', 'light']);
export const GLASS_LEVELS = Object.freeze(['full', 'lite', 'off']);

/** First path segments of the signed-in product (src/app/(app)) plus onboarding. */
export const PRODUCT_ROUTES = Object.freeze([
  'admission-compass', 'analytics', 'dashboard', 'explore', 'leaderboard', 'learn', 'mentor',
  'moderation', 'my-uploads', 'onboarding', 'profile', 'progress', 'recovery', 'result', 'review',
  'rival', 'saved', 'study', 'test', 'today', 'upload',
]);

/** The theme the browser should name, or null when nothing valid is saved. */
export function savedTheme(raw) {
  return raw === 'dark' || raw === 'light' ? raw : null;
}

export function isProductPath(pathname) {
  const first = String(pathname || '/').split(/[?#]/)[0].split('/').filter(Boolean)[0] || '';
  return PRODUCT_ROUTES.includes(first);
}

function hintIsMember(rawHint) {
  try {
    const hint = typeof rawHint === 'string' ? JSON.parse(rawHint) : rawHint;
    return Boolean(hint && typeof hint === 'object' && hint.kind === 'member');
  } catch {
    return false;
  }
}

/**
 * @param {{ saved?: string|null, hint?: string|object|null, pathname?: string }} input
 * @returns {'dark'|'light'}
 */
export function resolveTheme({ saved = null, hint = null, pathname = '/' } = {}) {
  const chosen = savedTheme(saved);
  if (chosen) return chosen;
  return isProductPath(pathname) || hintIsMember(hint) ? 'dark' : 'light';
}

/**
 * @param {{ saved?: string|null, coarsePointer?: boolean }} input
 * @returns {'full'|'lite'|'off'}
 */
export function resolveGlass({ saved = null, coarsePointer = false } = {}) {
  if (GLASS_LEVELS.includes(saved)) return saved;
  return coarsePointer ? 'lite' : 'full';
}

/** Browser-chrome colour per theme (the ground), for <meta name="theme-color">. */
export const THEME_COLOR = Object.freeze({ dark: '#12110E', light: '#F3EFE6' });

// The inline script. Same rules as above, written to run before anything else, never throwing.
// It also keeps <meta name="theme-color"> in step once the head has parsed.
export const THEME_BOOT_SCRIPT = `(function(){var d=document.documentElement,t='light',g='full',ls=null;
try{ls=window.localStorage}catch(e){}
function get(k){try{return ls?ls.getItem(k):null}catch(e){return null}}
var s=get(${JSON.stringify(THEME_KEY)});
if(s==='dark'||s==='light'){t=s}else{
var seg=(location.pathname.split('/')[1]||'');var routes=${JSON.stringify(PRODUCT_ROUTES)};
var member=false;try{var h=JSON.parse(get(${JSON.stringify(VISITOR_HINT_KEY)})||'null');member=!!(h&&h.kind==='member')}catch(e){}
if(routes.indexOf(seg)>-1||member){t='dark'}}
var gs=get(${JSON.stringify(GLASS_KEY)});
if(gs==='full'||gs==='lite'||gs==='off'){g=gs}else{try{g=window.matchMedia('(pointer: coarse)').matches?'lite':'full'}catch(e){}}
d.dataset.theme=t;d.dataset.glass=g;
function meta(){try{var c=${JSON.stringify(THEME_COLOR)}[d.dataset.theme==='dark'?'dark':'light'];var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++){m[i].setAttribute('content',c)}}catch(e){}}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',meta)}else{meta()}
try{new MutationObserver(meta).observe(d,{attributes:true,attributeFilter:['data-theme']})}catch(e){}
})()`;
