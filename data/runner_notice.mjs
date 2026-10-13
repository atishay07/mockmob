// What the test screen tells the student about saving and submitting, and when.
//
// Nothing is shown while everything is fine except a quiet save state beside the submit
// control. A strip across the top appears only when the student has to do something (get back
// online) or should know an action is waiting. All copy is plain and says what to do.

/**
 * @param {{pendingSubmission?: boolean, online?: boolean, syncStatus?: string, hasTicket?: boolean}} input
 * @returns {{banner: {tone: 'warn', text: string} | null, save: {tone: 'ok' | 'warn', text: string}}}
 */
export function runnerNotice({ pendingSubmission = false, online = true, syncStatus = 'saved', hasTicket = false } = {}) {
  if (pendingSubmission) {
    return {
      banner: { tone: 'warn', text: 'Not submitted yet. Your answers are safe on this device. Reconnect soon: they send on their own while the submission window is open.' },
      save: { tone: 'warn', text: 'Waiting to submit' },
    };
  }
  if (!online) {
    return {
      banner: { tone: 'warn', text: 'You are offline. Keep answering: answers stay on this device and the timer keeps running. Reconnect before you submit.' },
      save: { tone: 'warn', text: 'Offline. Reconnect to submit' },
    };
  }
  if (!hasTicket && syncStatus === 'pending') {
    return {
      banner: { tone: 'warn', text: 'Reconnecting. Your answers are kept on this device until they sync.' },
      save: { tone: 'warn', text: 'Syncing your answers' },
    };
  }
  return { banner: null, save: { tone: 'ok', text: hasTicket ? 'Answers saved on this device' : 'Answers saved to your account' } };
}

/**
 * A note for the result page, only for sessions drawn from the practice bank that has not been
 * fully checked yet. It says what to do about a doubtful key rather than apologising up front.
 */
export function resultContentNote(selectionMeta) {
  if (selectionMeta?.contentEvidence !== 'legacy_bank') return null;
  return 'These questions come from our practice bank, which we are still checking. If an answer key looks wrong, use “Report a problem” on that question.';
}
