// Browser-side driver for the NTA runner (served by data/tests/nta_e2e_server.mjs at /__driver.js).
// Load it in the page with:  eval(await (await fetch('http://localhost:3108/__driver.js')).text())
// It adds window.__ui: snap() reads what the student sees, the other helpers act as the student does,
// and flow() runs the whole palette / Save & next / Mark / Clear sequence and returns its checks.
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function until(test, ms = 20000, step = 100) { const t = Date.now(); while (Date.now() - t < ms) { const v = test(); if (v) return v; await sleep(step); } return null; }
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };

  // ---- contrast -----------------------------------------------------------------------------
  const parse = (value) => { const m = String(value).match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const over = (top, bottom) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1); };
  // Candidate backdrops: a flat colour, or every colour stop when the nearest paint is a gradient.
  function backdrops(el) {
    const stack = []; let node = el; let gradient = null;
    while (node) {
      const cs = getComputedStyle(node); const c = parse(cs.backgroundColor);
      if (!gradient && /gradient/.test(cs.backgroundImage)) { gradient = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse); stack.push(null); break; }
      if (c[3] > 0) stack.push(c);
      if (c[3] >= 0.99) break;
      node = node.parentElement;
    }
    let base = parse(getComputedStyle(document.body).backgroundColor); if (base[3] === 0) base = [255, 255, 255, 1];
    const flatten = (start) => { let b = start; for (let i = stack.length - 1; i >= 0; i -= 1) if (stack[i]) b = over(stack[i], b); return b; };
    if (gradient?.length) return gradient.map((stop) => over(stop, base));
    return [flatten(base)];
  }
  function contrast(el) {
    if (!el) return null;
    const cs = getComputedStyle(el); const candidates = backdrops(el);
    let worst = null;
    for (const bg of candidates) {
      const fg = over(parse(cs.color), bg);
      const a = lum(fg); const b = lum(bg); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (!worst || ratio < worst.ratio) worst = { ratio: Math.round(ratio * 100) / 100, color: cs.color, bg: `rgb(${bg.slice(0, 3).map(Math.round).join(',')})`, size: cs.fontSize, opacity: cs.opacity };
    }
    return worst;
  }

  // ---- reading the screen -------------------------------------------------------------------
  const stateOf = (chip) => (chip.className.match(/nta-palette-chip--([a-z-]+)/) || [])[1];
  function snap() {
    const runner = $('.nta-runner');
    const out = { url: location.pathname + location.search, theme: document.documentElement.dataset.theme || 'light', width: innerWidth, height: innerHeight };
    if (!runner) {
      const err = $('[role=alert], .error-state, main');
      out.state = $('[role=status]') && /Opening your session|Loading/.test(document.body.innerText) ? 'loading' : 'error';
      out.text = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400);
      out.errorContrast = contrast($('main p, [role=alert]') || err);
      return out;
    }
    out.state = 'runner';
    out.interface = runner.dataset.interface;
    const dialog = $('dialog.ei-dialog[open]');
    out.overlay = dialog ? { title: $('#ei-title')?.innerText, body: $('#ei-body')?.innerText, button: $('.ei-btn')?.innerText, error: $('.ei-error')?.innerText || '' } : null;
    out.title = `${$('.nta-title-stack span')?.innerText} / ${$('.nta-title-stack strong')?.innerText}`;
    out.timer = $('.nta-timer span')?.innerText; out.timerAria = $('.nta-timer')?.getAttribute('aria-label');
    out.progress = $$('.nta-progress-row span').map((s) => s.innerText);
    const summary = $$('.nta-review-panel .nta-summary-grid > div').map((d) => Number($('strong', d).innerText));
    out.summary = { answered: summary[0], marked: summary[1], pending: summary[2], notVisited: summary[3] };
    const chips = $$('.nta-review-panel .nta-palette-chip');
    out.chips = chips.map(stateOf); out.total = chips.length;
    out.current = chips.findIndex((c) => c.classList.contains('is-current'));
    out.warnings = $('.ei-pill')?.innerText;
    out.sync = $('.runner-sync-state')?.innerText;
    out.notice = $('.nta-paper-notice') ? { open: $('.nta-paper-notice').open, summary: $('.nta-paper-notice summary')?.innerText, items: $$('.nta-paper-notice li').map((li) => li.innerText) } : null;
    out.head = $('.nta-paper-head h1')?.innerText;
    out.tags = $$('.nta-paper-tags span').map((s) => s.innerText);
    out.passage = $('.nta-passage') ? { title: $('.nta-passage-head strong')?.innerText, length: ($('.nta-passage p')?.innerText || '').length, contrast: contrast($('.nta-passage p')), visible: visible($('.nta-passage p')) } : null;
    out.blocks = $$('.nta-question-block').map((b) => ({
      number: $('.nta-question-number', b)?.innerText, chip: $('.nta-chip', b)?.innerText, active: b.classList.contains('is-active'),
      stem: $('.nta-question-text', b)?.innerText, options: $$('.nta-option-text', b).map((o) => o.innerText), selected: $$('.nta-option', b).findIndex((o) => o.classList.contains('is-selected')),
      mark: $$('.nta-text-button', b).map((x) => x.innerText.trim()), disabled: $$('.nta-option', b).every((o) => o.disabled),
    }));
    out.navDesktop = $$('.nta-navigation .nta-nav-button').filter(visible).map((b) => b.innerText.trim());
    out.navMobile = $$('.nta-mobile-actions button').filter(visible).map((b) => b.innerText.trim());
    out.sheetOpen = !!$('.nta-mobile-sheet');
    out.submit = $('.nta-submit-button')?.innerText;
    out.scrollX = document.documentElement.scrollWidth > innerWidth + 1;
    return out;
  }

  // ---- contrast of everything a student reads, in the current theme ---------------------------
  function readability() {
    const parts = {
      stem: '.nta-question-text', option: '.nta-option-text', optionLetter: '.nta-option-letter', passage: '.nta-passage p', passageTitle: '.nta-passage-head strong', passageLabel: '.nta-passage-head span',
      heading: '.nta-paper-head h1', kicker: '.nta-paper-head .nta-kicker', tag: '.nta-paper-tags span', chip: '.nta-chip', markButton: '.nta-text-button', navButton: '.nta-navigation .nta-nav-button',
      timer: '.nta-timer span', title: '.nta-title-stack strong', progress: '.nta-progress-row span', warnings: '.ei-pill', notice: '.nta-paper-notice summary span', noticeItem: '.nta-paper-notice li',
      summaryNumber: '.nta-summary-grid strong', summaryLabel: '.nta-summary-grid span', legend: '.nta-legend span', submit: '.nta-submit-button', paletteChip: '.nta-review-panel .nta-palette-chip',
      mobileButton: '.nta-mobile-actions button', syncNote: '.runner-sync-state', toolbar: '.nta-interface-toolbar span',
    };
    const out = {};
    for (const [name, selector] of Object.entries(parts)) {
      const els = $$(selector).filter(visible);
      if (!els.length) continue;
      const results = els.slice(0, 60).map(contrast).filter(Boolean);
      const worst = results.reduce((a, b) => (a.ratio <= b.ratio ? a : b));
      out[name] = { n: els.length, worst: worst.ratio, color: worst.color, bg: worst.bg };
    }
    // every palette state and the legend swatches
    const states = {};
    for (const chip of $$('.nta-review-panel .nta-palette-chip')) { const s = stateOf(chip); if (!states[s]) states[s] = contrast(chip); }
    out.paletteStates = Object.fromEntries(Object.entries(states).map(([k, v]) => [k, v.ratio]));
    return out;
  }

  // Answer the whole paper the way a student might: i%5 = 0 and 3 pick an option, 1 picks and marks, 2 is left
  // blank, 4 picks and then clears. Returns what the palette shows afterwards.
  async function bulk() {
    const chips = $$('.nta-review-panel .nta-palette-chip'); const total = chips.length; const plan = [];
    for (let i = 0; i < total; i += 1) {
      await gotoQ(i + 1);
      const s = snap(); const b = s.blocks.findIndex((x) => x.number && Number(x.number.replace(/\D/g, '')) === i + 1); const block = b >= 0 ? b : s.blocks.findIndex((x) => x.active);
      const kind = i % 5; const option = (i * 7 + 1) % 4;
      if (kind === 2) { plan.push('blank'); continue; }
      await pick(option, block);
      if (kind === 1) { await textButton('Mark', block); plan.push('marked-answered'); }
      else if (kind === 4) { await textButton('Clear', block); plan.push('visited'); }
      else plan.push('answered');
    }
    const s = snap();
    const expected = plan.map((p) => (p === 'blank' ? 'visited' : p));
    const mismatches = expected.map((e, i) => (s.chips[i] === e ? null : `${i + 1}: ${s.chips[i]} not ${e}`)).filter(Boolean);
    const count = (state) => expected.filter((e) => e === state).length;
    return { total, mismatches, summary: s.summary, expectedSummary: { answered: count('answered') + count('marked-answered'), marked: count('marked-answered') } };
  }

  // Readability in both themes: the parts that fall under 4.5:1 (3:1 for the bold numerals on palette chips).
  async function auditThemes() {
    const out = {};
    const start = document.documentElement.dataset.theme || 'light';
    // Colours are read after the switch has settled: transitions are switched off for the measurement.
    const still = document.createElement('style'); still.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.appendChild(still);
    for (const theme of ['light', 'dark']) {
      setTheme(theme); await sleep(500);
      const r = readability(); const low = {};
      for (const [name, v] of Object.entries(r)) {
        if (name === 'paletteStates') { for (const [state, ratio] of Object.entries(v)) if (ratio < 3) low[`palette:${state}`] = ratio; continue; }
        if (name === 'optionLetter' || name === 'paletteChip') continue;
        if (v.worst < 4.5) low[name] = v.worst;
      }
      out[theme] = { low, passage: r.passage?.worst ?? null, stem: r.stem?.worst ?? null, option: r.option?.worst ?? null, paletteStates: r.paletteStates, bodyBg: getComputedStyle(document.body).backgroundColor, runnerBg: getComputedStyle($('.nta-runner')).backgroundColor };
    }
    setTheme(start); await sleep(150); still.remove();
    return out;
  }

  // The test browser pane can be hidden or unfocused while a script runs, which the runner correctly counts as
  // leaving the test. For runs that are not about that, swallow those events so the paper stays answerable.
  function quiet() {
    if (window.__quiet) return;
    window.__quiet = true;
    document.hasFocus = () => true;
    for (const [target, type] of [[document, 'visibilitychange'], [window, 'blur'], [window, 'focus']]) target.addEventListener(type, (event) => event.stopImmediatePropagation(), true);
  }

  // ---- acting as the student ------------------------------------------------------------------
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('mm:theme:v1', theme); } catch {}
    window.dispatchEvent(new Event('mm-theme'));
  }
  async function enterFullscreen() {
    if (!(await until(() => $('dialog.ei-dialog[open]'), 3000))) return 'no overlay';
    // The embedded browser never settles requestFullscreen; emulate the browser's behaviour.
    if (!window.__fsEmulated) {
      window.__fsEmulated = true;
      Element.prototype.requestFullscreen = function request() { Object.defineProperty(document, 'fullscreenElement', { get: () => this, configurable: true }); setTimeout(() => document.dispatchEvent(new Event('fullscreenchange')), 0); return Promise.resolve(); };
      document.exitFullscreen = () => { Object.defineProperty(document, 'fullscreenElement', { get: () => null, configurable: true }); setTimeout(() => document.dispatchEvent(new Event('fullscreenchange')), 0); return Promise.resolve(); };
    }
    $('.ei-btn').click();
    return (await until(() => !$('dialog.ei-dialog[open]'), 4000)) ? 'entered' : 'overlay stayed';
  }
  const buttonByText = (text, roots) => { const all = $$(roots).filter(visible); return all.find((b) => b.innerText.trim().replace(/\s+/g, ' ').toLowerCase().startsWith(text.toLowerCase())); };
  async function nav(text) {
    const b = buttonByText(text, '.nta-navigation .nta-nav-button, .nta-mobile-actions button');
    if (!b) return false;
    const active = $$('.nta-question-block').find((x) => x.classList.contains('is-active'));
    b.click(); await sleep(150);
    if (/clear/i.test(text)) window.__clicks.push({ qid: qidOf(active), index: null, cleared: true });
    return true;
  }
  const qidOf = (b) => (b?.getAttribute('aria-labelledby') || '').replace('question-title-', '');
  window.__clicks = window.__clicks || [];
  async function pick(optionIndex, block = 0) {
    const b = $$('.nta-question-block')[block]; const o = b && $$('.nta-option', b)[optionIndex];
    if (!o) return false;
    o.click(); await sleep(120);
    window.__clicks.push({ qid: qidOf(b), index: optionIndex, text: $('.nta-option-text', o).innerText, shown: $$('.nta-option', b).findIndex((x) => x.classList.contains('is-selected')) });
    return true;
  }
  async function textButton(label, block = 0) {
    const b = $$('.nta-question-block')[block]; const t = b && $$('.nta-text-button', b).find((x) => x.innerText.trim().toLowerCase().includes(label.toLowerCase()));
    if (!t) return false; t.click(); await sleep(120);
    if (/clear/i.test(label)) window.__clicks.push({ qid: qidOf(b), index: null, cleared: true });
    return true;
  }
  async function gotoQ(number) { const chip = $$('.nta-review-panel .nta-palette-chip')[number - 1]; if (!chip) return false; chip.click(); await sleep(150); return true; }
  async function openSheet() { const b = $('.nta-mobile-actions button[aria-label^="Question palette"]'); if (!b || !visible(b)) return false; b.click(); await sleep(250); return !!$('.nta-mobile-sheet'); }
  async function closeSheet() { const b = $('.nta-sheet-head .nta-icon-button'); if (b) { b.click(); await sleep(200); } return !$('.nta-mobile-sheet'); }
  async function key(k) {
    const active = $$('.nta-question-block').find((x) => x.classList.contains('is-active'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); await sleep(120);
    if (/^[1-4]$/.test(k) && active) window.__clicks.push({ qid: qidOf(active), index: Number(k) - 1, text: $$('.nta-option-text', active)[Number(k) - 1]?.innerText, key: true });
  }

  // ---- submit and check the wire ----------------------------------------------------------------
  async function submitCheck() {
    window.confirm = () => true; // the runner asks "Submit anyway?" with a native dialog
    const log = window.__ntaLog || [];
    if (!visible($('.nta-review-panel .nta-submit-button'))) await openSheet(); // phones: Submit lives in the palette sheet
    const button = [$('.nta-review-panel .nta-submit-button'), $('.nta-sheet-panel .nta-submit-button')].find(visible);
    if (!button) return { error: 'no visible submit button' };
    button.click();
    await until(() => log.some((e) => e.path === '/api/attempts' && e.method === 'POST' && e.status), 15000);
    const started = log.find((e) => e.path === '/api/sessions' && e.method === 'POST' && e.status === 200);
    const sent = log.find((e) => e.path === '/api/attempts' && e.method === 'POST');
    if (!started || !sent?.response) return { error: 'no submission seen', log: log.map((e) => `${e.method} ${e.path} ${e.status}`) };
    const questions = started.response.questions;
    const keys = await (await fetch(`http://localhost:3108/__keys?ids=${questions.map((q) => q.id).join(',')}`)).json();
    // the last click per question is the student's final answer
    const finalByUi = {};
    for (const c of window.__clicks) { if (c.cleared) delete finalByUi[c.qid]; else finalByUi[c.qid] = c; }
    const sentAnswers = sent.request.answers;
    const problems = [];
    for (const [qid, c] of Object.entries(finalByUi)) {
      if (sentAnswers[qid] !== c.index) problems.push(`sent ${sentAnswers[qid]} for ${qid}, clicked ${c.index}`);
      const q = questions.find((x) => x.id === qid);
      if (q && q.options[c.index]?.text !== c.text) problems.push(`option text mismatch on ${qid}: shown ${c.text} vs session ${q.options[c.index]?.text}`);
    }
    for (const qid of Object.keys(sentAnswers)) if (!finalByUi[qid]) problems.push(`sent an answer for ${qid} the student did not leave`);
    let correct = 0; let wrong = 0;
    for (const [qid, given] of Object.entries(sentAnswers)) { if (given === keys[qid]) correct += 1; else wrong += 1; }
    const result = sent.response;
    const eventSeq = sent.request.events.every((e, i, a) => i === 0 || e.seq > a[i - 1].seq);
    return {
      status: sent.status, result: { correct: result.correct, wrong: result.wrong, unattempted: result.unattempted, total: result.total, score: result.score },
      expected: { correct, wrong, unattempted: questions.length - correct - wrong, raw: correct * 5 - wrong }, problems, eventSeq, events: sent.request.events.length,
      mapping: Object.keys(finalByUi).length, hasTicket: !!sent.request.sessionTicket,
    };
  }

  // ---- the whole sequence ---------------------------------------------------------------------
  async function flow() {
    const checks = []; const check = (name, ok, evidence) => checks.push({ name, ok: !!ok, evidence: evidence === undefined ? '' : evidence });
    let s = snap();
    check('runner shown', s.state === 'runner', s.text);
    if (s.state !== 'runner') return { checks, snap: s };
    const N = s.total;
    check('palette has one chip per question', N >= 45 && N <= 50, N);
    check('timer starts just under 60:00', /^(59:[3-5]\d|60:00)$/.test(s.timer || ''), s.timer);
    check('exam-space overlay gates answering at first', !!s.overlay && /Enter your exam space/.test(s.overlay.title), JSON.stringify(s.overlay));
    // answering is blocked until fullscreen: the option click must not register
    await pick(1); s = snap();
    check('a click behind the overlay records no answer', s.summary.answered === 0, s.summary.answered);
    const fs = await enterFullscreen(); s = snap();
    check('enter fullscreen opens the paper', fs === 'entered' && !s.overlay, fs);
    check('start: Q1 is current and visited, the other chips untouched', s.current === 0 && s.chips[0] === 'visited' && s.chips.slice(1).every((c) => c === 'notvisited' || (s.passage && c === 'visited')), s.chips.slice(0, 8).join(','));
    check('start: summary is 0 answered, 0 marked', s.summary.answered === 0 && s.summary.marked === 0, JSON.stringify(s.summary));
    const stemQ1 = s.blocks.find((b) => b.active)?.stem;
    const firstEntry = s.current;
    // choose, then Save & next
    const picked = await pick(2, s.blocks.findIndex((b) => b.active)); s = snap();
    const activeBlock = s.blocks.findIndex((b) => b.active);
    check('choosing an option marks the question answered in the palette and the summary', picked && s.chips[firstEntry] === 'answered' && s.summary.answered === 1 && s.blocks[activeBlock].selected === 2, `${s.chips[firstEntry]} ${JSON.stringify(s.summary)}`);
    check('progress row shows 1 answered', /1 answered/i.test(s.progress.join(' ')), s.progress.join('|'));
    const classic = s.interface === 'nta';
    const next = classic ? 'Save & next' : 'Next';
    const before = s.current; const moved = await nav(next); s = snap();
    check(`${next} moves to the next question and keeps the answer`, moved && s.current > before && s.chips[firstEntry] === 'answered', `${before}->${s.current}`);
    check('the new question is visited and not answered', s.chips[s.current] === 'visited', s.chips[s.current]);
    // Mark for review (and next when the NTA style offers it)
    const q2 = s.current;
    if (classic) { const m = await nav('Mark for review & next'); s = snap(); check('Mark for review & next marks the question and moves on', m && s.chips[q2] === 'marked' && s.current > q2 && s.summary.marked === 1, `${s.chips[q2]} cur ${s.current} ${JSON.stringify(s.summary)}`); }
    else { const m = await textButton('Mark'); s = snap(); check('Mark flags the question', m && s.chips[q2] === 'marked' && s.summary.marked === 1, `${s.chips[q2]} ${JSON.stringify(s.summary)}`); await nav(next); s = snap(); }
    // answered and marked
    const q3 = s.current; const blk = s.blocks.findIndex((b) => b.active);
    await pick(0, blk); await textButton('Mark', blk); s = snap();
    check('answered and marked shows the combined state', s.chips[q3] === 'marked-answered' && s.summary.marked === 2 && s.summary.answered === 2, `${s.chips[q3]} ${JSON.stringify(s.summary)}`);
    check('the mark button now offers Unmark', s.blocks[blk].mark.some((t) => /unmark/i.test(t)), s.blocks[blk].mark.join('|'));
    await textButton('Unmark', blk); s = snap();
    check('Unmark returns the question to answered', s.chips[q3] === 'answered' && s.summary.marked === 1, `${s.chips[q3]} ${JSON.stringify(s.summary)}`);
    // Clear response
    await gotoQ(firstEntry + 1); s = snap();
    check('palette jump lands on the chosen question and keeps its answer', s.current === firstEntry && s.chips[firstEntry] === 'answered', `${s.current} ${s.chips[firstEntry]}`);
    if (classic) await nav('Clear response'); else await textButton('Clear', s.blocks.findIndex((b) => b.active));
    s = snap();
    check('Clear response removes the answer; the question stays visited', s.chips[firstEntry] === 'visited' && s.summary.answered === 1 && s.blocks.every((b) => b.selected === -1 || b.active === false || firstEntry !== s.current), `${s.chips[firstEntry]} ${JSON.stringify(s.summary)}`);
    check('Clear response keeps the same question open', s.current === firstEntry, s.current);
    // keyboard
    const kBlock = s.blocks.findIndex((b) => b.active);
    await key('3'); s = snap();
    check('key 3 chooses option C', s.blocks[kBlock].selected === 2 && s.chips[firstEntry] === 'answered', `${s.blocks[kBlock].selected}`);
    await key('ArrowRight'); const afterRight = snap();
    check('ArrowRight moves on, ArrowLeft returns', afterRight.current > firstEntry, `${firstEntry}->${afterRight.current}`);
    await key('ArrowLeft'); s = snap();
    check('ArrowLeft goes back to the first question', s.current === firstEntry, s.current);
    // Previous is disabled on Q1
    const prev = ['Previous', 'Back', 'Prev'].map((t) => buttonByText(t, '.nta-navigation .nta-nav-button, .nta-mobile-actions button')).find(Boolean);
    check('Previous is disabled on the first question', prev?.disabled === true, prev?.innerText);
    return { checks, snap: snap(), stemQ1 };
  }

  // One subject, one viewport: wait for the page, then either describe the refusal or run the flow,
  // the two-theme audit and (unless submit:false) the submission check. Returns a compact record.
  async function run({ submit = true, bulkFill = false, quietMode = true } = {}) {
    if (quietMode) quiet();
    await sleep(1200);
    await until(() => $('.nta-runner') || (!/Opening your session|Validating|Loading practice/i.test(document.body.innerText) && document.body.innerText.length > 150), 25000);
    await sleep(400);
    const first = snap();
    if (first.state !== 'runner') {
      const text = first.text; const buttons = $$('button, a').filter(visible).map((b) => b.innerText.trim()).filter(Boolean);
      const all = document.body.innerText; const at = all.indexOf('This did not load');
      return { refused: true, message: at >= 0 ? all.slice(at, at + 520).replace(/\s+/g, ' ') : '', text: at >= 0 ? '' : text.slice(0, 200), buttons: buttons.filter((b) => /dashboard|again|retry|full mock/i.test(b)), scrollX: document.documentElement.scrollWidth > innerWidth + 1, width: innerWidth, contrast: first.errorContrast, theme: first.theme };
    }
    const f = await flow();
    const out = { refused: false, width: innerWidth, head: f.snap?.head, total: first.total, notice: first.notice && { open: first.notice.open, summary: first.notice.summary, items: first.notice.items }, interface: first.interface,
      passed: f.checks.filter((c) => c.ok).length, failed: f.checks.filter((c) => !c.ok), tags: first.tags };
    if (innerWidth < 1024) {
      const opened = await openSheet(); const inSheet = $$('.nta-mobile-sheet .nta-palette-chip').length; const closed = await closeSheet();
      out.sheet = { opened, chips: inSheet, closed };
      const bar = $('.nta-mobile-actions'); const r = bar?.getBoundingClientRect();
      out.mobileBar = { visible: visible(bar), bottom: r ? Math.round(innerHeight - r.bottom) : null, buttons: $$('.nta-mobile-actions button').map((b) => b.innerText.trim().replace(/\s+/g, ' ')) };
      const stem = $('.nta-question-text')?.getBoundingClientRect(); out.stemWithinViewport = !!stem && stem.right <= innerWidth + 1 && stem.left >= -1;
    }
    out.scrollX = document.documentElement.scrollWidth > innerWidth + 1;
    out.audit = await auditThemes();
    if (bulkFill) { out.bulk = await bulk(); }
    if (submit) out.submission = await submitCheck();
    return out;
  }

  window.__ui = { quiet, bulk, run, auditThemes, submitCheck, snap, readability, flow, setTheme, enterFullscreen, nav, pick, textButton, gotoQ, openSheet, closeSheet, key, until, sleep, contrast, visible, $, $$ };
  return 'driver ready';
})();
