// The home page's cascade must not depend on the order its stylesheets load in (paint pass, 15 Nov 2026).
//
// "/" draws with its own 23 sheets (HOME_SHEETS, joined into home-sheets.css) and with the sheets its components and the root
// layout import (scroll-story.css, section-position.css, du.css, marketing.css ...). Neither bundler promises where a
// component's sheet lands against the page's own: live www.mockmob.in served every component sheet first, a webpack build of
// the joined file served three of them after it. When a home rule and a component rule have the same specificity, set the
// same property and match the same element, the one that loads later wins, so the page changed with the bundler (the tour's
// hold fell back to 72svh, the DU teaser's result card took du.css's tint). The home rule is the one meant to win (it is the
// newer layer, written to override), so every such home rule carries a deliberate specificity raise of one type selector, a
// body ancestor (`body .ft-story`, `html:has(body .lp)`): the same elements, and the smallest step up. A whole class would have
// overtaken component rules that beat the home rule today (`.lp .lp-price__head` over `.lp-head`) and changed the page.
// data/tests/home_cascade_order.test.mjs holds it, with this module.
//
// No dependencies: a small CSS reader (rules, their @media/@supports/@container and declarations), selector specificity
// (Selectors 4: :is/:not/:has take their most specific argument, :where counts nothing), the shorthands that overlap, and
// the rendered page's element tree (data/tests/fixtures/home-elements.json, captured by scripts/capture-home-elements.mjs)
// to tell whether two rules can meet on one element.

/** Rules of a sheet: [{ selector, line, conds: ['@media ...'], decls: [{ prop, value, important }] }]. */
export function readRules(css) {
  const rules = [];
  const stack = []; // { kind: 'at' | 'rule' | 'skip', head }
  let buf = '';
  let line = 1;
  let headLine = 1;
  let current = null;
  const flushDecl = () => {
    const text = buf.trim();
    buf = '';
    if (!current || !text) return;
    const colon = text.indexOf(':');
    if (colon < 1) return;
    const prop = text.slice(0, colon).trim();
    let value = text.slice(colon + 1).trim();
    const important = /!\s*important\s*$/i.test(value);
    if (important) value = value.replace(/!\s*important\s*$/i, '').trim();
    current.decls.push({ prop: prop.startsWith('--') ? prop : prop.toLowerCase(), value, important });
  };
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '\n') line += 1;
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end < 0 ? css.length : end + 2;
      for (let j = i; j < stop; j += 1) if (css[j] === '\n') line += 1;
      i = stop - 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch) j += css[j] === '\\' ? 2 : 1;
      buf += css.slice(i, j + 1);
      i = j;
      continue;
    }
    if (ch === '(' ) {
      // url(...) and other functions may hold ; or { in theory; copy balanced parentheses whole.
      let depth = 0; let j = i;
      for (; j < css.length; j += 1) {
        const c = css[j];
        if (c === '"' || c === "'") { let k = j + 1; while (k < css.length && css[k] !== c) k += css[k] === '\\' ? 2 : 1; j = k; continue; }
        if (c === '(') depth += 1; else if (c === ')') { depth -= 1; if (depth === 0) break; }
        if (c === '\n') line += 1;
      }
      buf += css.slice(i, j + 1);
      i = j;
      continue;
    }
    if (ch === '{') {
      const head = buf.trim();
      buf = '';
      if (current) { stack.push({ kind: 'skip' }); continue; } // nesting is not used in these sheets
      const parentSkip = stack.some((s) => s.kind === 'skip');
      if (head.startsWith('@')) {
        const name = head.slice(1).split(/[\s(]/)[0].toLowerCase();
        const kind = ['media', 'supports', 'container', 'layer'].includes(name) && !parentSkip ? 'at' : 'skip';
        stack.push({ kind, head });
      } else if (parentSkip) {
        stack.push({ kind: 'skip' });
      } else {
        current = { selector: head, line: headLine, conds: stack.filter((s) => s.kind === 'at').map((s) => s.head), decls: [] };
        stack.push({ kind: 'rule' });
      }
      continue;
    }
    if (ch === '}') {
      const top = stack.pop();
      if (top?.kind === 'rule') { flushDecl(); if (current.decls.length) rules.push(current); current = null; }
      buf = '';
      continue;
    }
    if (ch === ';') { if (current) flushDecl(); else buf = ''; continue; }
    if (!buf.trim()) headLine = line;
    buf += ch;
  }
  return rules;
}

