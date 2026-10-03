// Client-side helpers for the DU eligibility and cutoff tools.
// The data is static JSON under /public/du/2026 (CDN-served, cached), so no server
// function runs when a student uses the tool.

export const DU_BASE = '/du/2026';
const STORE_KEY = 'mm.du.v1';

const cache = { index: null, rules: null, offerings: new Map() };

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res.json();
}

export function loadIndex() {
  cache.index ??= getJson(`${DU_BASE}/index.json`).catch((error) => {
    cache.index = null;
    throw error;
  });
  return cache.index;
}

export function loadRules() {
  // The full index already contains the rules, so reuse it if it has been fetched.
  if (cache.index) return cache.index;
  cache.rules ??= getJson(`${DU_BASE}/rules.json`).catch((error) => {
    cache.rules = null;
    throw error;
  });
  return cache.rules;
}

export function loadOfferings(groupId) {
  if (!cache.offerings.has(groupId)) {
    cache.offerings.set(
      groupId,
      getJson(`${DU_BASE}/offerings/${groupId}.json`).catch((error) => {
        cache.offerings.delete(groupId);
        throw error;
      })
    );
  }
  return cache.offerings.get(groupId);
}

export const PRESETS = [
  { id: 'commerce', label: 'Commerce', hint: 'English, Accountancy, Business Studies, Economics', languages: ['english'], domains: ['accountancy', 'business_studies', 'economics'], gat: false },
  { id: 'commerce-maths', label: 'Commerce + Maths', hint: 'Adds Mathematics, which Economics and BMS need', languages: ['english'], domains: ['accountancy', 'business_studies', 'economics', 'mathematics'], gat: true },
  { id: 'pcm', label: 'Science (PCM)', hint: 'Physics, Chemistry, Mathematics', languages: ['english'], domains: ['physics', 'chemistry', 'mathematics'], gat: false },
  { id: 'pcb', label: 'Science (PCB)', hint: 'Physics, Chemistry, Biology', languages: ['english'], domains: ['physics', 'chemistry', 'biology'], gat: false },
  { id: 'humanities', label: 'Humanities', hint: 'History, Political Science, Economics', languages: ['english'], domains: ['history', 'political_science', 'economics'], gat: false },
];

// ---- Selection <-> URL / localStorage ---------------------------------------------

export function encodeSelection(selection) {
  return [...selection.languages, ...selection.domains, ...(selection.gat ? ['gat'] : [])].join(',');
}

export function decodeSelection(value, catalog) {
  const out = { languages: [], domains: [], gat: false };
  if (!value) return out;
  const langs = new Set(catalog.languages.map((l) => l.id));
  const doms = new Set(catalog.domains.map((d) => d.id));
  for (const raw of String(value).split(',')) {
    const id = raw.trim().toLowerCase();
    if (id === 'gat') out.gat = true;
    else if (langs.has(id) && !out.languages.includes(id)) out.languages.push(id);
    else if (doms.has(id) && !out.domains.includes(id)) out.domains.push(id);
  }
  return out;
}

export function buildQuery({ selection, category, score }) {
  const params = new URLSearchParams();
  const s = encodeSelection(selection);
  if (s) params.set('s', s);
  if (category && category !== 'UR') params.set('c', category);
  if (score !== '' && score != null && Number.isFinite(Number(score))) params.set('score', String(score));
  return params.toString();
}

export function readSaved() {
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function writeSaved(value) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    /* private mode or blocked storage: the tool still works */
  }
}

export function formatScore(value) {
  if (value == null) return '–';
  return Number(value).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// MockMob practice hubs that exist for a CUET subject id (others link to the Arena).
export const PRACTICE_HUBS = {
  english: '/cuet/english',
  accountancy: '/cuet/accountancy',
  economics: '/cuet/economics',
  business_studies: '/cuet/business-studies',
  history: '/cuet/history',
  political_science: '/cuet/political-science',
};

export const STREAM_ORDER = ['Commerce & Economics', 'Humanities & Social Sciences', 'Science', 'Vocational', 'Other'];
