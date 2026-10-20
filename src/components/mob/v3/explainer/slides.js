// The seven stages of the Mob explainer (MOB-EXPLAINER.md section 3, K9 for slides 3 and 4), on a 360 x 404 design
// stage. Each builder draws its layers into `st` and adds every move to `tl` with its own delay; the main beats come from
// explainerModel.mjs (buildTimes), the details keep the prototype's offsets. The stage is decorative (aria-hidden): what
// it shows is said by the slide's title and body (and, on slide 3, a list for screen readers).
import { PLAY_CARDS, PODIUM_FIXTURE, marksOf } from './explainerModel.mjs';
import { ART, ART_SIZE, E, SP, TICK, fold, h, headDisc, icon, img, lamp, pennant, silFold, tag } from './motion';

const PEOPLE = Object.freeze({
  you: { name: 'You', fold: 'dart' }, riya: { name: 'Riya', fold: 'dogear' }, kabir: { name: 'Kabir', fold: 'hexa' }, zoya: { name: 'Zoya', fold: 'kandil' },
});
const FOLD_NAME = Object.freeze({ dart: 'Dart', dogear: 'Dog-ear', hexa: 'Hexa', kandil: 'Kandil', hop: 'Hop' });

function scene(cls = '') {
  return h('div', { class: `mx-scene ${cls}`.trim() }, [img(ART.sceneNight, 'mx-th-night'), img(ART.sceneDay, 'mx-th-day')]);
}

// 1. This is your Mob: the lamp comes on, the pennant swings in, friends hop into their seats.
function b1(st, tl, { K, T }) {
  const sc = scene(); st.append(sc);
  const pool = h('div', { class: 'mx-pool', style: 'left:40px;top:296px;width:290px;height:96px' }); st.append(pool);
  st.append(h('div', { class: 'mx-stage-fade', style: 'height:60px' }));
  if (K.rm) tl.a(sc, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: K.at(T.room), e: E.lin });
  else tl.a(sc, [{ filter: 'brightness(.3) saturate(.7)' }, { filter: 'brightness(1) saturate(1)' }], { d: 420, at: T.room, e: E.glide });
  tl.a(pool, [{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'scale(1)' }], { d: K.rm ? 120 : 420, at: K.at(T.pool), e: E.glide });
  const pen = pennant(st, { x: 300, y: 22, w: 66, weeks: 3, name: 'Chai Circle', slots: 4 }); K.swingIn(tl, pen.el, T.pennant);
  const seats = [
    { p: 'zoya', x: 52, base: 334, size: 78 }, { p: 'riya', x: 118, base: 356, size: 88 },
    { p: 'you', x: 186, base: 376, size: 100 }, { p: 'kabir', x: 256, base: 356, size: 88 },
  ];
  seats.forEach((s, i) => {
    const P = PEOPLE[s.p]; const f = fold(P.fold, { x: s.x, base: s.base, size: s.size, poses: ['wave'] }); st.append(f.root);
    K.hopIn(tl, f, T[`fold${i}`]);
    if (s.p === 'you') K.poseTo(tl, f, 'wave', T.wave);
    K.idle(tl, f, T.idle + i * 110, i + 1);
    const tg = tag(st, P.name, s.x, s.base + 3, s.p === 'you' ? 'is-you' : ''); tg.style.zIndex = 500; K.engrave(tl, tg, T[`tag${i}`]);
  });
  const os = h('div', { class: 'mx-seat', style: 'left:296px;top:278px;width:46px;height:56px' }, [icon('plus', 18)]); st.append(os); K.pop(tl, os, T.seat);
  const ot = tag(st, 'Open seat', 319, 337, 'is-dim'); K.engrave(tl, ot, T.seatTag);
}