/** Splits at top-level commas (not inside parentheses, brackets or strings). */
export function splitList(text) {
  const out = []; let depth = 0; let cur = ''; let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) { cur += ch; if (ch === '\\') { cur += text[i + 1] ?? ''; i += 1; } else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const LEGACY_PSEUDO_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter']);

/** One complex selector as compounds: [{ combinator, parts: [{ t: 'type'|'id'|'class'|'attr'|'pc'|'pe'|'univ', v, arg }] }]. */
export function compounds(selector) {
  const list = [{ combinator: '', parts: [] }];
  let i = 0;
  const s = selector.trim();
  const ident = () => {
    let v = '';
    while (i < s.length && /[\w\-\\\u00a0-\uffff]/.test(s[i])) { if (s[i] === '\\') { v += s[i]; i += 1; } v += s[i]; i += 1; }
    return v;
  };
  const balanced = (open, close) => {
    let depth = 0; let v = ''; let quote = null;
    do {
      const c = s[i];
      if (quote) { if (c === quote) quote = null; } else if (c === '"' || c === "'") quote = c; else if (c === open) depth += 1; else if (c === close) depth -= 1;
      v += c; i += 1;
    } while (i < s.length && (depth > 0 || quote));
    return v;
  };
  while (i < s.length) {
    const ch = s[i];
    if (/[\s>+~]/.test(ch)) {
      let c = '';
      while (i < s.length && /[\s>+~]/.test(s[i])) { c += s[i]; i += 1; }
      if (i < s.length) list.push({ combinator: c.trim() || ' ', parts: [] });
      continue;
    }
    const parts = list[list.length - 1].parts;
    if (ch === '#') { i += 1; parts.push({ t: 'id', v: ident() }); continue; }
    if (ch === '.') { i += 1; parts.push({ t: 'class', v: ident() }); continue; }
    if (ch === '*') { i += 1; parts.push({ t: 'univ', v: '*' }); continue; }
    if (ch === '&') { i += 1; continue; }
    if (ch === '[') { parts.push({ t: 'attr', v: balanced('[', ']') }); continue; }
    if (ch === ':') {
      i += 1;
      let element = false;
      if (s[i] === ':') { element = true; i += 1; }
      const name = ident().toLowerCase();
      let arg = null;
      if (s[i] === '(') arg = balanced('(', ')').slice(1, -1);
      parts.push({ t: element || LEGACY_PSEUDO_ELEMENTS.has(name) ? 'pe' : 'pc', v: name, arg });
      continue;
    }
    if (/[\w-]/.test(ch)) { parts.push({ t: 'type', v: ident().toLowerCase() }); continue; }
    i += 1;
  }
  return list;
}

const ARG_MAX = new Set(['is', 'not', 'has', 'matches', '-webkit-any', '-moz-any']);

/** Specificity [ids, classes, types] of one complex selector (Selectors level 4). */
export function specificity(selector) {
  const total = [0, 0, 0];
  const add = (x) => { total[0] += x[0]; total[1] += x[1]; total[2] += x[2]; };
  for (const { parts } of compounds(selector)) {
    for (const p of parts) {
      if (p.t === 'id') total[0] += 1;
      else if (p.t === 'class' || p.t === 'attr') total[1] += 1;
      else if (p.t === 'type' || p.t === 'pe') total[2] += 1;
      else if (p.t === 'pc') {
        if (p.v === 'where') continue;
        if (ARG_MAX.has(p.v)) add(maxSpecificity(splitList(p.arg ?? '')));
        else if ((p.v === 'nth-child' || p.v === 'nth-last-child') && /\sof\s/.test(p.arg ?? '')) {
          total[1] += 1;
          add(maxSpecificity(splitList(p.arg.split(/\sof\s/)[1])));
        } else total[1] += 1;
      }
    }
  }
  return total;
}
function maxSpecificity(list) {
  return list.map(specificity).reduce((best, x) => (compareSpecificity(x, best) > 0 ? x : best), [0, 0, 0]);
}
export function compareSpecificity(a, b) {
  return (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
}

// The shorthands these sheets use, with the longhands they set (enough to see two declarations meet; not a full CSS table).
const SIDES = ['top', 'right', 'bottom', 'left'];
const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
const SHORTHANDS = {
  margin: SIDES.map((s) => `margin-${s}`),
  padding: SIDES.map((s) => `padding-${s}`),
  inset: SIDES,
  'margin-inline': ['margin-left', 'margin-right'], 'margin-block': ['margin-top', 'margin-bottom'],
  'padding-inline': ['padding-left', 'padding-right'], 'padding-block': ['padding-top', 'padding-bottom'],
  'margin-inline-start': ['margin-left'], 'margin-inline-end': ['margin-right'], 'margin-block-start': ['margin-top'], 'margin-block-end': ['margin-bottom'],
  'padding-inline-start': ['padding-left'], 'padding-inline-end': ['padding-right'], 'padding-block-start': ['padding-top'], 'padding-block-end': ['padding-bottom'],
  'inset-inline': ['left', 'right'], 'inset-block': ['top', 'bottom'], 'inset-inline-start': ['left'], 'inset-inline-end': ['right'], 'inset-block-start': ['top'], 'inset-block-end': ['bottom'],
  border: SIDES.flatMap((s) => ['width', 'style', 'color'].map((k) => `border-${s}-${k}`)),
  'border-width': SIDES.map((s) => `border-${s}-width`), 'border-style': SIDES.map((s) => `border-${s}-style`), 'border-color': SIDES.map((s) => `border-${s}-color`),
  'border-radius': CORNERS.map((c) => `border-${c}-radius`),
  ...Object.fromEntries(SIDES.map((s) => [`border-${s}`, ['width', 'style', 'color'].map((k) => `border-${s}-${k}`)])),
  'border-inline': ['left', 'right'].flatMap((s) => ['width', 'style', 'color'].map((k) => `border-${s}-${k}`)),
  'border-block': ['top', 'bottom'].flatMap((s) => ['width', 'style', 'color'].map((k) => `border-${s}-${k}`)),
  'border-inline-start': ['width', 'style', 'color'].map((k) => `border-left-${k}`), 'border-inline-end': ['width', 'style', 'color'].map((k) => `border-right-${k}`),
  'border-block-start': ['width', 'style', 'color'].map((k) => `border-top-${k}`), 'border-block-end': ['width', 'style', 'color'].map((k) => `border-bottom-${k}`),
  background: ['background-image', 'background-position', 'background-size', 'background-repeat', 'background-attachment', 'background-origin', 'background-clip', 'background-color'],
  'background-position': ['background-position'],
  outline: ['outline-color', 'outline-style', 'outline-width'],
  gap: ['row-gap', 'column-gap'], 'grid-gap': ['row-gap', 'column-gap'], 'grid-row-gap': ['row-gap'], 'grid-column-gap': ['column-gap'],
  transition: ['transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay', 'transition-behavior'],
  animation: ['animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-fill-mode', 'animation-play-state', 'animation-timeline', 'animation-range-start', 'animation-range-end'],
  'animation-range': ['animation-range-start', 'animation-range-end'],
  font: ['font-style', 'font-variant', 'font-weight', 'font-stretch', 'font-size', 'line-height', 'font-family'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'], 'flex-flow': ['flex-direction', 'flex-wrap'],
  overflow: ['overflow-x', 'overflow-y'],
  'place-items': ['align-items', 'justify-items'], 'place-content': ['align-content', 'justify-content'], 'place-self': ['align-self', 'justify-self'],
  grid: ['grid-template-rows', 'grid-template-columns', 'grid-template-areas', 'grid-auto-rows', 'grid-auto-columns', 'grid-auto-flow'],
  'grid-template': ['grid-template-rows', 'grid-template-columns', 'grid-template-areas'],
  'grid-area': ['grid-row-start', 'grid-column-start', 'grid-row-end', 'grid-column-end'],
  'grid-row': ['grid-row-start', 'grid-row-end'], 'grid-column': ['grid-column-start', 'grid-column-end'],
  'text-decoration': ['text-decoration-line', 'text-decoration-style', 'text-decoration-color', 'text-decoration-thickness'],
  'list-style': ['list-style-type', 'list-style-position', 'list-style-image'],
  columns: ['column-width', 'column-count'],
  'scroll-margin': SIDES.map((s) => `scroll-margin-${s}`), 'scroll-padding': SIDES.map((s) => `scroll-padding-${s}`),
  'scroll-margin-block': ['scroll-margin-top', 'scroll-margin-bottom'], 'scroll-padding-block': ['scroll-padding-top', 'scroll-padding-bottom'],
  'scroll-margin-top': ['scroll-margin-top'],
  mask: ['mask-image', 'mask-position', 'mask-size', 'mask-repeat', 'mask-origin', 'mask-clip', 'mask-composite', 'mask-mode'],
  'container': ['container-name', 'container-type'],
  'contain-intrinsic-size': ['contain-intrinsic-width', 'contain-intrinsic-height'],
  'text-wrap': ['text-wrap-mode', 'text-wrap-style'],
  'white-space': ['white-space-collapse', 'text-wrap-mode'],
  'overscroll-behavior': ['overscroll-behavior-x', 'overscroll-behavior-y'],
  'offset': ['offset-path', 'offset-distance', 'offset-rotate', 'offset-anchor', 'offset-position'],
  'inline-size': ['width'], 'block-size': ['height'], 'min-inline-size': ['min-width'], 'min-block-size': ['min-height'], 'max-inline-size': ['max-width'], 'max-block-size': ['max-height'],
};
/** The longhands a declaration sets (vendor prefixes dropped; logical properties mapped for a left-to-right page). */
export function longhands(prop) {
  if (prop.startsWith('--')) return [prop];
  const p = prop.replace(/^-(webkit|moz|ms)-/, '');
  return SHORTHANDS[p] ?? [p];
}

/** The page's element tree from the fixture: rows of [tag, id, 'classes', parent row or -1, 'attribute names']. */
export function elementTree(rows) {
  const nodes = rows.map(([t, id, c, parent, a]) => ({ t, id: id || null, c: new Set(c ? c.split(' ') : []), parent, a: new Set(a ? a.split(' ') : []), kids: [] }));
  nodes.forEach((n, i) => { if (n.parent >= 0) nodes[n.parent].kids.push(i); });
  return nodes;
}

// Whether one compound can match a node. An attribute selector needs the attribute on that element in some view of the page
// (its value is not read: state such as [data-pinned='true'] changes as the page scrolls); pseudo-classes count as met, apart
// from :is/:where/:matches and a :not of plain classes, ids and tags. So a check errs towards two rules meeting.
const plain = (list) => list.length === 1 && list[0].parts.every((p) => p.t === 'class' || p.t === 'id' || p.t === 'type' || p.t === 'univ');
function compoundFits(parts, nodes, i) {
  const node = nodes[i];
  for (const p of parts) {
    if (p.t === 'type' && p.v !== node.t) return false;
    if (p.t === 'id' && p.v !== node.id) return false;
    if (p.t === 'class' && !node.c.has(p.v)) return false;
    if (p.t === 'attr' && !node.a.has(p.v.slice(1).split(/[~|^$*]?=|]/)[0].trim().toLowerCase())) return false;
    if (p.t === 'pc' && p.v === 'not') {
      const alts = splitList(p.arg ?? '').map((alt) => compounds(alt));
      if (alts.every(plain) && alts.some((list) => compoundFits(list[0].parts, nodes, i))) return false;
    }
    if (p.t === 'pc' && ['is', 'where', 'matches'].includes(p.v)) {
      const alts = splitList(p.arg ?? '').map((alt) => compounds(alt));
      if (!alts.some((list) => canMatch(list, nodes, i))) return false;
    }
  }
  return true;
}

/** Whether a complex selector can match node i of the tree (right to left: descendant, child and sibling combinators). */
export function canMatch(list, nodes, i, k = list.length - 1) {
  const node = nodes[i];
  if (!compoundFits(list[k].parts, nodes, i)) return false;
  if (k === 0) return true;
  const comb = list[k].combinator;
  if (comb === '>') return node.parent >= 0 && canMatch(list, nodes, node.parent, k - 1);
  if (comb === '+' || comb === '~') {
    // The tree keeps no sibling order: any other child of the same parent may be the sibling.
    return node.parent >= 0 && nodes[node.parent].kids.some((j) => j !== i && canMatch(list, nodes, j, k - 1));
  }
  for (let p = node.parent; p >= 0; p = nodes[p].parent) if (canMatch(list, nodes, p, k - 1)) return true;
  return false;
}

/** Declarations of a set of sheets, one entry per complex selector: { file, line, selector, spec, list, pe, conds, decls }. */
export function entries(sheets) {
  const out = [];
  for (const { file, css } of sheets) {
    for (const rule of readRules(css)) {
      for (const selector of splitList(rule.selector)) {
        const list = compounds(selector);
        const pe = list[list.length - 1].parts.filter((p) => p.t === 'pe').map((p) => p.v).join('::');
        out.push({ file, line: rule.line, selector, spec: specificity(selector), list, pe, conds: rule.conds, decls: rule.decls });
      }
    }
  }
  return out;
}

/** Home rules that tie a component rule: same specificity and importance, a property in common, and an element of the page
 *  both can style. Each tie is a place where the page's look depends on which sheet the bundler loads last. */
export function ties({ home, components, nodes }) {
  const matched = new Map();
  const matches = (e) => {
    if (!matched.has(e)) {
      const set = new Set();
      nodes.forEach((_, i) => { if (canMatch(e.list, nodes, i)) set.add(i); });
      matched.set(e, set);
    }
    return matched.get(e);
  };
  const props = (decls) => {
    const map = new Map();
    for (const d of decls) for (const p of longhands(d.prop)) map.set(p, d);
    return map;
  };
  // Print sheets are not the page's look: a tie that only exists on paper is left alone (du.css's print palette).
  const onScreen = (e) => !e.conds.some((c) => /^@media\s+print\b/i.test(c));
  const comps = components.filter(onScreen).map((c) => ({ ...c, props: props(c.decls) }));
  const found = [];
  for (const h of home.filter(onScreen)) {
    const hp = props(h.decls);
    for (const c of comps) {
      if (h.pe !== c.pe || compareSpecificity(h.spec, c.spec) !== 0) continue;
      const common = [...hp.keys()].filter((p) => c.props.has(p) && hp.get(p).important === c.props.get(p).important);
      if (!common.length) continue;
      const mh = matches(h);
      if (!mh.size) continue;
      const mc = matches(c);
      let meet = false;
      for (const i of mh) if (mc.has(i)) { meet = true; break; }
      if (!meet) continue;
      found.push({ home: `${h.file}:${h.line} ${h.selector}`, component: `${c.file}:${c.line} ${c.selector}`, props: common, spec: h.spec.join(","), line: h.line, file: h.file, selector: h.selector });
    }
  }
  return found;
}

/** The stylesheets a module pulls in through its imports (static and dynamic), in import order, depth first. */
export function importedSheets(entryFiles, { read, resolve }) {
  const seen = new Set();
  const sheets = [];
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    let text;
    try { text = read(file); } catch { return; }
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
    for (const m of code.matchAll(/(?:^|[\s;])import\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const spec = m[1] ?? m[2];
      const target = resolve(spec, file);
      if (!target) continue;
      if (target.endsWith('.css')) { if (!sheets.includes(target)) sheets.push(target); } else visit(target);
    }
  };
  for (const f of entryFiles) visit(f);
  return sheets;
}
