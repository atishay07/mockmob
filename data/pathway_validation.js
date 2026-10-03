// Software consistency checks for a recovery pathway, independent of its authored text.
// Every keyed answer and every diagnostic-matrix cell is recomputed from the item's
// scenario with exact fractions. Passing proves internal consistency only: it is not
// academic validation, and it does not show that students reason the way a hypothesis says.
import { createHash } from 'node:crypto';
import { validatePathway } from './learning_engine.js';
import { solveReasoningStep } from './recovery_solvers.js';
import { contentHash } from './content_evidence.js';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const frac = (n, d = 1) => { if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) throw new Error('INVALID_FRACTION'); const s = d < 0 ? -1 : 1; const g = gcd(n, d); return [s * n / g, s * d / g]; };
const sub = ([a, b], [c, d]) => frac(a * d - c * b, b * d);
const add = ([a, b], [c, d]) => frac(a * d + c * b, b * d);
const mul = ([a, b], [c, d]) => frac(a * c, b * d);
const div = ([a, b], [c, d]) => frac(a * d, b * c);
const eq = (x, y) => x[0] === y[0] && x[1] === y[1];
const ZERO = [0, 1];
const show = ([n, d]) => d === 1 ? String(n) : `${n}/${d}`;

export function sharesOf(ratio) {
  const total = Object.values(ratio).reduce((s, n) => s + n, 0);
  if (!(total > 0) || Object.values(ratio).some(n => !Number.isInteger(n) || n < 0)) throw new Error('INVALID_RATIO');
  return Object.fromEntries(Object.entries(ratio).map(([p, n]) => [p, frac(n, total)]));
}

// Old partners who remain after the change; a retiring/deceased partner leaves.
const continuing = s => Object.keys(s.old).filter(p => p in s.new);

/** Signed change per continuing partner: positive = sacrifice (old − new), negative = gain. */
export function movement(scenario) {
  const o = sharesOf(scenario.old), n = sharesOf(scenario.new);
  return Object.fromEntries(continuing(scenario).map(p => [p, sub(o[p], n[p])]));
}

/** Rebuild the new ratio from a described admission, so the prompt's wording is checked too. */
export function derivedShares({ old, derive }) {
  const o = sharesOf(old); const share = frac(...derive.share); const out = { ...o };
  if (derive.from === 'old_ratio') for (const p of Object.keys(o)) out[p] = sub(o[p], mul(share, o[p]));
  else if (derive.from in o) out[derive.from] = sub(o[derive.from], share);
  else throw new Error('UNKNOWN_DERIVATION');
  out[derive.incoming] = share;
  return out;
}

const leaving = s => ['retirement', 'death'].includes(s.type);

/** What a student holding hypothesis h would claim. Exact amounts only where h computes them. */
export function simulate(h, scenario) {
  const m = movement(scenario); const parts = continuing(scenario);
  if (h === 'secure') return { exact: m };
  if (h === 'direction_reversed') return { exact: Object.fromEntries(Object.entries(m).map(([p, [a, b]]) => [p, frac(-a, b)])) };
  const sign = leaving(scenario) ? -1 : 1;
  const terms = h === 'old_ratio_default' ? scenario.old : h === 'new_ratio_used' ? scenario.new : null;
  if (!terms) throw new Error(`UNKNOWN_HYPOTHESIS:${h}`);
  return { weights: Object.fromEntries(parts.map(p => [p, frac(sign * terms[p])])) };
}

function normalise(vector, parts) {
  const full = Object.fromEntries(parts.map(p => [p, vector[p] || ZERO]));
  const total = Object.values(full).reduce((s, [a, b]) => add(s, frac(Math.abs(a), b)), ZERO);
  if (total[0] === 0) return full;
  return Object.fromEntries(Object.entries(full).map(([p, v]) => [p, div(v, total)]));
}

function claimVector(claim) {
  if (claim.kind === 'moves') return { exact: Object.fromEntries(Object.entries(claim.moves).map(([p, v]) => [p, frac(...v)])) };
  if (claim.kind === 'ratio') { const sign = claim.verb === 'gain' ? -1 : 1; return { weights: Object.fromEntries(Object.entries(claim.ratio).map(([p, n]) => [p, frac(sign * n)])) }; }
  throw new Error('UNKNOWN_CLAIM');
}

/** Does a stated option say what hypothesis h would produce for this scenario? */
export function claimMatches(claim, simulated, scenario) {
  const parts = continuing(scenario); const c = claimVector(claim);
  if (c.exact) return Boolean(simulated.exact) && parts.every(p => eq(c.exact[p] || ZERO, simulated.exact[p]));
  const a = normalise(c.weights, parts), b = normalise(simulated.exact || simulated.weights, parts);
  return parts.every(p => eq(a[p], b[p]));
}

