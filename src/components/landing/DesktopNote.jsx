// The first-visit note on a phone (owner LK320, 18 Nov 2026: "Small pop-up ... first time someone visit the website. There
// should be a static pop-up on switch to desktop or basically anything like that ... and just a small cross to remove it").
//
// One quiet strip at the top of the home page, phones only: a monitor, one sentence, a small cross. Static: it does not
// slide, fade or pulse.
//  - It is in the server's HTML and shown by an attribute a tiny inline script sets on <html> BEFORE the first paint
//    (deskNoteGate), so the page never jumps to make room for it (an effect-driven note shifted the whole hero; measured
//    19 Nov 2026, layout shift 0.05).
//  - First visit: it shows on every load for the first 30 minutes after the first one, or until the cross is pressed.
//    After that it never shows on this device again. Signed-in students never see it.
//  - Without script, or where storage is blocked, it stays hidden (it is a tip, not content).
import { Monitor } from 'lucide-react';
import { DesktopNoteClose } from './DesktopNoteClose';
import { DESK_NOTE_KEY, DESK_NOTE_WORDS, deskNoteScript } from './desktopNoteGate.mjs';

export { DESK_NOTE_KEY };

export function DesktopNote() {
  return (
    <>
      <script id="mm-desk-note-gate" dangerouslySetInnerHTML={{ __html: deskNoteScript() }} />
      <aside className="lp-desk-note" role="note" aria-label="Tip">
        <Monitor size={17} strokeWidth={2} aria-hidden="true" />
        <span>{DESK_NOTE_WORDS}</span>
        <DesktopNoteClose />
      </aside>
    </>
  );
}
