// Real tokens: web from src/app/(app)/arena.css, app from flutter_app/lib/core/theme/mm_colors.dart.
(function () {
  var q = new URLSearchParams(location.search);
  var theme = q.get('theme') === 'day' ? 'day' : 'night';
  var surface = q.get('s') === 'web' ? 'web' : 'app';
  var T = {
    web: {
      night: { bg: '#0b100e', raised: '#131a16', sunken: '#0f1512', line: '#253026', lineStrong: '#384736', ink: '#f2f4ec', ink2: '#bcc5b9', ink3: '#93a08f', ink4: '#7f8b7b', accent: '#d2f000', voltLine: 'rgba(210,240,0,0.5)', voltWash: 'rgba(210,240,0,0.07)', warn: '#e0b93f', good: '#b6e36e', bad: '#ff9d92' },
      day: { bg: '#f4f5f0', raised: '#ffffff', sunken: '#eef0e8', line: '#dce1d4', lineStrong: '#bcc5b0', ink: '#172016', ink2: '#3d4a39', ink3: '#56624f', ink4: '#646f5d', accent: '#4f6400', voltLine: 'rgba(111,135,0,0.5)', voltWash: 'rgba(124,150,20,0.08)', warn: '#845400', good: '#3d6600', bad: '#b0291f' }
    },
    app: {
      night: { bg: '#12110e', raised: '#1b1a16', sunken: '#0d0c0a', line: '#312e27', lineStrong: '#4a453b', ink: '#f4f0e6', ink2: '#bdb6a6', ink3: '#a09989', ink4: '#6a645a', accent: '#d2f000', voltLine: 'rgba(210,240,0,0.45)', voltWash: 'rgba(210,240,0,0.07)', warn: '#edb75a', good: '#c6e86e', bad: '#ffa396' },
      day: { bg: '#f3efe6', raised: '#fffdf8', sunken: '#eae5da', line: '#d8d1c2', lineStrong: '#bdb4a2', ink: '#17150f', ink2: '#454036', ink3: '#655f53', ink4: '#8a8375', accent: '#526700', voltLine: 'rgba(82,103,0,0.45)', voltWash: 'rgba(82,103,0,0.08)', warn: '#845400', good: '#3d6600', bad: '#b0291f' }
    }
  };
  var t = T[surface][theme];
  var r = document.documentElement;
  Object.keys(t).forEach(function (k) { r.style.setProperty('--' + k, t[k]); });
  r.dataset.theme = theme; r.dataset.surface = surface;
  window.MM = { theme: theme, surface: surface };
})();

// Lucide paths (MIT), drawn inline so the mock needs no network.
window.LUCIDE = {
  house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  calendarCheck: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
  notebook: '<path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9.5 8h5"/><path d="M9.5 12H16"/><path d="M9.5 16H14"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  trending: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  book: '<path d="M12 7v14"/><path d="M16 12h2"/><path d="M16 8h2"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/><path d="M6 12h2"/><path d="M6 8h2"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  medal: '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/>'
};
window.icon = function (name, size, stroke, extra) {
  return '<svg class="ic ' + (extra || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + stroke + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + window.LUCIDE[name] + '</svg>';
};
// Approximations of the Material Rounded glyphs the app's bottom bar uses today (bar_icons.dart).
window.MATERIAL = {
  home: '<path fill="currentColor" d="M10 19v-5h4v5c0 .55.45 1 1 1h3c.55 0 1-.45 1-1v-7h1.7c.46 0 .68-.57.33-.87L12.67 3.6a1 1 0 0 0-1.34 0l-8.36 7.53c-.34.3-.13.87.33.87H5v7c0 .55.45 1 1 1h3c.55 0 1-.45 1-1z"/>',
  quiz: '<path fill="currentColor" d="M4 6H2v14a2 2 0 0 0 2 2h14v-2H4V6zm16-4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-5.99 13a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm3-7.4c-.75 1.1-1.47 1.45-1.86 2.16-.16.29-.22.48-.22 1.41h-1.82c0-.49-.08-1.29.31-1.98.49-.87 1.42-1.39 1.96-2.16.57-.81.25-2.33-1.37-2.33-1.06 0-1.58.8-1.8 1.48l-1.65-.7C11.01 5.12 12.32 4 14.01 4c1.41 0 2.38.64 2.88 1.46.43.7.68 2.01.12 2.14z"/>',
  fact: '<path fill="currentColor" d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM10 17H5v-2h5v2zm0-4H5v-2h5v2zm0-4H5V7h5v2zm4.82 6L12 12.16l1.41-1.41 1.41 1.42L17.99 9l1.42 1.42L14.82 15z"/>',
  person: '<path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-1c0-2.66-5.33-4-8-4z"/>'
};
window.micon = function (name, size) {
  return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true">' + window.MATERIAL[name] + '</svg>';
};
