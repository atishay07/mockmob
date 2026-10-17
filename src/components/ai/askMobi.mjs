// Ask Mobi, opened in place (N9, 17 Oct night). Any control in the arena can open the Ask Mobi panel over the page it is
// on, instead of sending the student to /mentor: the Help door, a repair's "Ask Mobi about Q3", Weak chapters. The arena
// shell mounts the host (AskMobiHost.jsx), which answers this event; where no host is mounted (a public page, the timed
// runner) nothing answers, and the caller follows its plain link instead. Pure, so a test can hold the contract.

export const ASK_MOBI_EVENT = 'mockmob:ask-mobi';
export const ASK_MOBI_TABS = Object.freeze(['plan', 'record', 'ask', 'tools']);

const QUESTION_REF = /^[A-Za-z0-9_-]{1,80}:[A-Za-z0-9_-]{1,80}$/;

/** "/mentor?tab=ask&q=<attempt>:<question>" (the repair's link) to what the panel opens on. Anything else is ignored. */
export function askRequestFromHref(href) {
  if (typeof href !== 'string' || !href.startsWith('/mentor')) return null;
  let url;
  try { url = new URL(href, 'https://mockmob.invalid'); } catch { return null; }
  if (url.pathname !== '/mentor') return null;
  const tab = ASK_MOBI_TABS.includes(url.searchParams.get('tab')) ? url.searchParams.get('tab') : 'plan';
  const q = url.searchParams.get('q');
  const questionRef = q && QUESTION_REF.test(q) ? q : null;
  return { tab: questionRef ? 'ask' : tab, questionRef };
}

/** The point the panel grows from: the centre of the control that opened it. */
export function originOf(element) {
  const rect = element?.getBoundingClientRect?.();
  if (!rect || !rect.width) return null;
  return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
}

/**
 * Asks the arena shell to open Ask Mobi. Returns true when a host took it (the caller then stays put), false when
 * none is mounted (the caller navigates as before).
 */
export function openAskMobi({ tab = 'plan', questionRef = null, from = null } = {}, target = globalThis.window) {
  if (!target?.dispatchEvent || typeof CustomEvent !== 'function') return false;
  const event = new CustomEvent(ASK_MOBI_EVENT, {
    cancelable: true,
    detail: { tab: ASK_MOBI_TABS.includes(tab) ? tab : 'plan', questionRef: questionRef && QUESTION_REF.test(questionRef) ? questionRef : null, origin: originOf(from) },
  });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

/** A plain click on a link (no new tab, no modifier) may be taken over; anything else keeps the browser's behaviour. */
export const isPlainClick = (event) => !(event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
