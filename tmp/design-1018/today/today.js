// Today 1018 mock: render and interactions (vanilla, no build). Query: ?state=active|dayone|returning|done|loading|error
// &theme=night|day &chrome=0 (hide the owner band) &pick=<moveId> &day=<mon..sun> &ch=<chapterId> &len=1 &open=plan1|plan2|plan3
// &own=1 (own exam date) &anim=0. The platform comes from <body data-platform>.
(() => {
  const F = window.TODAY_FIXTURE;
  const q = new URLSearchParams(location.search);
  const body = document.body;
  const platform = body.dataset.platform;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- icons (lucide paths) ----------
  const P = {
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    practice: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    review: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8M13 12h8M13 18h8"/>',
    progress: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    colleges: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    you: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/>',
    updown: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    plus: '<path d="M5 12h14M12 5v14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
    sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
    revise: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    shuffle: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-7.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    play: '<path d="M6 4l13 8-13 8z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    retry: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  };
  const ic = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
  const plural = (n, w, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`;

  // ---------- dates (src/lib/today/road.mjs, same arithmetic) ----------
  const TODAY = '2026-10-18';
  const D = (k) => new Date(`${k}T00:00:00Z`);
  const key = (d) => d.toISOString().slice(0, 10);
  const addDays = (k, n) => key(new Date(D(k).getTime() + n * 864e5));
  const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 864e5);
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MOL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const shortDay = (k) => { const d = D(k); return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`; };
  const BOARDS = ['2027-02-15', '2027-04-05'];
  const sessionsUntil = (until, perWeek) => {
    const weeks = Math.floor(daysBetween(TODAY, until) / 7); let n = 0;
    for (let k = 0; k < weeks; k++) { const s = addDays(TODAY, 7 * k); n += s >= BOARDS[0] && s < BOARDS[1] ? Math.min(perWeek, 2) : perWeek; }
    return n;
  };
  const weeksTo = (exam) => Math.floor(daysBetween(TODAY, exam) / 7);
  const fitTarget = (n, taken) => Math.min(60, Math.max(1, Math.max(n, taken + 1)));
  const suggested = (weeks, taken) => fitTarget(Math.max(5, Math.ceil(weeks / 2)), taken);
  const mockChoices = (weeks, taken) => {
    const all = [
      { id: 'fortnight', title: 'One a fortnight', value: suggested(weeks, taken), note: 'Suggested. Steady practice alongside your chapters.' },
      { id: 'weekly', title: 'One a week', value: fitTarget(Math.max(1, weeks), taken), note: 'The most practice: a full paper every week.' },
      { id: 'monthly', title: 'One a month', value: fitTarget(Math.ceil(Math.max(1, weeks) / 4), taken), note: 'Lighter: more of your time on chapters.' },
    ];
    const seen = new Set(); return all.filter((c) => (seen.has(c.value) ? false : (seen.add(c.value), true)));
  };
  const mockPace = (target, taken, exam) => {
    const left = Math.max(0, target - taken); const days = daysBetween(TODAY, exam);
    if (!left) return { left, words: 'target reached' };
    const weeks = days / 7; const per = left / weeks;
    if (per > 1) return { left, words: `about ${Math.ceil(per)} a week` };
    const every = Math.max(1, Math.floor(weeks / left));
    return { left, words: every === 1 ? 'about one a week' : every === 2 ? 'one a fortnight' : `one every ${every} weeks` };
  };
  const nextMilestone = (exam) => {
    const steps = [
      { day: '2027-02-01', title: 'Registration expected to open' },
      { day: BOARDS[0], title: 'Board exams expected to begin' },
      { day: BOARDS[1], title: 'Board exams expected to end' },
      { day: exam, title: 'CUET UG expected to begin' },
    ].filter((s) => s.day > TODAY && s.day <= exam);
    const s = steps[0]; const days = daysBetween(TODAY, s.day);
    return { ...s, when: days < 14 ? plural(days, 'day') : plural(Math.floor(days / 7), 'week') };
  };

  // ---------- state ----------
  const state = q.get('state') || 'active';
  const sets = {
    active: { rec: 'repair', alts: ['revise', 'practise'] },
    dayone: { rec: 'dayOne', alts: ['fullMock', 'another'] },
    returning: { rec: 'warmUp', alts: ['repairBack', 'reviseBack'] },
    done: { rec: 'done', alts: ['practise', 'fullMock'] },
  };
  const set = sets[state] || sets.active;
  const S = {
    lead: q.get('pick') || set.rec, rec: set.rec, alts: set.alts, minutes: {}, lenOpen: q.get('len') === '1',
    day: q.get('day') || 'sun', open: q.get('ch') ? { [q.get('ch')]: true } : {},
    plan: { exam: q.get('own') === '1' ? '2027-05-15' : '2027-05-01', own: q.get('own') === '1', days: [...F.road.days], target: state === 'dayone' ? null : F.road.target },
    saved: null, step: 1, status: '', receipt: '', month: 4,
  };
  const taken = state === 'dayone' ? 0 : F.road.taken;
  if (S.plan.target == null) S.plan.target = suggested(weeksTo(S.plan.exam), taken);
  S.saved = { ...S.plan, days: [...S.plan.days] };

  const doneMove = { id: 'done', subject: null, art: null, kind: 'Done', title: 'Done for tonight', number: 24, label: 'minutes practised tonight', stake: null, minutes: null,
    why: 'Saved at 8:52 PM: 4 repairs and 6 Revise questions. Tomorrow starts with the 7 mistakes still open from Saturday.',
    key: 'See tonight’s repairs', price: '', choice: { title: 'Done for tonight', value: '24 minutes' } };
  const moveOf = (id) => {
    const m = id === 'done' ? doneMove : F.moves[id];
    const min = S.minutes[id];
    if (!m.lengths || !min) return { ...m };
    const n = m.lengths[min];
    const stake = m.id === 'repair' || m.id === 'repairBack' ? n * 6 : m.stake;
    return { ...m, number: n, minutes: min, stake, label: m.id === 'practise' || m.id === 'warmUp' ? m.label.replace(/^\S+/, 'questions').replace(/^questions questions/, 'questions') : m.label };
  };

  // ---------- render: the lead card ----------
  function leadBody() {
    const m = moveOf(S.lead);
    const picked = S.lead !== S.rec;
    const art = m.art ? `<span class="lead__art"><img src="assets/art/obj-${m.art}.webp" alt=""></span>`
      : `<span class="lead__glyph">${ic(m.id === 'done' ? 'check' : 'revise')}</span>`;
    const over = m.id === 'done' ? 'Today' : picked ? 'Up next, <b>your pick</b>' : 'Up next';
    const subj = m.subject ? F.subjects[m.subject] : '';
    const lenTok = m.minutes ? (m.lengths
      ? `<button type="button" class="token" data-act="len" aria-expanded="${S.lenOpen}" aria-controls="lengths">about ${m.minutes} min ${ic('updown')}</button>`
      : `<span>about <b>${m.minutes}</b> min</span>`) : '';
    const stake = m.stake ? `<span><b>${m.stake}</b> ${m.stakeWord}</span>` : '';
    const lengths = m.lengths ? `<div class="lengths" id="lengths" data-open="${S.lenOpen}"><div><div class="lengths__row" role="radiogroup" aria-label="How long do you have?">${[10, 20, 30].map((n) => `<button type="button" role="radio" class="len" data-act="minutes" data-n="${n}" aria-checked="${S.minutes[m.id] === n}"><b>${n} min</b><span>${m.lengthUnit(m.lengths[n])}</span></button>`).join('')}</div></div></div>` : '';
    return `
      <div class="lead__top">
        <div><p class="lead__over">${over}${subj ? `, ${subj}` : ''}</p><p class="lead__title">${m.title}</p></div>
        ${art}
      </div>
      <p class="lead__figure"><span class="lead__num" data-num="${m.number}">${m.number}</span><span class="lead__label">${m.label}</span></p>
      ${stake || lenTok ? `<p class="lead__value">${stake}${lenTok}</p>` : ''}
      ${lengths}
      <p class="lead__why">${m.why}</p>
      <a class="key" href="#start" data-page-primary>${m.key}${m.minutes ? `<small>${m.minutes} min</small>` : ''}</a>
      ${m.price ? `<p class="lead__price">${m.price}</p>` : ''}`;
  }
  function choices() {
    const ids = [S.rec, ...S.alts].filter((id) => id !== S.lead).slice(0, 2);
    return ids.map((id) => {
      const m = moveOf(id);
      return `<button type="button" class="or__btn" data-act="pick" data-id="${id}" aria-label="${m.choice.title}: ${m.choice.value}. Show it in Up next.">
        ${id === S.rec ? '<span class="or__s">Suggested</span>' : ''}<span class="or__t">${m.choice.title}</span><span class="or__v">${m.choice.value}</span></button>`;
    }).join('');
  }
  function lead() {
    if (state === 'loading') return `<section class="lead lead--wait" aria-busy="true" aria-label="Loading your next move"><span class="sk"></span><span class="sk"></span><span class="sk"></span><span class="sk"></span><span class="sk"></span></section>`;
    if (state === 'error') return `<section class="lead lead--failed" aria-labelledby="lf"><div class="lead__top"><div><p class="lead__over">Up next</p><h2 id="lf" class="lead__title">Tonight’s move did not load</h2></div><span class="lead__glyph">${ic('retry')}</span></div>
      <p class="lead__why">MockMob did not answer, so tonight’s move could not be worked out. Your papers and mistakes are safe; Review still opens them.</p>
      <p class="note" role="status">Tried again at 7:41 PM. Still not loading.</p>
      <button type="button" class="key">${ic('retry')}Try again</button><div style="height:22px"></div></section>`;
    return `<section class="lead" aria-labelledby="lead-h"><h2 id="lead-h" class="sr">Up next</h2>
      <div class="lead__body" id="lead-body">${leadBody()}</div>
      <div class="or" id="or" role="group" aria-label="Or do this instead">${choices()}</div>
      <div class="lead__more"><button type="button">More ways to practise</button></div>
    </section>`;
  }

  // ---------- render: this week ----------
  function weekData() {
    const w = F.week.map((d) => ({ ...d, done: [...d.done] }));
    if (state === 'dayone') w.forEach((d) => { d.done = []; });
    if (state === 'returning') w.forEach((d) => { d.done = []; });
    if (state === 'done') w[6].done = [{ what: 'Repair', detail: '4 mistakes, Accountancy', at: '8:31 PM' }, { what: 'Revise', detail: '6 questions, 5 held', at: '8:52 PM' }];
    return w;
  }
  const dayState = (d, i) => (state === 'dayone' && i < 6 ? 'before' : d.done.length ? 'done' : d.planned ? (i < 6 ? 'missed' : 'planned') : 'rest');
  function weekDetail(w) {
    const d = w.find((x) => x.key === S.day) || w[6];
    if (d.done.length) return `<h3>${d.date}</h3><ul>${d.done.map((x) => `<li><span>${x.what}, ${x.detail}</span><time>${x.at}</time></li>`).join('')}</ul>`;
    if (d.today && state === 'error') return `<h3>${d.date}, planned</h3><p>Your move shows here once it loads.</p>`;
    if (d.today) {
      const m = moveOf(S.lead === 'done' ? 'practise' : S.lead);
      return `<h3>${d.date}, planned</h3><p>Up next: ${m.title.toLowerCase().replace(/^./, (c) => c.toUpperCase())}${m.minutes ? `, about ${m.minutes} minutes` : ''}.</p>`;
    }
    if (d.planned) return `<h3>${d.date}, planned</h3><p>No session saved that day. The week still counts any 4 days.</p>`;
    return `<h3>${d.date}</h3><p>A rest day in your plan. Anything you practise still counts.</p>`;
  }
  function week() {
    if (state === 'loading') return `<section class="week" style="--k:1" aria-busy="true"><span class="sk wait-h"></span><span class="sk wait-block"></span></section>`;
    const w = weekData();
    const done = w.filter((d) => d.done.length).length;
    const sel = Math.max(0, w.findIndex((d) => d.key === S.day));
    const cap = state === 'done' ? `<b>Goal met: ${done} of ${F.goal} study days.</b> Anything more this week is extra.`
      : state === 'dayone' ? `Your plan is ${F.goal} days a week. <b>Today is the first.</b>`
        : state === 'returning' ? `A new week starts with one session. <b>Today can be day one of ${F.goal}.</b>`
          : `${done} of ${F.goal} done. <b>One more today meets your goal.</b>`;
    return `<section class="week" style="--k:1" aria-labelledby="wk-h">
      <header class="sec-h"><h2 id="wk-h">This week</h2><p class="fig"><b>${done}</b><span class="of">of ${F.goal}</span><span>study days</span></p></header>
      <ol class="week__days" style="--sel:${sel}" aria-label="Days of this week">
        <span class="week__sel" aria-hidden="true"></span>
        ${w.map((d, i) => `<li><button type="button" class="day" data-act="day" data-key="${d.key}" data-s="${dayState(d, i)}" ${d.today ? 'data-today' : ''} aria-pressed="${d.key === S.day}" style="--i:${i}" aria-label="${d.date}: ${d.done.length ? plural(d.done.length, 'session') + ' saved' : d.planned ? 'planned' : 'rest day'}">
          <span class="dot">${d.done.length ? '<svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.6 3.6 7.4-8.2" pathLength="1"/></svg>' : ''}</span><span class="day__n">${d.today ? 'Today' : d.name}</span></button></li>`).join('')}
      </ol>
      <div class="week__detail" id="week-detail" aria-live="polite">${weekDetail(w)}</div>
      <p class="week__cap">${cap}</p>
    </section>`;
  }

  // ---------- render: road to CUET ----------
  function road() {
    if (state === 'loading') return `<section class="road" style="--k:2" aria-busy="true"><span class="sk wait-h"></span><span class="sk wait-block" style="height:220px"></span></section>`;
    const p = S.saved;
    const weeks = weeksTo(p.exam);
    const study = sessionsUntil(p.exam, p.days.length);
    const ms = nextMilestone(p.exam);
    const tgt = p.target;
    const sug = state === 'dayone';
    return `<section class="road" style="--k:2" id="road" aria-labelledby="rd-h">
      <header class="sec-h"><h2 id="rd-h">Road to CUET</h2></header>
      <button type="button" class="road__btn" data-act="plan" aria-label="Road to CUET: ${weeks} weeks to ${p.own ? 'your date' : 'CUET UG'}, ${taken} of ${tgt} full mocks, ${study} study days left. Change plan.">
        <div class="road__top"><div><p class="road__weeks"><b data-num="${weeks}">${weeks}</b><span>weeks to ${p.own ? 'your date' : 'CUET UG'}</span></p>
          <p class="road__date">${p.own ? `Your date, ${shortDay(p.exam)} 2027` : `Expected from ${shortDay(p.exam)} 2027`}</p></div></div>
        <dl class="road__facts">
          <div><dt>Full mocks</dt><dd><b>${taken} <small>of ${tgt}</small></b>${sug ? 'suggested' : `${mockPace(tgt, taken, p.exam).words}`}<span class="mocks" aria-hidden="true">${Array.from({ length: Math.min(tgt, 30) }, (_, i) => `<i ${i < taken ? 'data-on' : ''}></i>`).join('')}</span></dd></div>
          <div><dt>Study days left</dt><dd><b>${study}</b>at ${p.days.length} a week</dd></div>
          <div class="road__next"><dt class="sr">Next</dt><dd>Next, <b>in ${ms.when}</b>: ${ms.title.charAt(0).toLowerCase() + ms.title.slice(1)}, ${shortDay(ms.day)}.</dd></div>
        </dl>
        <div class="road__foot"><span class="road__note">${sug ? 'Set your date and days. It takes three taps.' : 'Your date, days and mock target.'}</span><span class="road__cta">${ic('sliders')}Change plan</span></div>
      </button>
      ${S.receipt ? `<p class="road__receipt" role="status">${S.receipt}</p>` : ''}
    </section>`;
  }

  // ---------- render: weak chapters ----------
  function weak() {
    if (state === 'loading') return `<section class="weak" style="--k:3" aria-busy="true"><span class="sk wait-h"></span><span class="sk wait-block" style="height:228px"></span></section>`;
    if (state === 'dayone') return `<section class="weak" style="--k:3" aria-labelledby="wc-h"><header class="sec-h"><h2 id="wc-h">Weak chapters</h2></header>
      <p class="empty">After your first paper, the three chapters costing you the most marks show here, each with Practise and its mistakes.</p></section>`;
    if (state === 'error') return `<section class="weak" style="--k:3" aria-labelledby="wc-h"><header class="sec-h"><h2 id="wc-h">Weak chapters</h2></header>
      <p class="empty">Your weak chapters did not load. <button type="button" class="link">Try again</button></p></section>`;
    return `<section class="weak" style="--k:3" aria-labelledby="wc-h">
      <header class="sec-h"><h2 id="wc-h">Weak chapters</h2></header>
      <p class="weak__sub">Where your marks go, from your last 9 papers</p>
      <ul class="wk">${F.chapters.map((c) => {
        const open = !!S.open[c.id];
        return `<li><div class="wk__row">
          <button type="button" class="wk__open" data-act="ch" data-id="${c.id}" aria-expanded="${open}" aria-controls="m-${c.id}">
            ${ic('plus')}<span class="wk__t"><b>${c.chapter}</b><span>${c.subject}, ${c.missed} of ${c.n} missed</span></span>
            <span class="wk__fig"><b>${c.open}</b><span>marks</span></span></button>
          <a class="pill" href="#practise" aria-label="Practise ${c.chapter}">${ic('play')}Practise</a>
        </div>
        <div class="wk__more" id="m-${c.id}" data-open="${open}"><div>
          <ul class="wk__list">${c.mistakes.map((k) => `<li class="mk"><div><span class="mk__meta">${k.q}, ${k.paper}, ${k.at}</span><p class="mk__stem">${k.stem}</p></div>
            ${k.state === 'repaired' ? '<a class="mk__act" href="#repair">See repair<span class="mk__state">Repaired</span></a>' : `<a class="mk__act" href="#repair" aria-label="Repair ${k.q}, cost you ${k.cost} marks">Repair</a>`}</li>`).join('')}</ul>
          <p class="wk__all"><a class="link" href="#review">All ${c.missed} in Review</a></p>
        </div></div></li>`;
      }).join('')}</ul>
    </section>`;
  }

  // ---------- render: last paper ----------
  function paper() {
    if (state === 'dayone') return '';
    if (state === 'loading') return `<section class="paper" style="--k:4" aria-busy="true"><span class="sk wait-h"></span><span class="sk wait-block" style="height:170px"></span></section>`;
    const p = F.papers[0];
    const when = state === 'returning' ? 'Sat 3 Oct, 8:40 PM, 15 days ago' : `${p.at}, +12 on the one before`;
    const tot = p.right + p.wrong + p.blank;
    return `<section class="paper" style="--k:4" aria-labelledby="lp-h">
      <header class="sec-h"><h2 id="lp-h">Last paper</h2></header>
      <div class="paper__row"><div class="paper__t"><b>${p.name}</b><span>${when}</span></div>
        <p class="paper__fig"><b>${p.marks}</b><span>of ${p.max}</span></p></div>
      <div class="bar" role="img" aria-label="${p.right} right, ${p.wrong} wrong, ${p.blank} blank of ${tot}"><i class="r" style="width:${(p.right / tot) * 100}%"></i><i class="w" style="width:${(p.wrong / tot) * 100}%"></i><i class="b" style="width:${(p.blank / tot) * 100}%"></i></div>
      <p class="bar__key"><span><i class="r" style="background:var(--ink)"></i>${p.right} right</span><span><i style="background:var(--bad)"></i>${p.wrong} wrong</span><span><i style="background:var(--line2)"></i>${p.blank} blank</span><span>of ${tot}</span></p>
      <p class="paper__leak">Biggest leak: <b>${F.leak.chapter}</b>, ${F.leak.here} of your ${F.leak.of} misses (${F.leak.wrong} wrong, ${F.leak.blank} blank).</p>
      <div class="paper__acts"><a class="pill" href="#repair">${ic('wrench')}Repair this leak</a><a class="link" href="#result">Open the result</a></div>
    </section>`;
  }

  // ---------- render: repairs and revise ----------
  function queue() {
    if (state === 'loading') return `<section class="queue" style="--k:5" aria-busy="true"><span class="sk wait-block" style="height:112px"></span></section>`;
    if (state === 'dayone') return `<section class="queue" style="--k:5" aria-labelledby="qu-h"><header class="sec-h"><h2 id="qu-h">Repairs and Revise</h2></header>
      <p class="empty">Every wrong answer waits here with its explanation. Repair finds the reason; Revise brings it back after 1, 3, 7 and 21 days.</p></section>`;
    const r = state === 'done' ? { open: 7, check: 6 } : { open: F.repairs.open, check: F.repairs.toCheck };
    const v = state === 'done' ? { n: 0, s: 'Nothing due. The next 3 come back Tuesday.' } : state === 'returning' ? { n: 10, s: '14 waiting, 10 a day. Free.' } : { n: F.revise.due, s: 'Free, about 8 min' };
    return `<section class="queue" style="--k:5" aria-labelledby="qu-h">
      <header class="sec-h"><h2 id="qu-h">Repairs and Revise</h2></header>
      <div class="queue__grid">
        <a class="q" href="#repairs"><span class="q__h">Repairs</span><span class="q__n"><b>${r.open}</b><span>open</span></span><span class="q__s">${r.check} repaired, ready to check on fresh questions</span></a>
        <a class="q" href="#revise"><span class="q__h">Revise</span><span class="q__n"><b>${v.n}</b><span>due today</span></span><span class="q__s">${v.s}</span></a>
      </div>
    </section>`;
  }

  // ---------- render: colleges and compass ----------
  function cols() {
    if (state === 'loading') return `<section class="cols" style="--k:6" aria-busy="true"><span class="sk wait-h"></span><span class="sk wait-block" style="height:120px"></span></section>`;
    if (state === 'dayone') return `<section class="cols" style="--k:6" aria-labelledby="cl-h"><header class="sec-h"><h2 id="cl-h">Your colleges</h2></header>
      <div class="cl__fit"><p>Pick up to 8 colleges to see their 2026 cutoffs here.</p><a class="pill" href="#colleges">${ic('plus')}Choose colleges</a></div></section>`;
    const c = F.colleges;
    return `<section class="cols" style="--k:6" aria-labelledby="cl-h">
      <header class="sec-h"><h2 id="cl-h">Your colleges</h2></header>
      <a class="cl__row" href="#compass" style="text-decoration:none"><span class="cl__t"><b>${c.first}</b><span>${c.programme}, 2026 Round 1, unreserved. ${c.more} more saved.</span></span>
        <span class="cl__fig"><b>${c.cutoff}</b><span>cutoff of 1000</span></span></a>
      <div class="cl__fit"><p>${c.fit}</p><a class="pill" href="#compass">${ic('compass')}Open in Compass</a></div>
    </section>`;
  }

  // ---------- page ----------
  function hello() {
    if (state === 'returning') return `Welcome back, ${F.name}`;
    if (state === 'dayone') return `Good evening, ${F.name}`;
    return `Good evening, ${F.name}`;
  }
  function page() {
    return `<header class="t-head"><div><p class="t-date"><time>${F.dateLine}</time></p><h1 class="t-hello">${hello()}</h1></div>${platform === 'app' ? '<span class="avatar" aria-label="You">A</span>' : ''}</header>
      <div class="t-grid">
        <div class="t-col">${lead()}${state === 'loading' ? '' : `<button type="button" class="cue" data-act="cue"><span>Your week, the road and weak chapters</span>${ic('down')}</button>`}${weak()}${paper()}</div>
        <div class="t-col">${week()}${road()}${queue()}${cols()}</div>
      </div>`;
  }
  function shell() {
    const nav = [['today', 'Today'], ['practice', 'Practice'], ['review', 'Review'], ['progress', 'Progress'], ['colleges', 'Colleges']];
    const ctl = `<div class="ctl" role="region" aria-label="Mock controls"><b>Today 1018 mock</b><span>Illustrative data.</span>
      <span class="ctl__group">State: ${['active', 'dayone', 'returning', 'done', 'loading', 'error'].map((s) => `<button type="button" data-ctl="state" data-v="${s}" aria-pressed="${s === state}">${{ active: 'Active', dayone: 'Day one', returning: 'Returning', done: 'Done', loading: 'Loading', error: 'Error' }[s]}</button>`).join('')}</span>
      <span class="ctl__group">Theme: ${['night', 'day'].map((t) => `<button type="button" data-ctl="theme" data-v="${t}" aria-pressed="${body.dataset.theme === t}">${t === 'night' ? 'Night' : 'Day'}</button>`).join('')}</span></div>`;
    if (platform === 'app') {
      const tabs = [['today', 'Today'], ['practice', 'Practice'], ['review', 'Review'], ['colleges', 'Colleges'], ['you', 'You']];
      return `${ctl}<div class="shell"><div class="status"><span>7:40</span><span><i></i><i style="width:18px"></i></span></div>
        <main class="page" id="page">${page()}</main>
        <nav class="adock" aria-label="Main">${tabs.map(([k, l]) => `<a href="#${k}" ${k === 'today' ? 'aria-current="page"' : ''}>${ic(k)}<span>${l}</span></a>`).join('')}</nav></div>`;
    }
    return `${ctl}<div class="shell">
      <aside class="side"><a class="logo" href="#">mockmob<i></i></a>${nav.map(([k, l]) => `<a class="nav" href="#${k}" ${k === 'today' ? 'aria-current="page"' : ''}>${ic(k)}${l}</a>`).join('')}<div class="side__foot">Asha Verma<br>Pro until 31 Jul 2027</div></aside>
      <div><header class="top"><a class="logo" href="#">mockmob<i></i></a><div class="top__end"><span class="chip">${ic('coins')}<b>120</b> credits</span><span class="avatar" aria-label="You">A</span></div></header>
      <main class="page" id="page">${page()}</main></div>
      <nav class="dock" aria-label="Main">${nav.map(([k, l]) => `<a href="#${k}" ${k === 'today' ? 'aria-current="page"' : ''}><span class="dock__ic">${ic(k)}</span>${l}</a>`).join('')}</nav></div>`;
  }

  // ---------- Change plan sheet ----------
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet'; dlg.setAttribute('aria-labelledby', 'cp-h');
  function sentence() {
    const p = S.plan;
    const t = (n, label) => `<button type="button" class="stok" data-act="step" data-n="${n}" ${S.step === n ? 'aria-current="step"' : ''}>${label}</button>`;
    return `<p class="sentence">I sit CUET UG on ${t(1, p.own ? shortDay(p.exam) : `${shortDay(p.exam)}, expected`)}, study ${t(2, plural(p.days.length, 'day'))} a week, and take ${t(3, plural(p.target, 'full mock'))} before it.</p>`;
  }
  function calendar() {
    const y = 2027; const m = S.month; const first = new Date(Date.UTC(y, m, 1)); const off = (first.getUTCDay() + 6) % 7;
    const n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const cells = Array.from({ length: off }, () => '<span></span>').join('') + Array.from({ length: n }, (_, i) => {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      return `<button type="button" data-act="cal" data-k="${k}" aria-pressed="${S.plan.own && S.plan.exam === k}" ${k === '2027-05-01' ? 'data-exp' : ''} aria-label="${shortDay(k)}">${i + 1}</button>`;
    }).join('');
    return `<div class="cal"><div class="cal__h"><span>${MOL[m]} 2027</span><span class="cal__m"><button type="button" data-act="month" data-m="4" aria-pressed="${m === 4}">May</button><button type="button" data-act="month" data-m="5" aria-pressed="${m === 5}">June</button></span></div>
      <div class="cal__g">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span>${d}</span>`).join('')}${cells}</div></div>`;
  }
  function stepBody() {
    const p = S.plan;
    if (S.step === 1) {
      return `<p class="step__q" id="sq">When do you sit CUET UG?</p><div role="radiogroup" aria-labelledby="sq">
        <button type="button" role="radio" class="opt" data-act="exp" aria-checked="${!p.own}"><span class="opt__r"></span><span class="opt__t"><b>The expected start</b><span>Sat 1 May 2027. NTA has not published the 2027 dates yet.</span></span></button>
        <button type="button" role="radio" class="opt" data-act="ownopen" aria-checked="${p.own || S.ownOpen ? 'true' : 'false'}"><span class="opt__r"></span><span class="opt__t"><b>My own date</b><span>${p.own ? `Set to ${shortDay(p.exam)}.` : 'Once your admit card shows it.'}</span></span></button></div>
        ${p.own || S.ownOpen ? calendar() : ''}`;
    }
    if (S.step === 2) {
      const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return `<p class="step__q" id="sq">Which days can you study?</p>
        <div class="days7" role="group" aria-labelledby="sq">${names.map((n, i) => `<button type="button" class="d7" data-act="d7" data-i="${i}" aria-pressed="${p.days.includes(i)}"><i>${p.days.includes(i) ? '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>' : ''}</i><span>${n}</span></button>`).join('')}</div>
        <p class="step__hint">Board weeks, 15 Feb to 5 Apr, ease to 2 days. Any day you practise counts, planned or not.</p>`;
    }
    const weeks = weeksTo(p.exam);
    const ch = mockChoices(weeks, taken);
    const isChoice = ch.some((c) => c.value === p.target);
    return `<p class="step__q" id="sq">How many full mocks before your exam?</p><div role="radiogroup" aria-labelledby="sq">
      ${ch.map((c) => `<button type="button" role="radio" class="opt" data-act="tgt" data-v="${c.value}" aria-checked="${c.value === p.target}"><span class="opt__r"></span><span class="opt__t"><b>${c.title}</b><span>${c.note}</span></span><span class="opt__n">${c.value}</span></button>`).join('')}
      <div class="opt" role="radio" aria-checked="${!isChoice}" style="cursor:default"><span class="opt__r"></span><span class="opt__t"><b>Your own number</b><span>${taken} taken so far. A fresh paper from the bank each time.</span></span>
        <span class="stepper"><button type="button" data-act="tstep" data-d="-1" aria-label="One fewer">${ic('minus')}</button><output aria-live="polite">${p.target}</output><button type="button" data-act="tstep" data-d="1" aria-label="One more">${ic('plus')}</button></span></div></div>`;
  }
  function preview() {
    const p = S.plan; const weeks = weeksTo(p.exam); const pace = mockPace(p.target, taken, p.exam);
    return `<div class="preview" aria-live="polite"><div><b data-pv="w">${weeks}</b><span>weeks to ${p.own ? 'your date' : 'CUET UG'}</span></div>
      <div><b data-pv="s">${sessionsUntil(p.exam, p.days.length)}</b><span>study days at ${p.days.length} a week</span></div>
      <div><b data-pv="m">${pace.left}</b><span>mocks to go, ${pace.words}</span></div></div>`;
  }
  function renderSheet(anim = true) {
    const prev = {}; dlg.querySelectorAll('[data-pv]').forEach((b) => { prev[b.dataset.pv] = b.textContent; });
    dlg.innerHTML = `<div class="sheet__in"><span class="sheet__handle" aria-hidden="true"></span>
      <header class="sheet__head"><h2 id="cp-h" tabindex="-1">Change plan</h2><button type="button" class="x" data-act="close" aria-label="Close">${ic('x')}</button></header>
      ${sentence()}<div class="step ${anim ? 'is-in' : ''}">${stepBody()}</div>${preview()}
      <p class="sheet__status" role="status">${S.status}</p>
      <div class="sheet__foot">${S.step > 1 ? '<button type="button" class="sheet__back" data-act="back">Back</button>' : '<span></span>'}
        ${S.step < 3 ? '<button type="button" class="pill" data-act="next">Next</button>' : '<button type="button" class="key" data-act="done">Done</button>'}</div></div>`;
    dlg.querySelectorAll('[data-pv]').forEach((b) => { if (prev[b.dataset.pv] && prev[b.dataset.pv] !== b.textContent) b.classList.add('is-bump'); });
  }
  let saveTimer = 0; let stepTimer = 0;
  function saved(advance) {
    S.status = 'Saving…'; renderSheet(false);
    clearTimeout(saveTimer); clearTimeout(stepTimer);
    saveTimer = setTimeout(() => {
      S.status = 'Saved.'; S.saved = { ...S.plan, days: [...S.plan.days] }; renderSheet(false);
      if (advance && S.step < 3) stepTimer = setTimeout(() => { S.step += 1; S.status = ''; renderSheet(); }, 520);
    }, 420);
  }
  function openPlan(step = 1) { S.step = step; S.status = ''; S.ownOpen = false; renderSheet(); if (!dlg.open) dlg.showModal(); dlg.querySelector('h2').focus(); }

  // ---------- mount ----------
  function mount() { body.innerHTML = shell(); body.appendChild(dlg); }
  body.dataset.theme = q.get('theme') || body.dataset.theme || 'night';
  body.dataset.chrome = q.get('chrome') || '1';
  body.dataset.anim = q.get('anim') || '1';
  body.dataset.full = q.get('full') || '0';
  mount();
  setTimeout(() => { body.dataset.anim = '0'; }, 1200);

  function roll(el, from, to) {
    if (!el || reduced() || from === to) { if (el) el.textContent = to; return; }
    const t0 = performance.now(); const dur = 380;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function swapLead(id) {
    const bodyEl = document.getElementById('lead-body'); if (!bodyEl) return;
    const from = Number(bodyEl.querySelector('.lead__num')?.dataset.num || 0);
    S.lead = id; S.lenOpen = false;
    const put = () => {
      bodyEl.innerHTML = leadBody(); document.getElementById('or').innerHTML = choices();
      const num = bodyEl.querySelector('.lead__num'); roll(num, from, Number(num.dataset.num));
      bodyEl.classList.remove('is-out');
      const det = document.getElementById('week-detail'); if (det && S.day === 'sun') det.innerHTML = weekDetail(weekData());
    };
    if (reduced()) { put(); return; }
    bodyEl.classList.add('is-out'); setTimeout(put, 150);
  }

  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-ctl]');
    if (c) { const u = new URLSearchParams(location.search); u.set(c.dataset.ctl, c.dataset.v); u.delete('pick'); location.search = u.toString(); return; }
    const a = e.target.closest('[data-act]');
    if (!a) { if (e.target.closest('a[href^="#"]')) e.preventDefault(); return; }
    const act = a.dataset.act;
    if (act === 'pick') return swapLead(a.dataset.id);
    if (act === 'len') { S.lenOpen = !S.lenOpen; a.setAttribute('aria-expanded', S.lenOpen); document.getElementById('lengths').dataset.open = S.lenOpen; return; }
    if (act === 'minutes') {
      const n = Number(a.dataset.n); const el = document.getElementById('lead-body'); const from = Number(el.querySelector('.lead__num').dataset.num);
      S.minutes[S.lead] = n; el.innerHTML = leadBody(); roll(el.querySelector('.lead__num'), from, Number(el.querySelector('.lead__num').dataset.num)); return;
    }
    if (act === 'day') {
      S.day = a.dataset.key; const w = weekData();
      document.querySelectorAll('.day').forEach((b) => b.setAttribute('aria-pressed', b.dataset.key === S.day));
      document.querySelector('.week__days').style.setProperty('--sel', w.findIndex((d) => d.key === S.day));
      const det = document.getElementById('week-detail'); det.innerHTML = weekDetail(w); det.classList.remove('is-swap'); void det.offsetWidth; det.classList.add('is-swap'); return;
    }
    if (act === 'ch') { const id = a.dataset.id; S.open[id] = !S.open[id]; a.setAttribute('aria-expanded', S.open[id]); document.getElementById(`m-${id}`).dataset.open = S.open[id]; return; }
    if (act === 'plan') return openPlan(1);
    if (act === 'cue') { const el = document.querySelector('.week'); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - (platform === 'app' ? 12 : 68), behavior: reduced() ? 'auto' : 'smooth' }); return; }
    if (act === 'close') { dlg.close(); return; }
    if (act === 'step') { S.step = Number(a.dataset.n); S.status = ''; renderSheet(); return; }
    if (act === 'next') { S.step = Math.min(3, S.step + 1); S.status = ''; renderSheet(); return; }
    if (act === 'back') { S.step = Math.max(1, S.step - 1); S.status = ''; renderSheet(); return; }
    if (act === 'exp') { S.plan.own = false; S.ownOpen = false; S.plan.exam = '2027-05-01'; return saved(true); }
    if (act === 'ownopen') { S.ownOpen = true; renderSheet(false); return; }
    if (act === 'month') { S.month = Number(a.dataset.m); renderSheet(false); return; }
    if (act === 'cal') { S.plan.own = true; S.plan.exam = a.dataset.k; return saved(true); }
    if (act === 'd7') {
      const i = Number(a.dataset.i); const has = S.plan.days.includes(i);
      if (has && S.plan.days.length === 1) { S.status = 'Keep at least one day.'; renderSheet(false); return; }
      S.plan.days = has ? S.plan.days.filter((x) => x !== i) : [...S.plan.days, i].sort(); return saved(false);
    }
    if (act === 'tgt') { S.plan.target = Number(a.dataset.v); return saved(false); }
    if (act === 'tstep') { S.plan.target = Math.min(60, Math.max(taken + 1, S.plan.target + Number(a.dataset.d))); return saved(false); }
    if (act === 'done') {
      dlg.close(); S.receipt = `Plan saved at 7:41 PM: ${weeksTo(S.saved.exam)} weeks, ${S.saved.days.length} days a week, ${S.saved.target} full mocks.`;
      const r = document.getElementById('road'); if (r) r.outerHTML = road(); return;
    }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  // Capture helpers: open states directly from the query.
  const open = q.get('open');
  if (open && open.startsWith('plan')) { S.step = Number(open.slice(4)) || 1; S.ownOpen = q.get('own') === '1'; renderSheet(false); dlg.showModal(); dlg.querySelector('h2').focus(); }
  if (q.get('scrollto')) { const el = document.querySelector(q.get('scrollto')); if (el) { const y = el.getBoundingClientRect().top + window.scrollY - (platform === 'app' ? 8 : 72); window.scrollTo(0, y); } }
})();