// 2. Everyone sits as a Fold: an answer sheet with a mistake; the fix is ticked; the corners fold in to a diamond, and the
// diamond becomes Mobi, the eldest. The four starters hop in beside him.
function b2(st, tl, { K, T }) {
  st.classList.add('mx-gridpaper');
  st.append(h('div', { class: 'mx-stage-fade', style: 'height:70px;z-index:1' }));
  const L = lamp(st, { x: 180, h: 404, w: 330 });
  if (K.rm) tl.a(L.el, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: 0, e: E.lin });
  else {
    tl.a(L.cone, [{ opacity: 0, transform: 'translateX(-50%) scaleX(.7)' }, { opacity: 1, transform: 'translateX(-50%) scaleX(1)' }], { d: 420, at: T.cone, e: E.glide });
    tl.a(L.shade, [{ opacity: 0, transform: 'translateX(-50%) translateY(-12px)' }, { opacity: 1, transform: 'translateX(-50%)' }], { d: 300, at: T.cone, e: E.out });
  }
  const SZ = 168; const cx = 180; const cy = 276;
  const wrap = h('div', { class: 'mx-abs', style: `left:${cx - SZ / 2}px;top:${cy - SZ / 2}px;width:${SZ}px;height:${SZ}px` }); st.append(wrap);
  const shadow = h('div', { class: 'mx-abs mx-softshadow', style: `left:10px;top:${SZ - 4}px;width:${SZ - 20}px;height:16px` }); wrap.append(shadow);
  const sheet = h('div', { class: 'mx-abs', style: 'inset:0' }); wrap.append(sheet);
  const flat = h('div', { class: 'mx-abs mx-sheetshadow', style: 'inset:0;border-radius:3px' }); sheet.append(flat);
  const content = () => {
    const c = h('div', { class: 'mx-abs', style: 'inset:0' });
    c.innerHTML = `<div class="mx-sheet-cap" style="left:14px;top:12px">Question 4</div>
      <div class="mx-sheet-cap" style="right:14px;top:12px">+5 / −1 / 0</div>
      ${['A', 'B', 'C', 'D'].map((l, i) => `<div class="mx-bub" data-b="${l}" style="left:${21 + i * 34}px;top:${SZ / 2 - 13}px;width:26px;height:26px"><span style="position:relative;z-index:1">${l}</span></div>`).join('')}
      ${[0, 1, 2].map((i) => `<div class="mx-rule" style="left:28px;right:28px;top:${SZ / 2 + 30 + i * 11}px"></div>`).join('')}
      <div class="mx-rule" style="left:28px;width:80px;top:${SZ / 2 - 40}px"></div>`;
    return c;
  };
  const tri = { tl: '0 0,50% 0,0 50%', tr: '50% 0,100% 0,100% 50%', br: '100% 50%,100% 100%,50% 100%', bl: '0 50%,50% 100%,0 100%' };
  const axis = { tl: '-1,1,0', tr: '1,1,0', br: '-1,1,0', bl: '1,1,0' }; const org = { tl: '25% 25%', tr: '75% 25%', br: '75% 75%', bl: '25% 75%' };
  const base = h('div', { class: 'mx-abs mx-paper mx-grain', style: 'inset:0;border-radius:3px;box-shadow:none;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)' });
  base.append(content()); sheet.append(base);
  const bB = base.querySelector('[data-b="B"]'); const bC = base.querySelector('[data-b="C"]');
  const pencil = h('div', { class: 'mx-bub__fill mx-pencil' }); bB.append(pencil);
  const cFill = h('div', { class: 'mx-bub__fill', style: 'background:var(--mx-paper-ink)' }); bC.append(cFill);
  const cl = h('span', { class: 'mx-bub__on', text: 'C' }); bC.append(cl);
  const svg = h('div', { class: 'mx-abs', style: 'inset:0;pointer-events:none;z-index:3', html: `<svg width="${SZ}" height="${SZ}" viewBox="0 0 ${SZ} ${SZ}" aria-hidden="true"><path data-k="crease" d="M10 ${SZ - 22} L${SZ - 12} 26" stroke="rgba(42,38,30,.38)" stroke-width="1.4" stroke-dasharray="5 4" fill="none"/><path data-k="tick" d="M${21 + 2 * 34 + 2} ${SZ / 2 - 2} l8 9 l17 -21" stroke="#D2F000" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path data-k="edge" d="M${21 + 2 * 34 + 2} ${SZ / 2 - 2} l8 9 l17 -21" stroke="#3B4A00" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0"/></svg>` });
  base.append(svg);
  const flaps = {};
  for (const k of ['tl', 'tr', 'br', 'bl']) {
    const f = h('div', { class: 'mx-abs mx-paper', style: `inset:0;clip-path:polygon(${tri[k]});transform-origin:${org[k]};box-shadow:none;border-radius:3px;z-index:4` });
    const inner = content(); f.append(inner);
    const crease2 = h('div', { class: 'mx-abs', style: 'inset:0', html: `<svg width="${SZ}" height="${SZ}" aria-hidden="true"><path d="M10 ${SZ - 22} L${SZ - 12} 26" stroke="rgba(42,38,30,.38)" stroke-width="1.4" stroke-dasharray="5 4" fill="none"/></svg>` }); f.append(crease2);
    const shade = h('div', { class: 'mx-abs', style: 'inset:0;background:var(--mx-paper-back);opacity:0' }); f.append(shade);
    sheet.append(f); flaps[k] = { f, inner, crease2, shade };
  }
  const tint = h('div', { class: 'mx-abs', style: 'inset:0;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);background:#CDE52A;opacity:0;z-index:6' }); sheet.append(tint);
  const visor = h('div', { class: 'mx-abs', style: `left:${SZ * 0.26}px;top:${SZ * 0.4}px;width:${SZ * 0.48}px;height:${SZ * 0.2}px;border-radius:${SZ * 0.1}px;background:#12110E;opacity:0;z-index:7` },
    [h('div', { class: 'mx-abs', style: 'left:28%;top:28%;width:9%;height:46%;border-radius:40%;background:#F3EFE4' }), h('div', { class: 'mx-abs', style: 'right:28%;top:28%;width:9%;height:46%;border-radius:40%;background:#F3EFE4' })]);
  sheet.append(visor);
  // Mobi: body centre at (0.56, 0.43) of the still; boots at 0.97
  const MH = 196; const MW = MH * (ART_SIZE.mobiGreet[0] / ART_SIZE.mobiGreet[1]);
  const mobiIn = h('div', { class: 'mx-abs', style: 'inset:0;transform-origin:56% 97%' }, [img(ART.mobiGreet, '', 'width:100%;height:100%')]);
  const mobi = h('div', { class: 'mx-abs', style: `left:${cx - 0.56 * MW}px;top:${cy - 0.43 * MH}px;width:${MW}px;height:${MH}px;z-index:300;transform-origin:56% 97%` }, [mobiIn]);
  st.append(mobi);
  const mShadow = h('div', { class: 'mx-abs mx-softshadow', style: `left:${cx - 46}px;top:${cy - 0.43 * MH + 0.97 * MH - 7}px;width:92px;height:14px;z-index:299` }); st.append(mShadow);
  const mobiBase = cy - 0.43 * MH + 0.97 * MH;

  K.rise(tl, wrap, T.sheet, { dy: 22, d: 420 });
  if (!K.rm) tl.a(sheet, [{ transform: 'rotate(-4deg)' }, { transform: 'rotate(-1.5deg)' }], { d: 600, at: T.sheet, e: E.out });
  K.pop(tl, pencil, T.pick, 0.5);
  K.draw(tl, svg.querySelector('[data-k="crease"]'), T.crease, 360);
  for (const k of Object.keys(flaps)) K.draw(tl, flaps[k].crease2.querySelector('path'), T.crease, 360);
  K.pop(tl, cFill, T.fill, 0.4); K.fadeIn(tl, cl, T.fill, 120);
  K.draw(tl, svg.querySelector('[data-k="tick"]'), T.tick, 420); K.fadeIn(tl, svg.querySelector('[data-k="edge"]'), T.tick + 120, 200);
  K.glints(tl, st, { x: cx + 14, y: cy - 6, n: 4, r: 22, at: T.glints, color: '#D2F000' });
  if (K.rm) {
    tl.a(wrap, [{ opacity: 1 }, { opacity: 0 }], { d: 120, at: K.at(T.mobi), e: E.lin });
    tl.a(mobi, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: K.at(T.mobi), e: E.lin });
    tl.a(mShadow, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: K.at(T.mobi), e: E.lin });
  } else {
    let t = T.corners;
    for (const k of ['tl', 'tr', 'br', 'bl']) {
      const F = flaps[k];
      tl.a(F.f, [{ transform: `perspective(520px) rotate3d(${axis[k]},0deg)` }, { transform: `perspective(520px) rotate3d(${axis[k]},180deg)` }], { d: 420, at: t, e: E.emph });
      tl.a(F.inner, [{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0, offset: 0.31 }, { opacity: 0 }], { d: 420, at: t, e: E.lin });
      tl.a(F.crease2, [{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0, offset: 0.31 }, { opacity: 0 }], { d: 420, at: t, e: E.lin });
      tl.a(F.shade, [{ opacity: 0 }, { opacity: 0.6, offset: 0.3 }, { opacity: 0.35 }], { d: 420, at: t, e: E.lin });
      t += 90;
    }
    tl.a(sheet, [{ transform: 'rotate(-1.5deg) scale(1)' }, { transform: 'rotate(0deg) scale(.64)' }], { d: 300, at: T.shrink, e: E.out });
    tl.a(shadow, [{ opacity: 1 }, { opacity: 0 }], { d: 200, at: T.shrink, e: E.lin });
    tl.a(flat, [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { d: 700, at: T.corners, e: E.lin });
    tl.a(tint, [{ opacity: 0 }, { opacity: 1 }], { d: 200, at: T.tint, e: E.lin });
    tl.a(visor, [{ opacity: 0, transform: 'scaleX(.4)' }, { opacity: 1, transform: 'scaleX(1)' }], { d: 200, at: T.visor, e: E.out });
    tl.a(wrap, [{ opacity: 1 }, { opacity: 0 }], { d: 120, at: T.mobi, e: E.lin });
    tl.a(mobi, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(.7)', offset: 0.01 }, { opacity: 1, transform: 'scale(1)' }], { d: SP.celebrate.d, at: T.mobi, e: SP.celebrate.e });
    tl.a(mShadow, [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1)' }], { d: 300, at: T.mobi + 60, e: E.out });
    tl.a(L.cone, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.5)', offset: 0.3 }, { filter: 'brightness(1)' }], { d: 700, at: T.mobi - 40, e: E.lin });
    K.bits(tl, st, { x: cx, y: cy - 10, n: 18, at: T.bits, floor: mobiBase + 2, seed: 21, up: 140 });
    K.glints(tl, st, { x: cx, y: cy - 20, n: 6, r: 70, at: T.mobi + 60, color: '#F2D9A0', rot: 0.3 });
  }
  const ring = [{ k: 'dogear', x: 97, size: 82 }, { k: 'hexa', x: 264, size: 82 }, { k: 'dart', x: 44, size: 80 }, { k: 'kandil', x: 318, size: 80 }];
  ring.forEach((r, i) => {
    const f = fold(r.k, { x: r.x, base: mobiBase + 2, size: r.size, z: 200, poses: ['wave'] }); st.append(f.root);
    const t0 = T[`starter${i}`];
    K.hopIn(tl, f, t0, 30); if (r.k === 'dart' || r.k === 'hexa') K.poseTo(tl, f, 'wave', t0 + 900 + i * 10);
    K.idle(tl, f, t0 + 800 + i * 50, 11 + i);
    const tg = tag(st, FOLD_NAME[r.k], r.x, mobiBase + 6, 'is-dim'); tg.style.zIndex = 400; K.engrave(tl, tg, T.starterTag0 + i * 90);
  });
  const et = tag(st, 'Mobi, the eldest', cx, mobiBase + 6, 'is-eldest'); et.style.zIndex = 400; K.engrave(tl, et, T.eldest);
  if (!K.rm) tl.a(mobiIn, [{ transform: 'rotate(0)' }, { transform: 'rotate(-3deg)', offset: 0.3 }, { transform: 'rotate(2deg)', offset: 0.65 }, { transform: 'rotate(0)' }], { d: 900, at: T.sway, e: E.sweep, fill: 'none' });
}

// 3. Four ways to play (K9): four paper game cards are dealt from a stack under the lamp into a 2 x 2 grid, then each
// card's detail plays: Sprint's five cells fill, the round's length slides from 10 to 15, the rematch loop draws, and the
// Mob paper's clock hand sweeps ten minutes.
const LOOP_PATH = 'M7 15a8 8 0 0 1 13.5-6.2L22 10M25 17a8 8 0 0 1-13.5 6.2L10 22';
function b3(st, tl, { K, T }) {
  const L = lamp(st, { x: 180, h: 404, w: 320 });
  if (K.rm) tl.a(L.el, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: 0, e: E.lin });
  else {
    tl.a(L.cone, [{ opacity: 0, transform: 'translateX(-50%) scaleX(.7)' }, { opacity: 1, transform: 'translateX(-50%) scaleX(1)' }], { d: 420, at: T.cone, e: E.glide });
    tl.a(L.shade, [{ opacity: 0, transform: 'translateX(-50%) translateY(-12px)' }, { opacity: 1, transform: 'translateX(-50%)' }], { d: 300, at: T.cone, e: E.out });
  }
  const W = 160; const H = 176; const X = [15, 185]; const Y = [34, 218];
  const STACK = { x: 180, y: 216 };
  const r0 = [-6, 5, -3, 7]; const r1 = [-1, 1, 1, -1]; const jit = [[0, 0], [3, -4], [-3, 3], [2, 5]];
  const deck = h('div', { class: 'mx-abs', style: 'inset:0' }); st.append(deck);
  const parts = {};
  PLAY_CARDS.forEach((c, i) => {
    const x = X[i % 2]; const y = Y[Math.floor(i / 2)];
    const card = h('div', { class: `mx-pcard mx-paper mx-grain mx-pcard--${c.id}`, style: `left:${x}px;top:${y}px;width:${W}px;height:${H}px;z-index:${10 - i}` });
    card.append(h('div', { class: 'mx-pcard__label', text: c.label }));
    const hero = h('div', { class: 'mx-pcard__hero' }); card.append(hero);
    if (c.id === 'sprint') {
      hero.append(h('span', { class: 'mx-pcard__fig', text: c.figure }), h('span', { class: 'mx-pcard__unit', text: c.line }));
      const cells = h('div', { class: 'mx-pcard__cells' });
      parts.cells = Array.from({ length: 5 }, () => { const cell = h('span', { class: 'mx-pcard__cell' }); const fill = h('span', { class: 'mx-pcard__cellfill' }); cell.append(fill); cells.append(cell); return fill; });
      card.append(cells);
    } else if (c.id === 'round') {
      const chips = h('div', { class: 'mx-pcard__chips' });
      const pill = h('span', { class: 'mx-pcard__pill' }); chips.append(pill);
      parts.chips = c.chips.map((n) => { const ch = h('span', { class: 'mx-pcard__chip', text: n }); chips.append(ch); return ch; });
      parts.pill = pill; hero.append(chips);
      card.append(h('div', { class: 'mx-pcard__line', text: c.line }));
    } else if (c.id === 'rematch') {
      const loop = h('span', { class: 'mx-pcard__loop', html: `<svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true"><path d="${LOOP_PATH}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>` });
      const heads = h('span', { class: 'mx-pcard__loophead', html: '<svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true"><path d="M22 4v6h-6M10 28v-6h6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
      hero.append(loop, heads); parts.loop = loop.querySelector('path'); parts.loopHead = heads;
      card.append(h('div', { class: 'mx-pcard__line', text: c.line }));
    } else {
      hero.append(h('span', { class: 'mx-pcard__fig', text: c.figure }));
      const clock = h('span', { class: 'mx-pcard__clock', html: '<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><circle cx="16" cy="17" r="12" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M13 3h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path data-k="arc" d="M16 9 A8 8 0 0 1 22.93 13" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="butt" opacity=".28"/></svg>' });
      const hand = h('span', { class: 'mx-pcard__hand' }); clock.append(hand); hero.append(clock);
      parts.hand = hand; parts.arc = clock.querySelector('[data-k="arc"]');
      card.append(h('div', { class: 'mx-pcard__line', text: c.line }));
    }
    card.append(h('div', { class: 'mx-pcard__foot', text: c.foot }));
    deck.append(card);
    // dealt from the stack: the card starts in the stack, tilted, and flies to its slot with its tilt settling
    const dx = STACK.x - (x + W / 2) + jit[i][0]; const dy = STACK.y - (y + H / 2) + jit[i][1];
    if (K.rm) tl.a(card, [{ opacity: 0, transform: `rotate(${r1[i]}deg)` }, { opacity: 1, transform: `rotate(${r1[i]}deg)` }], { d: 120, at: K.at(T[`deal${i}`]), e: E.lin });
    else tl.a(card, [{ transform: `translate(${dx}px,${dy}px) rotate(${r0[i]}deg)` }, { transform: `translate(0px,0px) rotate(${r1[i]}deg)` }], { d: 420, at: T[`deal${i}`], e: E.emph });
  });
  if (!K.rm) tl.a(deck, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { d: 420, at: T.stack, e: E.emph });
  // Sprint: the five cells fill one by one
  parts.cells.forEach((f, i) => {
    if (K.rm) tl.a(f, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: K.at(T.cells + i * 90), e: E.lin });
    else tl.a(f, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { d: 240, at: T.cells + i * 90, e: E.out });
  });
  // Your own round: the highlight slides from 10 to 15 (smooth spring)
  const step = 40;
  if (K.rm) {
    tl.a(parts.pill, [{ transform: 'translateX(0px)' }, { transform: `translateX(${step}px)` }], { d: 1, at: K.at(T.chips), e: 'steps(1,end)' });
  } else tl.a(parts.pill, [{ transform: 'translateX(0px)' }, { transform: `translateX(${step}px)` }], { d: SP.smooth.d, at: T.chips, e: SP.smooth.e });
  tl.a(parts.chips[0], [{ color: 'var(--mx-volt-ink)' }, { color: 'var(--mx-paper-ink)' }], { d: 120, at: K.at(T.chips) + (K.rm ? 0 : 80), e: E.lin });
  tl.a(parts.chips[1], [{ color: 'var(--mx-paper-ink)' }, { color: 'var(--mx-volt-ink)' }], { d: 120, at: K.at(T.chips) + (K.rm ? 0 : 80), e: E.lin });
  // Rematch: the loop arrow draws, then its heads land
  K.draw(tl, parts.loop, T.loop, 420);
  K.pop(tl, parts.loopHead, T.loop + 360, 0.7);
  // The Mob paper: the hand sweeps a 10-minute arc
  K.draw(tl, parts.arc, T.clock, 900);
  if (K.rm) tl.a(parts.hand, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(60deg)' }], { d: 1, at: K.at(T.clock), e: 'steps(1,end)' });
  else tl.a(parts.hand, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(60deg)' }], { d: 900, at: T.clock, e: E.inOut });
}

// 4. See who did best: CUET marks fill a mark sheet, the podium unfolds third, second, first, then each row's cells give
// way to that person's one highlight (assignMoments on the fixture: K9).
function b4(st, tl, { K, T }) {
  const L = lamp(st, { x: 180, h: 280, w: 300 });
  if (K.rm) tl.a(L.el, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: 0, e: E.lin });
  else tl.a(L.cone, [{ opacity: 0.4, transform: 'translateX(-50%) scaleX(1.35)' }, { opacity: 1, transform: 'translateX(-50%) scaleX(1)' }], { d: 420, at: T.cone, e: E.emph });
  const floorY = 252;
  st.append(h('div', { class: 'mx-abs mx-floor', style: `left:0;right:0;top:${floorY}px;height:14px` }));
  const rows = PODIUM_FIXTURE.rows;
  const P = [
    { ...rows[0], place: 1, x: 180, w: 104, ph: 108 },
    { ...rows[1], place: 2, x: 74, w: 100, ph: 84 },
    { ...rows[2], place: 3, x: 286, w: 100, ph: 64 },
  ].map((r) => ({ ...r, marks: marksOf(r.cells) }));
  const sheet = h('div', { class: 'mx-card', style: 'left:16px;top:270px;width:328px;height:128px' }); st.append(sheet); K.rise(tl, sheet, T.sheet);
  const markEls = []; const cellAt = (ci, ri) => T.cells + ci * 170 + ri * 50;
  P.forEach((r, ri) => {
    const y = 10 + ri * 38; const row = h('div', { class: 'mx-abs', style: `left:0;right:0;top:${y}px;height:36px` }); sheet.append(row);
    row.append(headDisc(r.fold, 28, 'position:absolute;left:12px;top:4px'), h('div', { class: 'mx-t-label mx-abs', style: 'left:48px;top:8px;font-size:15px', text: r.name }));
    const mk = h('div', { class: 'mx-fig mx-abs', style: 'right:14px;top:2px;font-size:28px;line-height:32px;text-align:right;width:44px', text: '0' }); row.append(mk); markEls.push(mk);
    const cellsWrap = h('div', { class: 'mx-abs', style: 'inset:0' }); row.append(cellsWrap);
    r.cells.forEach((c, ci) => {
      const cx = 112 + ci * 30; const el = h('div', { class: `mx-mcell mx-mcell--${c}`, style: `left:${cx}px` });
      if (c === 'r') el.innerHTML = TICK('var(--mx-ground)', 3.4); else if (c === 'w') el.textContent = '−1'; else el.textContent = '0';
      cellsWrap.append(el); K.pop(tl, el, cellAt(ci, ri), 0.5);
      if (c === 's' && r.who === 'kabir') {
        const ring = h('div', { class: 'mx-ring mx-ring--volt', style: `left:${cx - 4}px` }); cellsWrap.append(ring); K.pop(tl, ring, T.ringSkip, 0.6);
        if (!K.rm) tl.a(ring, [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { d: 600, at: T.ringSkip + 280, e: E.sweep, it: 2, fill: 'none' });
      }
      if (c === 'w') { const ring = h('div', { class: 'mx-ring mx-ring--bad', style: `left:${cx - 4}px` }); cellsWrap.append(ring); K.pop(tl, ring, T.ringWrong, 0.6); }
    });
    // the highlight takes the cells' place
    const hl = h('div', { class: 'mx-hl mx-abs', style: 'left:104px;top:9px', text: PODIUM_FIXTURE.highlights[r.who] }); row.append(hl);
    const at = T[`hl${ri}`];
    tl.a(cellsWrap, [{ opacity: 1 }, { opacity: 0 }], { d: K.rm ? 120 : 200, at: K.at(at), e: K.rm ? E.lin : E.leave });
    K.engrave(tl, hl, at + 160);
  });
  const vals = { r: 5, w: -1, s: 0 };
  tl.tick((t) => {
    P.forEach((r, ri) => { let m = 0; r.cells.forEach((c, ci) => { if (t >= K.at(cellAt(ci, ri)) + 60) m += vals[c]; }); const s = String(m); if (markEls[ri].textContent !== s) markEls[ri].textContent = s; });
  }, 1400);
  const order = [P[2], P[1], P[0]]; const PT = [T.third, T.second, T.first];
  order.forEach((r, i) => {
    const left = r.x - r.w / 2; const top = floorY - r.ph;
    const pl = h('div', { class: 'mx-abs mx-paper mx-grain mx-plinth', style: `left:${left}px;top:${top}px;width:${r.w}px;height:${r.ph}px` });
    pl.append(h('div', { class: 'mx-fig', text: String(r.place), style: `font-size:${r.place === 1 ? 44 : r.place === 2 ? 36 : 30}px;line-height:1;margin-top:${r.place === 1 ? 16 : r.place === 2 ? 10 : 7}px;color:var(--mx-paper-ink)` }));
    const crease = h('div', { class: 'mx-abs', style: 'right:8px;top:8px;display:flex;gap:3px' });
    for (let c = 0; c < 4 - r.place; c += 1) crease.append(h('div', { class: 'mx-crease' }));
    pl.append(crease);
    pl.append(h('div', { class: 'mx-plinth__name', text: `${r.name}, ${r.marks}` }));
    st.append(pl);
    if (K.rm) tl.a(pl, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: K.at(PT[i]), e: E.lin });
    else tl.a(pl, [{ transform: 'perspective(520px) rotateX(86deg)', opacity: 0 }, { transform: 'perspective(520px) rotateX(70deg)', opacity: 1, offset: 0.1 }, { transform: 'perspective(520px) rotateX(0deg)', opacity: 1 }], { d: 420, at: PT[i], e: E.emph });
    const f = fold(r.fold, { x: r.x, base: top + 2, size: r.place === 1 ? 92 : 80, poses: ['cheer'], z: 50 + i }); st.append(f.root);
    K.drop(tl, f, PT[i] + 260, 60);
    if (r.place === 1) {
      K.poseTo(tl, f, 'cheer', PT[i] + 560);
      const sheen = h('div', { class: 'mx-abs mx-sheen' }); pl.append(sheen);
      if (!K.rm) {
        tl.a(sheen, [{ transform: 'translateX(-120%)' }, { transform: 'translateX(120%)' }], { d: 700, at: T.sheen, e: E.sweep });
        tl.a(L.cone, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.6)', offset: 0.35 }, { filter: 'brightness(1.25)' }], { d: 1200, at: PT[i] + 560, e: E.lin });
        K.bits(tl, st, { x: r.x, y: top - 30, n: 26, at: PT[i] + 600, floor: floorY, seed: 4 });
        K.glints(tl, st, { x: r.x, y: top - 50, n: 6, r: 52, at: PT[i] + 660 });
        tl.a(f.hp, [{ transform: 'translateY(0)', easing: E.out }, { transform: 'translateY(-12px)', offset: 0.45, easing: E.leave }, { transform: 'translateY(0)' }], { d: 380, at: PT[i] + 1000, e: E.lin, fill: 'none' });
        K.squash(tl, f, PT[i] + 1360);
      }
      K.idle(tl, f, PT[i] + 1800, 9);
    } else K.idle(tl, f, PT[i] + 900, 6 + i);
  });
}

// 5. Fix it together: the trap, your pencil pick, the right one; then Now and Wednesday; two of you pass; the seal.
function b5(st, tl, { K, T }) {
  const card = h('div', { class: 'mx-paper mx-grain mx-abs', style: 'left:18px;top:8px;width:290px;height:182px;border-radius:8px;transform:rotate(-1.2deg)' }); st.append(card);
  card.append(h('div', { class: 'mx-corner' }));
  card.append(h('div', { class: 'mx-qhead', text: 'Question 4 caught most of you.' }));
  card.append(h('div', { class: 'mx-qstem', text: "Goodwill at 2 years' purchase of average profits of 30,000 is" }));
  const opts = [['A', '30,000'], ['B', '45,000'], ['C', '60,000'], ['D', '90,000']]; const bub = {};
  opts.forEach(([l, v], i) => {
    const b = h('div', { class: 'mx-bub', style: `left:${30 + i * 64}px;top:78px;width:28px;height:28px` }, [h('span', { text: l, style: 'position:relative;z-index:2' })]);
    const lab = h('div', { class: 'mx-qopt', text: v, style: `left:${30 + i * 64 - 18}px` });
    card.append(b, lab); bub[l] = b;
  });
  const pencil = h('div', { class: 'mx-bub__fill mx-pencil' }); bub.B.append(pencil);
  const strike = h('div', { class: 'mx-abs', html: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path d="M6 34 L34 6" stroke="#4A463F" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>', style: `left:${30 + 64 - 6}px;top:72px;z-index:3` }); card.append(strike);
  const cF = h('div', { class: 'mx-bub__fill', style: 'background:var(--mx-paper-ink)' }); bub.C.append(cF);
  const cL = h('span', { class: 'mx-bub__on', text: 'C', style: 'z-index:3' }); bub.C.append(cL);
  const why = h('div', { class: 'mx-qwhy' });
  why.append(h('span', { class: 'mx-qwhy__b', text: 'Why it looked right.' }), document.createTextNode(' B counts 1.5 years of profit, not 2.'));
  card.append(why);
  K.rise(tl, card, T.sheet, { dy: 18, d: 420 });
  K.pop(tl, pencil, T.pick, 0.5);
  K.draw(tl, strike.querySelector('path'), T.strike, 260);
  K.pop(tl, cF, T.fill, 0.4); K.fadeIn(tl, cL, T.fill, 120);
  K.engrave(tl, why, T.why);
  const MH = 112; const MW = (MH * ART_SIZE.mobiThink[0]) / ART_SIZE.mobiThink[1];
  const mobi = h('div', { class: 'mx-abs', style: `left:${356 - MW}px;top:${196 - MH}px;width:${MW}px;height:${MH}px;transform-origin:50% 100%` }, [img(ART.mobiThink, '', 'width:100%;height:100%')]); st.append(mobi);
  if (K.rm) K.fadeIn(tl, mobi, T.mobi);
  else tl.a(mobi, [{ opacity: 0, transform: 'translateX(26px) rotate(8deg)' }, { opacity: 1, transform: 'translateX(0) rotate(0deg)' }], { d: SP.celebrate.d, at: T.mobi, e: SP.celebrate.e });
  const path = h('div', { class: 'mx-card', style: 'left:16px;top:200px;width:328px;height:200px' }); st.append(path); K.rise(tl, path, T.path);
  const r1 = h('div', { class: 'mx-abs', style: 'left:14px;right:14px;top:14px;height:44px' });
  const ic1 = h('div', { class: 'mx-abs mx-roundicon', style: 'left:0;top:2px' }, [icon('send', 18)]);
  r1.append(ic1, h('div', { class: 'mx-t-label mx-abs', style: 'left:52px;top:0', text: 'Now' }), h('div', { class: 'mx-t-cap mx-abs', style: 'left:52px;top:21px', text: 'See why, then one fresh question.' }));
  const tk1 = h('div', { class: 'mx-abs', style: 'right:0;top:8px;width:26px;height:26px;color:var(--mx-good)', html: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' }); r1.append(tk1);
  path.append(r1);
  const r2 = h('div', { class: 'mx-abs', style: 'left:14px;right:14px;top:66px;height:44px' });
  const cal = h('div', { class: 'mx-abs mx-cal' });
  const leaf = (d, n) => h('div', { class: 'mx-cal__leaf' }, [h('div', { class: 'mx-cal__d', text: d }), h('div', { class: 'mx-fig mx-cal__n', text: n })]);
  const wed = leaf('Wed', '28'); const sun = leaf('Sun', '25'); cal.append(wed, sun); sun.style.opacity = 0;
  r2.append(cal, h('div', { class: 'mx-t-label mx-abs', style: 'left:52px;top:0', text: 'Wednesday 28 Oct' }), h('div', { class: 'mx-t-cap mx-abs', style: 'left:52px;top:21px', text: 'One more checks the fix holds.' }));
  path.append(r2);
  path.append(h('div', { class: 'mx-abs mx-hair', style: 'left:14px;right:14px;top:122px' }));
  const r3 = h('div', { class: 'mx-abs', style: 'left:14px;right:14px;top:132px;height:58px' });
  const hY = headDisc('dart', 30, 'position:absolute;left:0;top:4px'); const hR = headDisc('dogear', 30, 'position:absolute;left:22px;top:4px;box-shadow:0 0 0 2px var(--mx-raised)');
  const tickBadge = (l) => h('div', { class: 'mx-abs mx-tickbadge', style: `left:${l}px;top:24px`, html: TICK('var(--mx-ground)', 4) });
  const b1e = tickBadge(18); const b2e = tickBadge(40);
  const seal = img(ART.stampSeal, 'mx-abs', 'left:66px;top:-4px;width:50px;height:50px');
  const fixedT = h('div', { class: 'mx-t-label mx-abs', style: 'left:126px;top:2px', text: 'Fixed together' });
  const prog = h('div', { class: 'mx-t-cap mx-abs', style: 'left:126px;top:23px;width:130px', text: '1 of 3 traps fixed. Crane comes at 3.' });
  const crane = silFold('crane', { x: 280, base: 52, size: 54 });
  r3.append(hY, hR, b1e, b2e, seal, fixedT, prog, crane);
  path.append(r3);
  K.pop(tl, ic1, T.now); K.draw(tl, tk1.querySelector('path'), T.nowTick, 380);
  if (K.rm) tl.a(sun, [{ opacity: 1 }, { opacity: 0 }], { d: 120, at: K.at(T.leaf), e: E.lin });
  else {
    tl.a(sun, [{ opacity: 1, transform: 'rotateX(0deg)' }, { opacity: 1, transform: 'rotateX(-90deg)' }], { d: 200, at: T.leaf, e: E.leave });
    tl.a(wed, [{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(90deg)', offset: 0.5 }, { transform: 'rotateX(0deg)' }], { d: 400, at: T.leaf, e: E.out });
  }
  K.pop(tl, hY, T.heads); K.pop(tl, b1e, T.heads + 110, 0.4); K.pop(tl, hR, T.heads + 90); K.pop(tl, b2e, T.heads + 200, 0.4);
  if (K.rm) K.fadeIn(tl, seal, T.seal);
  else {
    tl.a(seal, [{ opacity: 0, transform: 'scale(1.4) rotate(-6deg)' }, { opacity: 1, transform: 'scale(1.4) rotate(-6deg)', offset: 0.02 }, { opacity: 1, transform: 'scale(1) rotate(2deg)', offset: 0.5 }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }], { d: 520, at: T.seal, e: SP.celebrate.e });
    K.glints(tl, path, { x: 14 + 91, y: 132 + 21, n: 6, r: 32, at: T.seal + 150, color: '#D2F000' });
  }
  K.engrave(tl, fixedT, T.fixed); K.fadeIn(tl, prog, T.progress, 240); K.pop(tl, crane, T.crane);
  if (!K.rm) tl.a(crane, [{ transform: 'rotate(0)' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(0)' }], { d: 600, at: T.wiggle, e: E.sweep, fill: 'none' });
}

// 6. Stitch a week together: the quest fills, the seal stamps, the needle sews week 4 (M10 then M8); your own chain.
function b6(st, tl, { K, T }) {
  const glow = h('div', { class: 'mx-pool', style: 'left:50px;top:-50px;width:260px;height:250px' }); st.append(glow);
  tl.a(glow, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 0.8, transform: 'scale(1)' }], { d: K.rm ? 120 : 420, at: K.at(T.glow), e: E.glide });
  const pen = pennant(st, { x: 180, y: 16, w: 132, weeks: 3, next: 4, name: 'Chai Circle', slots: 4, word: 'weeks in a row' });
  pen.el.style.height = '172px';
  K.swingIn(tl, pen.el, T.pennant);
  const ring = [['dogear', 3, 56, 52], ['kandil', 4, 56, 112], ['hexa', 2, 304, 52], ['dart', 1, 304, 112]];
  const heads = ring.map(([k, c, x, y]) => { const d = headDisc(k, 40, `position:absolute;left:${x - 20}px;top:${y}px;box-shadow:0 0 0 2.5px var(--mob-c${c})`); st.append(d); return d; });
  const q = h('div', { class: 'mx-card', style: 'left:16px;top:204px;width:328px;height:90px;overflow:hidden' }); st.append(q); K.rise(tl, q, T.quest);
  const qTop = h('div', { class: 'mx-abs', style: 'left:16px;right:16px;top:14px;height:58px' });
  qTop.append(h('div', { class: 'mx-t-label mx-abs', style: 'left:0;top:2px;font-size:15px', text: "This week's quest" }));
  const cnt = h('div', { class: 'mx-abs', style: 'right:0;top:-2px;display:flex;align-items:baseline;gap:4px' });
  const cN = h('span', { class: 'mx-fig', text: '51', style: 'font-size:26px' }); cnt.append(cN, h('span', { class: 'mx-t-cap', text: 'of 60 questions' })); qTop.append(cnt);
  const bar = h('div', { class: 'mx-abs mx-qbar' }); qTop.append(bar);
  const segs = [];
  for (let i = 0; i < 12; i += 1) {
    const s = h('div', { class: 'mx-qseg' }); const fl = h('div', { class: 'mx-qseg__fill' });
    if (i >= 10) fl.style.transform = 'scaleX(0)';
    s.append(fl); bar.append(s); segs.push({ s, fl });
  }
  q.append(qTop);
  const done = h('div', { class: 'mx-abs', style: 'left:16px;right:16px;top:14px;height:64px' });
  const seal = img(ART.stampSeal, 'mx-abs', 'left:-2px;top:-2px;width:64px;height:64px');
  const dT = h('div', { class: 'mx-abs mx-donetitle', text: 'Quest done' });
  const dL = h('div', { class: 'mx-t-cap mx-abs', style: 'left:72px;top:34px', text: 'Chai Circle answered 60. Week 4 is stitched.' });
  done.append(seal, dT, dL); q.append(done);
  const F0 = T.count;
  segs.forEach((g, i) => {
    if (i < 10) return;
    if (K.rm) tl.a(g.fl, [{ transform: 'scaleX(1)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1 }], { d: 120, at: K.at(F0 + (i - 10) * 260 + 200), e: E.lin });
    else tl.a(g.fl, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { d: 240, at: F0 + (i - 10) * 260 + 160, e: E.out });
  });
  tl.tick((t) => {
    const p = Math.max(0, Math.min(1, (t - K.at(F0)) / (K.rm ? 1 : 600)));
    const v = String(Math.round(51 + 9 * (K.rm ? (p >= 1 ? 1 : 0) : 1 - (1 - p) ** 2)));
    if (cN.textContent !== v) cN.textContent = v;
  }, F0 + 700);
  if (!K.rm) {
    tl.a(bar, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { d: 260, at: T.pulse, e: E.out, fill: 'none' });
    segs.forEach((g, i) => tl.a(g.s, [{ transform: 'translateY(0)', boxShadow: '0 0 0 0 rgba(210,240,0,0)' }, { transform: 'translateY(-1px)', boxShadow: '0 0 10px 0 rgba(210,240,0,.28)', offset: 0.4 }, { transform: 'translateY(0)', boxShadow: '0 0 0 0 rgba(210,240,0,0)' }], { d: 420, at: T.pulse + 80 + i * 22, e: E.out, fill: 'none' }));
    tl.a(qTop, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-10px) scaleY(.6)' }], { d: 200, at: T.fold, e: E.leave });
    tl.a(seal, [{ opacity: 0, transform: 'scale(1.4) rotate(-6deg)' }, { opacity: 1, transform: 'scale(1.4) rotate(-6deg)', offset: 0.02 }, { opacity: 1, transform: 'scale(1) rotate(2deg)', offset: 0.5 }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }], { d: 520, at: T.seal, e: SP.celebrate.e });
    K.glints(tl, q, { x: 46, y: 46, n: 8, r: 36, at: T.seal + 150, color: '#D2F000' });
  } else {
    tl.a(qTop, [{ opacity: 1 }, { opacity: 0 }], { d: 120, at: K.at(T.fold), e: E.lin });
    tl.a(seal, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: K.at(T.seal), e: E.lin });
  }
  K.engrave(tl, dT, T.done); K.fadeIn(tl, dL, T.done + 100, 240);
  // the needle sews week 4, only after the quest is done (F13)
  const s4 = pen.stitches[3]; const sp = s4.querySelector('path'); const SW = T.stitch;
  if (K.rm) tl.a(sp, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: K.at(SW), e: E.lin });
  else {
    const Lp = sp.getTotalLength(); sp.style.strokeDasharray = `${Lp} ${Lp}`;
    tl.a(glow, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.6)', offset: 0.3 }, { filter: 'brightness(1.2)' }], { d: 1400, at: T.lamp, e: E.lin, fill: 'forwards' });
    tl.a(sp, [{ strokeDashoffset: Lp }, { strokeDashoffset: 0 }], { d: 450, at: SW, e: E.inOut });
    const kq = pen.ss / 16; const Pt = (x, y) => `${((x + 1) * kq).toFixed(1)} ${((y + 1) * kq).toFixed(1)}`;
    const needle = h('div', { class: 'mx-needle', style: `offset-path:path('M${Pt(1, 1)} L${Pt(13, 13)} L${Pt(13, 1)} L${Pt(1, 13)}')` });
    s4.append(needle);
    tl.a(needle, [{ offsetDistance: '0%', opacity: 0 }, { offsetDistance: '0%', opacity: 1, offset: 0.05 }, { offsetDistance: '100%', opacity: 1, offset: 0.92 }, { offsetDistance: '100%', opacity: 0 }], { d: 520, at: SW, e: E.inOut });
    tl.a(pen.el, [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-8px) rotate(-1.5deg)', offset: 0.25 }, { transform: 'translateY(0) scale(1.03) rotate(1.2deg)', offset: 0.55 }, { transform: 'rotate(-.5deg)', offset: 0.8 }, { transform: 'rotate(0deg)' }], { d: 1100, at: SW - 200, e: E.out, fill: 'none' });
    K.glints(tl, pen.band, { x: (pen.bandW / 4) * 3.5, y: 132 * 0.1, n: 6, r: 18, at: SW + 460, color: '#D2F000' });
  }
  if (K.rm) {
    tl.a(pen.nOld, [{ opacity: 1 }, { opacity: 0 }], { d: 120, at: K.at(T.roll), e: E.lin });
    tl.a(pen.nNew, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: K.at(T.roll), e: E.lin });
  } else {
    tl.a(pen.nOld, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-60%)' }], { d: 300, at: T.roll, e: E.leave });
    tl.a(pen.nNew, [{ opacity: 0, transform: 'translateY(60%)' }, { opacity: 1, transform: 'translateY(0)' }], { d: 500, at: T.roll + 120, e: SP.smooth.e });
  }
  heads.forEach((d, i) => K.pop(tl, d, T.heads + i * 45, 0.6));
  const c = h('div', { class: 'mx-card', style: 'left:16px;top:304px;width:328px;height:96px' }); st.append(c); K.rise(tl, c, T.quest + 100);
  c.append(h('div', { class: 'mx-t-label mx-abs', style: 'left:16px;top:12px;font-size:15px', text: 'Your chain' }));
  c.append(h('div', { class: 'mx-abs', style: 'right:16px;top:6px;display:flex;align-items:baseline;gap:4px' }, [h('span', { class: 'mx-fig', text: '14', style: 'font-size:26px' }), h('span', { class: 'mx-t-cap', text: 'days in a row' })]));
  for (let i = 0; i < 7; i += 1) {
    const rested = i === 4; const x = 16 + i * 42;
    const box = h('div', { class: `mx-day${rested ? ' is-rested' : ''}`, style: `left:${x}px` });
    box.append(rested ? icon('moon', 15) : h('span', { html: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' }));
    c.append(box);
    if (K.rm) K.fadeIn(tl, box, T.days + i * 70);
    else tl.a(box, [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'translateY(0)' }], { d: i === 6 ? SP.celebrate.d : 300, at: T.days + i * 70, e: i === 6 ? SP.celebrate.e : E.out });
  }
  const cap = h('div', { class: 'mx-t-cap mx-abs', style: 'left:16px;top:72px;font-size:12.5px', text: 'Moon: a rest pass kept the chain.' }); c.append(cap); K.fadeIn(tl, cap, T.moon, 240);
}

// 7. Earned, never bought: the parcel opens and Hop climbs out (M9); the shelf shows what is still to earn.
function b7(st, tl, { K, T }) {
  const L = lamp(st, { x: 180, h: 300, w: 280 });
  if (K.rm) tl.a(L.el, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: 0, e: E.lin });
  else tl.a(L.cone, [{ opacity: 0.5, transform: 'translateX(-50%) scaleX(1.3)' }, { opacity: 1, transform: 'translateX(-50%) scaleX(1)' }], { d: 420, at: T.cone, e: E.emph });
  const PX = 180; const PS = 156; const PTOP = 88;
  const leak = h('div', { class: 'mx-pool', style: `left:${PX - 110}px;top:${PTOP + 30}px;width:220px;height:110px;opacity:0` }); st.append(leak);
  const pw = h('div', { class: 'mx-abs', style: `left:${PX - PS / 2}px;top:${PTOP}px;width:${PS}px;height:${PS}px;transform-origin:50% 90%` }); st.append(pw);
  const pS = img(ART.parcelSealed, 'mx-abs', 'inset:0;width:100%;height:100%;opacity:0');
  const pP = img(ART.parcelPop, 'mx-abs', 'inset:0;width:100%;height:100%;opacity:0');
  const pO = img(ART.parcelOpen, 'mx-abs', 'inset:0;width:100%;height:100%');
  pw.append(pS, pP, pO);
  const rim = PTOP + PS * 0.5; const hopBase = rim + 16; const HS = 128;
  const hopClip = h('div', { class: 'mx-abs', style: `left:0;top:0;width:360px;height:${rim + 4}px;overflow:hidden;z-index:5` }); st.append(hopClip);
  const hop = fold('hop', { x: PX + 4, base: hopBase, size: HS, pose: 'cheer', large: true, noShadow: true, z: 5 }); hopClip.append(hop.root);
  const name = h('div', { class: 'mx-abs mx-hopname', style: `top:${PTOP + PS + 2}px`, text: 'Hop' });
  const line = h('div', { class: 'mx-t-cap mx-abs', style: `left:0;right:0;top:${PTOP + PS + 32}px;text-align:center;font-size:14px`, text: 'Bounces back after a wrong one.' });
  st.append(name, line);
  K.fadeIn(tl, pw, 120, 240);
  if (K.rm) {
    tl.a(pS, [{ opacity: 1 }, { opacity: 0 }], { d: 120, at: K.at(T.pop), e: E.lin });
    tl.a(pO, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: K.at(T.pop), e: E.lin });
    tl.a(hop.en, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: K.at(T.hop), e: E.lin });
    K.fadeIn(tl, name, T.name); K.fadeIn(tl, line, T.line);
  } else {
    tl.a(pS, [{ opacity: 1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { d: T.open - 40, at: 0, e: E.lin });
    tl.a(pP, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { d: 140, at: T.pop, e: E.lin });
    tl.a(pO, [{ opacity: 0 }, { opacity: 0, offset: 0.99 }, { opacity: 1 }], { d: T.open, at: 0, e: E.lin });
    tl.a(pw, [{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(.94) rotate(0)', offset: 0.16 }, { transform: 'scale(.97) rotate(-3deg)', offset: 0.38 }, { transform: 'scale(.97) rotate(3deg)', offset: 0.6 }, { transform: 'scale(.97) rotate(0)', offset: 0.78 }, { transform: 'scale(1.05) rotate(0)', offset: 0.9 }, { transform: 'scale(1) rotate(0)' }], { d: 780, at: T.pull, e: E.lin });
    tl.a(leak, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.1)', offset: 0.35 }, { opacity: 0.6, transform: 'scale(1)' }], { d: 900, at: T.leak, e: E.out });
    tl.a(hop.en, [{ opacity: 0, transform: 'translateY(96px)' }, { opacity: 1, transform: 'translateY(96px)', offset: 0.01 }, { opacity: 1, transform: 'translateY(0)' }], { d: SP.celebrate.d, at: T.hop, e: SP.celebrate.e });
    K.squash(tl, hop, T.name);
    K.bits(tl, st, { x: PX, y: rim - 10, n: 22, at: T.hop + 20, floor: PTOP + PS - 6, seed: 31, up: 220 });
    K.glints(tl, st, { x: PX, y: rim - 50, n: 6, r: 74, at: T.hop + 170 });
    K.engrave(tl, name, T.name); K.rise(tl, line, T.line, { dy: 8 });
    tl.a(L.cone, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.45)', offset: 0.4 }, { filter: 'brightness(1.15)' }], { d: 1000, at: T.pop, e: E.lin });
  }
  K.idle(tl, hop, T.shelf, 17);
  const shelfY = 336;
  const plank = h('div', { class: 'mx-abs mx-plank', style: `left:16px;right:16px;top:${shelfY}px` }); st.append(plank);
  const items = [['crane', '3 traps fixed together'], ['stamp', '4 weeks in a row'], ['patang', 'Beat your best'], ['sticky', '5 fixes that held']];
  K.fadeIn(tl, plank, T.shelf, 240);
  items.forEach(([k, rule], i) => {
    const x = 58 + i * 81; const sf = silFold(k, { x, base: shelfY + 2, size: 56 }); st.append(sf);
    const capEl = h('div', { class: 'mx-abs mx-shelfcap', style: `left:${x - 40}px;top:${shelfY + 12}px`, text: rule }); st.append(capEl);
    K.pop(tl, sf, T.sil0 + i * 90); K.fadeIn(tl, capEl, T.cap0 + i * 90, 240);
  });
}

export const BUILDERS = Object.freeze([b1, b2, b3, b4, b5, b6, b7]);
