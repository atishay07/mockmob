// The replay, redrawn for D17: one slot per question, sized to the paper's length, filled by its result, as tall as the
// time spent on it (the paper's even pace is the dashed line, 3x pace is the top), a ring for a changed answer.
// Play walks the real events in order (picks, changes, blanks left, return visits) with one plain caption.
// Collapse shrinks it to one line of result ticks. Shared by web.html and app.html; each page styles .rb-*.
(function () {
  const { fmt, clock } = window.MM;
  const LET = 'ABCD';

  // Visits and events from per-question seconds. Return visits (a change on a later visit, a blank looked at again)
  // are taken out of the first pass and played after it, in order.
  function timeline(paper) {
    const qs = paper.questions;
    const returns = {};
    qs.forEach((q) => { if (q.change?.later) returns[q.n] = Math.min(30, Math.round(q.sec * 0.3)); });
    const blankBack = qs.find((q) => q.verdict === 'blank' && q.sec >= 60);
    if (blankBack) returns[blankBack.n] = 20;
    const events = [];
    let t = 0;
    const first = {};
    qs.forEach((q) => {
      const dur = q.sec - (returns[q.n] || 0);
      first[q.n] = { from: t, to: t + dur };
      const mine = q.verdict === 'wrong' ? (q.pick || LET[(q.n + 1) % 4]) : LET[q.n % 4];
      if (q.verdict === 'blank') events.push({ t: t + dur, q: q.n, kind: 'blank', text: `Q${q.n} opened, left blank` });
      else if (q.change && !q.change.later) {
        events.push({ t: Math.round(t + dur * 0.45), q: q.n, kind: 'pick', text: `Q${q.n} picked ${q.change.from}` });
        events.push({ t: Math.round(t + dur * 0.92), q: q.n, kind: 'change', text: `Q${q.n} changed ${q.change.from} to ${q.change.to}${q.change.effect < 0 ? ', a right answer made wrong' : q.change.effect > 0 ? ', now right' : ', still wrong'}` });
      } else if (q.change?.later) events.push({ t: Math.round(t + dur * 0.7), q: q.n, kind: 'pick', text: `Q${q.n} picked ${q.change.from}` });
      else events.push({ t: Math.round(t + dur * 0.75), q: q.n, kind: 'pick', text: `Q${q.n} picked ${mine}` });
      t += dur;
    });
    const firstPassEnd = t;
    Object.keys(returns).map(Number).sort((a, b) => a - b).forEach((n) => {
      const q = qs[n - 1];
      const dur = returns[n];
      if (q.change?.later) events.push({ t: Math.round(t + dur * 0.8), q: n, kind: 'change', text: `Q${n} changed ${q.change.from} to ${q.change.to} on a return visit${q.change.effect > 0 ? ', now right' : ''}` });
      else events.push({ t: t + dur, q: n, kind: 'back', text: `Back to Q${n}, still left blank` });
      t += dur;
    });
    events.sort((a, b) => a.t - b.t);
    events.push({ t, q: null, kind: 'end', text: `Submitted at ${clock(t)}` });
    return { events, first, firstPassEnd, end: t, returns };
  }

  function changeTimes(paper) {
    const tl = timeline(paper);
    const out = {};
    for (const e of tl.events) {
      if (e.kind === 'pick' && paper.questions[e.q - 1].change) out[e.q] = { ...(out[e.q] || {}), at: e.t };
      if (e.kind === 'change') out[e.q] = { ...(out[e.q] || {}), to_at: e.t };
    }
    return out;
  }

  // mount(el, paper, { expanded, clockAt, selected })
  function mount(el, paper, opts = {}) {
    const tl = timeline(paper);
    const N = paper.questions.length;
    const state = { expanded: opts.expanded ?? true, at: opts.clockAt ?? null, sel: opts.selected ?? null, playing: false, timer: null };
    el.classList.add('rb');
    el.innerHTML = `
      <div class="rb-head">
        <div class="rb-clock"><b data-clock>${clock(tl.end)}</b><span data-of>of ${clock(tl.end)}</span></div>
        <div class="rb-ctl">
          <button type="button" class="rb-btn" data-prev aria-label="Previous event"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
          <button type="button" class="rb-btn rb-play" data-play><svg viewBox="0 0 24 24" data-ico><path d="M8 5v14l11-7z"/></svg><span data-play-label>Play</span></button>
          <button type="button" class="rb-btn" data-next aria-label="Next event"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
        </div>
      </div>
      <p class="rb-cap" data-cap aria-live="polite"></p>
      <div class="rb-grid" data-grid></div>
      <div class="rb-foot">
        <span class="rb-key"><i data-k="right"></i>Right <i data-k="wrong"></i>Wrong <i data-k="blank"></i>Blank <i data-k="changed"></i>Changed <i data-k="pace"></i>Even pace</span>
        <button type="button" class="rb-toggle" data-toggle></button>
      </div>
      <p class="rb-detail" data-detail></p>`;
    const grid = el.querySelector('[data-grid]');
    const capEl = el.querySelector('[data-cap]');
    const clockEl = el.querySelector('[data-clock]');
    const detail = el.querySelector('[data-detail]');

    function draw() {
      const W = grid.clientWidth || 340;
      const gap = 2;
      grid.innerHTML = '';
      grid.dataset.mode = state.expanded ? 'open' : 'line';
      if (!state.expanded) {
        const row = document.createElement('div');
        row.className = 'rb-line';
        row.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
        paper.questions.forEach((q) => { const i = document.createElement('i'); i.dataset.v = q.verdict; if (q.changed) i.dataset.changed = ''; row.appendChild(i); });
        grid.appendChild(row);
        const lab = document.createElement('div');
        lab.className = 'rb-line-lab';
        lab.innerHTML = `<span>Q1</span><span>Q${N}</span>`;
        grid.appendChild(lab);
      } else {
        const minSlot = W < 600 ? 12 : 16;
        const rows = Math.max(1, Math.ceil((N * (minSlot + gap)) / W));
        const per = Math.ceil(N / rows);
        const H = W < 600 ? 60 : 72;
        for (let r = 0; r < rows; r++) {
          const row = document.createElement('div');
          row.className = 'rb-row';
          row.style.gridTemplateColumns = `repeat(${per}, minmax(0, 1fr))`;
          row.style.setProperty('--h', `${H}px`);
          const slice = paper.questions.slice(r * per, r * per + per);
          slice.forEach((q) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'rb-q';
            b.dataset.v = q.verdict;
            b.dataset.n = q.n;
            if (q.changed) b.dataset.changed = '';
            if (state.sel === q.n) b.dataset.sel = '';
            const ratio = Math.max(0.07, Math.min(3, q.sec / paper.pace)) / 3;
            b.style.setProperty('--f', ratio.toFixed(3));
            b.setAttribute('aria-label', `Question ${q.n}: ${q.verdict}, ${fmt(q.sec)}${q.changed ? ', answer changed' : ''}`);
            b.innerHTML = `<span class="rb-col"><i></i></span><em>${per <= 12 || q.n === 1 || q.n % 5 === 0 ? q.n : ''}</em>`;
            b.addEventListener('click', () => { state.sel = q.n; showDetail(q); draw(); applyClock(); });
            row.appendChild(b);
          });
          const pace = document.createElement('span');
          pace.className = 'rb-pace';
          row.appendChild(pace);
          grid.appendChild(row);
        }
      }
      el.querySelector('[data-toggle]').textContent = state.expanded ? 'Collapse' : `Expand all ${N}`;
    }

    function showDetail(q) {
      const c = changeTimes(paper)[q.n];
      const parts = [`Q${q.n}`, q.chapter, `${fmt(q.sec)} on it, even pace ${fmt(paper.pace)}`];
      if (q.change && c) parts.push(`picked ${q.change.from} at ${clock(c.at)}, changed to ${q.change.to} at ${clock(c.to_at)}`);
      parts.push(q.verdict === 'right' ? 'right, +5' : q.verdict === 'wrong' ? 'wrong, −1' : 'left blank, 0');
      detail.textContent = parts.filter(Boolean).join(' · ');
    }

    function applyClock() {
      const at = state.at;
      clockEl.textContent = clock(at == null ? tl.end : at);
      const seen = new Set();
      if (at != null) tl.events.forEach((e) => { if (e.t <= at && e.q) seen.add(e.q); });
      el.querySelectorAll('.rb-q').forEach((b) => {
        const n = Number(b.dataset.n);
        const started = at == null || tl.first[n].from <= at;
        b.dataset.dim = started ? '' : '1';
        if (!started) b.dataset.dim = '1'; else delete b.dataset.dim;
        const cur = at != null && tl.events.filter((e) => e.t <= at && e.q).slice(-1)[0]?.q === n;
        if (cur) b.dataset.now = ''; else delete b.dataset.now;
      });
      const last = at == null ? null : tl.events.filter((e) => e.t <= at).slice(-1)[0];
      if (at == null) {
        const answered = paper.questions.filter((q) => q.verdict !== 'blank').length;
        capEl.innerHTML = `<b>${answered} of ${N} answered</b> in ${fmt(tl.end)}. First pass ended at ${clock(tl.firstPassEnd)}${Object.keys(tl.returns).length ? `, then ${Object.keys(tl.returns).length} return visits` : ''}.`;
      } else capEl.innerHTML = last ? `<b>${clock(last.t)}</b> ${last.text}` : `<b>0:00</b> The paper starts`;
    }

    function step(dir) {
      const ts = tl.events.map((e) => e.t);
      const cur = state.at == null ? (dir > 0 ? -1 : tl.end + 1) : state.at;
      const next = dir > 0 ? ts.find((t) => t > cur) : [...ts].reverse().find((t) => t < cur);
      if (next != null) { state.at = next; applyClock(); }
    }
    function play() {
      if (state.playing) { stop(); return; }
      state.playing = true;
      el.querySelector('[data-play-label]').textContent = 'Pause';
      if (state.at == null || state.at >= tl.end) state.at = 0;
      const started = performance.now(), from = state.at, span = 12000 * ((tl.end - from) / tl.end);
      const tick = (now) => {
        const p = Math.min(1, (now - started) / Math.max(span, 1));
        state.at = Math.round(from + (tl.end - from) * p);
        applyClock();
        if (p < 1 && state.playing) state.timer = requestAnimationFrame(tick); else stop();
      };
      state.timer = requestAnimationFrame(tick);
    }
    function stop() { state.playing = false; cancelAnimationFrame(state.timer); el.querySelector('[data-play-label]').textContent = 'Play'; }

    el.querySelector('[data-prev]').addEventListener('click', () => step(-1));
    el.querySelector('[data-next]').addEventListener('click', () => step(1));
    el.querySelector('[data-play]').addEventListener('click', play);
    el.querySelector('[data-toggle]').addEventListener('click', () => { state.expanded = !state.expanded; draw(); applyClock(); });
    draw();
    applyClock();
    if (state.sel) showDetail(paper.questions[state.sel - 1]);
    window.addEventListener('resize', () => { draw(); applyClock(); });
    return { state, tl };
  }

  window.MMReplay = { mount, timeline, changeTimes };
})();
