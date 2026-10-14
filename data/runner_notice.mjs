// What the test screen tells the student about saving and submitting, and when.
//
// Nothing is shown while everything is fine except a quiet save state beside the submit
// control. A toast appears only when the student has to do something (get back online) or should
// know an action is waiting. The toast comes from the shared notice rules (notice_rules.mjs), so
// the test screen follows the same copy rules and the same one-notice-at-a-time choice as the rest
// of the site. All copy is plain and says what to do.
import { chooseNotice, runnerNotices } from './notice_rules.mjs';

/**
 * @param {{pendingSubmission?: boolean, online?: boolean, syncStatus?: string, hasTicket?: boolean}} input
 * @returns {{banner: {tone: 'warn', text: string} | null, save: {tone: 'ok' | 'warn', text: string}}}
 */
export function runnerNotice({ pendingSubmission = false, online = true, syncStatus = 'saved', hasTicket = false } = {}) {
  const state = { pendingSubmission, online, syncStatus, hasTicket };
  const shown = chooseNotice(runnerNotices(state), { surface: 'runner' });
  const banner = shown ? { tone: shown.tone, text: shown.text } : null;
  if (pendingSubmission) return { banner, save: { tone: 'warn', text: 'Waiting to submit' } };
  if (!online) return { banner, save: { tone: 'warn', text: 'Offline. Reconnect to submit' } };
  if (!hasTicket && syncStatus === 'pending') return { banner, save: { tone: 'warn', text: 'Syncing your answers' } };
  return { banner, save: { tone: 'ok', text: hasTicket ? 'Answers saved on this device' : 'Answers saved to your account' } };
}
