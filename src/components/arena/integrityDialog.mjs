// The NTA warning dialog is a native modal <dialog>. Its `cancel` event is blocked, but Android's Back button is a close
// request, and Chrome closes a modal on the second such request even when `cancel` was blocked (the browser's guard against
// pages that trap Back). The dialog then closes while the warning is still set: nothing is on screen, and answers stay locked
// until the student resumes, with no way to resume. A warning leaves only through Resume, so a close that happens while the
// warning is still set puts the dialog straight back. The paper's own Back guard (TestPageClient) keeps the history entry.
// Not once the session has ended ('terminated'): answering is locked there anyway, and when the submission cannot finish (signed
// out in another tab) the closed dialog is the student's only way back to the page's Leave sheet and sign-in line.
export function shouldReopenIntegrityDialog({ alert, open }) {
  return Boolean(alert) && alert.phase !== 'terminated' && !open;
}
