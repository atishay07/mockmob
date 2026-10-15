// Shim (web IA, IA0). The navigation now lives in src/lib/navigation.js. These names keep the
// current shell working until IA1 replaces it; then this file is deleted (IA9).
export {
  LEGACY_STUDY_NAV as STUDY_NAV,
  LEGACY_MOBILE_STUDY_NAV as MOBILE_STUDY_NAV,
  legacyArenaNavigation as arenaNavigation,
} from './navigation.js';