// The option text must carry the claim's numbers and direction, so text and structure agree.
// Partners are bound to their own amount and direction ("A sacrifices 3/10"), and ratio terms
// to the partner order they are stated in, so swapped attributions fail.
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const listOf = names => names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
function textCarriesClaim(text, prompt, claim) {
  if (claim.kind === 'ratio') {
    const names = Object.keys(claim.ratio); const verb = claim.verb === 'gain' ? 'gain' : 'sacrific';
    const list = listOf(names);
    return text.includes(Object.values(claim.ratio).join(':')) && (text.includes(list) || prompt.includes(list))
      && (new RegExp(`${escape(list)} ${verb}`).test(text) || new RegExp(`${escape(list)} ${verb}`).test(prompt));
  }
  return Object.entries(claim.moves).every(([p, v]) => {
    const f = frac(...v);
    if (f[0] === 0) return new RegExp(`\\b${escape(p)}(?:'s share)? is (?:unaffected|unchanged)`).test(text);
    return new RegExp(`\\b${escape(p)} ${f[0] > 0 ? 'sacrifices' : 'gains'} ${escape(show(frac(Math.abs(f[0]), f[1])))}\\b`).test(text);
  });
}

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
/** Same digest the server compares against a registered pathway before any exposure. */
export function pathwayDigest(pathway) { return createHash('sha256').update(JSON.stringify(canonical(pathway))).digest('hex'); }

/** The question-row shape the evidence layer hashes. Used for dry-run seeding only. */
export function questionRow(source, item) {
  const options = (item.options || []).map((o, i) => ({ key: 'ABCD'[i], text: typeof o === 'string' ? o : o.text }));
  return { id: item.questionId, subject: source.subject, chapter: source.chapter, concept_id: source.id, body: item.prompt, options,
    correct_answer: item.type === 'choice' ? 'ABCD'[item.answer] : String(item.answer), explanation: '', family_id: item.familyId };
}

/** Engine pathway: no claims, scenarios or authoring notes; plain option strings; hashed items. */
export function buildEnginePathway(source) {
  const strip = item => {
    const { scenario: _s, shareCheck: _c, boundary: _b, partner: _p, ...rest } = item;
    const out = { ...rest, ...(item.options ? { options: item.options.map(o => typeof o === 'string' ? o : o.text) } : {}) };
    return { ...out, contentHash: contentHash(questionRow(source, out)) };
  };
  return { id: source.id, subject: source.subject, title: source.title, version: source.version, sourceVersion: source.sourceVersion, ruleVersion: source.ruleVersion,
    state: source.state, hypotheses: source.hypotheses, noGapHypothesis: source.noGapHypothesis, explanation: source.explanation, workedContrast: source.workedContrast,
    explanations: source.explanations, contrasts: source.contrasts, probes: source.probes.map(strip), repair: source.repair.map(strip),
    repairPaths: source.repairPaths, checks: source.checks.map(strip) };
}

export function checkPathwayContent(source) {
  const results = []; const record = (id, passed, detail, item) => results.push({ id, passed: Boolean(passed), ...(item ? { item } : {}), detail });
  const items = [...source.probes, ...source.repair, ...source.checks];
  try { validatePathway({ ...buildEnginePathway(source), state: 'released' }); record('engine_contract', true, 'Engine validation passed with released-state solver checks.'); }
  catch (error) { record('engine_contract', false, error.message); }

  for (const item of items) {
    if (item.type === 'numeric_step') {
      let solved = null; try { solved = solveReasoningStep(item.solver); } catch (error) { record('solver_key', false, error.message, item.id); }
      if (solved !== null) record('solver_key', Math.abs(solved - item.answer) <= 1e-9, `solver ${solved} vs key ${item.answer}`, item.id);
      if (item.scenario && item.partner) {
        const m = movement(item.scenario)[item.partner]; const signed = item.solver.kind === 'gaining_ratio' ? -m[0] / m[1] : m[0] / m[1];
        record('scenario_key', Math.abs(signed - item.answer) <= 1e-9, `ratio scenario gives ${signed} for ${item.partner}`, item.id);
        record('solver_inputs_match_scenario', Math.abs(sharesOf(item.scenario.old)[item.partner][0] / sharesOf(item.scenario.old)[item.partner][1] - item.solver.oldShare) < 1e-9
          && Math.abs(sharesOf(item.scenario.new)[item.partner][0] / sharesOf(item.scenario.new)[item.partner][1] - item.solver.newShare) < 1e-9, 'solver inputs equal scenario shares', item.id);
      }
    }
    if (item.shareCheck) {
      const change = sub(frac(...item.shareCheck.old), frac(...item.shareCheck.new));
      const verbOk = item.shareCheck.verb === (change[0] >= 0 ? 'sacrifice' : 'gain');
      record('share_check', verbOk && eq(frac(Math.abs(change[0]), change[1]), frac(...item.shareCheck.amount)), `old − new = ${show(change)}`, item.id);
    }
    if (item.type !== 'choice') continue;
    const texts = item.options.map(o => typeof o === 'string' ? o : o.text);
    record('distinct_options', new Set(texts).size === texts.length, 'option texts are distinct', item.id);
    if (!item.scenario) { record('definition_item_needs_review', true, 'No scenario: keyed by authored definition; listed for academic review.', item.id); continue; }
    if (item.scenario.derive) {
      const d = derivedShares(item.scenario), n = sharesOf(item.scenario.new);
      record('derived_ratio', Object.keys(n).every(p => d[p] && eq(d[p], n[p])) && Object.keys(d).length === Object.keys(n).length, 'stated new ratio follows from the described admission', item.id);
    }
    const secureMatches = item.options.map((o, i) => o.claim && claimMatches(o.claim, simulate('secure', item.scenario), item.scenario) ? i : -1).filter(i => i >= 0);
    record('unique_key', secureMatches.length === 1 && secureMatches[0] === item.answer, `options equal to the correct working: [${secureMatches}] key ${item.answer}`, item.id);
    item.options.forEach((o, i) => record('text_carries_claim', o.claim && textCarriesClaim(o.text, item.prompt, o.claim), `option ${i}`, item.id));
    if (item.matrix) {
      const mapped = new Set();
      for (const h of source.hypotheses) {
        const sim = simulate(h, item.scenario);
        const expected = item.options.map((o, i) => claimMatches(o.claim, sim, item.scenario) ? i : -1).filter(i => i >= 0);
        expected.forEach(i => mapped.add(i));
        record('matrix_cell', JSON.stringify(expected) === JSON.stringify([...(item.matrix[h] || [])].sort()), `${h}: computed [${expected}] authored [${item.matrix[h] || []}]`, item.id);
      }
      record('every_option_diagnostic', mapped.size === item.options.length, `${mapped.size}/${item.options.length} options map to a hypothesis`, item.id);
      const separated = new Set(source.hypotheses.map(h => JSON.stringify(item.matrix[h]))).size === source.hypotheses.length;
      record('probe_separates_all', separated, 'each hypothesis predicts a different option', item.id);
    }
  }

  const families = new Set(items.map(i => i.familyId));
  const checkFamilies = source.checks.map(c => c.familyId);
  record('family_count', families.size >= 6, `${families.size} distinct families (minimum 6)`);
  record('check_families_unique', new Set(checkFamilies).size === checkFamilies.length && !checkFamilies.some(f => [...source.probes, ...source.repair].some(i => i.familyId === f)), 'checks use unique families disjoint from probes and repair');
  record('check_reserve', source.checks.length >= 6, `${source.checks.length} checks: immediate, two delayed, maintenance and failure reserves`);
  const signatures = items.filter(i => i.scenario).map(i => JSON.stringify([i.scenario.type, Object.values(i.scenario.old), Object.values(i.scenario.new)]));
  record('no_isomorphic_scenarios', new Set(signatures).size === signatures.length, `${signatures.length} scenarios, ${new Set(signatures).size} distinct`);
  record('boundary_old_ratio_valid', source.checks.some(c => c.boundary === 'old_ratio_is_correct'), 'a check guards against overcorrecting into "never the old ratio"');
  record('boundary_unaffected_partner', source.checks.some(c => c.boundary === 'partner_unaffected'), 'a check includes a partner whose share does not change');
  record('key_positions_vary', new Set(source.checks.map(c => c.answer)).size >= 3, `check keys at positions ${source.checks.map(c => c.answer)}`);
  record('repair_paths_complete', ['general', ...source.hypotheses].every(h => source.repairPaths?.[h]?.length && source.repairPaths[h].every(id => source.repair.some(r => r.id === id))), 'a repair path for every hypothesis and the general fallback');
  record('explanations_complete', ['general', ...source.hypotheses].every(h => source.explanations?.[h] && source.contrasts?.[h]), 'an explanation and worked contrast for every hypothesis');
  record('source_refs', Array.isArray(source.sourceRefs) && source.sourceRefs.length > 0 && source.sourceRefs.every(s => /^[0-9a-f]{64}$/.test(s.sha256) && s.locator && s.url && s.retrievedAt), 'versioned, hashed syllabus locator');
  record('permission', source.authoring?.permission === 'owned_original', 'original wording owned by MockMob; no third-party text reproduced');
  const failed = results.filter(r => !r.passed);
  return { pathwayId: source.id, version: source.version, passed: failed.length === 0, total: results.length, failed: failed.length, results,
    reviewItems: items.filter(i => i.type === 'choice' && !i.scenario).map(i => i.id) };
}
