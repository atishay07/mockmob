// The Ask Mobi row story of the home page's one-place frame (owner LK365, 21 Nov 2026: "this Ask Mobi screen has no
// description of what's happening ... how to fix this would be an animation showing a student scanning their coaching paper
// or school test and uploading it. Then it scans the question, stuff happens, and it explains the entire flow").
// Pure data, node-testable (data/tests/story_mobi_1121.test.mjs). MobiStory.jsx is the screen these steps work; every target
// is a data-demo hook it carries. The steps follow CursorDemo's shape (demo/CursorDemo.jsx): `say` is the line the frame
// shows for the beat, `focus` the part of the screen the beat is about.
//
// Five beats, in the order a student does it (critic round, 21 Nov 2026 evening: "It names the chapter and finds your slip"
// stood 2.2 s over the densest screen of the section, and the scan showed in 2 of 6 frames; now one idea a beat, and the
// scan has a whole beat to itself):
//   1  Photo     the coaching sheet in the camera; the shutter (mobi-shoot), then Send (mobi-send). Typed: the field.
//   2  Read      the scan sweeps the whole page as the line stands, lighting each line it reads (MOBI_TIMING.scan).
//   3  Chapter   the page goes into the chat, and the CUET chapter chip arrives lit: the beat's subject.
//   4  Slip      Mobi's read arrives (MOBI_TIMING.read): its working lines one by one, then the slip, circled.
//   5  Check     "Now check you have it" (mobi-tocheck), the right option (mobi-option), then "Then practise"
//                (mobi-topractice): the 10 from the bank are dealt. The practice key itself is a link: never clicked.
// Timing: MOBI_TIMING is what the component does by itself after Send (the scan, then the chat, then the read), so the
// script's waits and the screen's own clock agree; the test holds them together. The script runs 13 s (onePlaceModel
// ROW_MAX_MS).
import { BRING_MISTAKE as W } from '../bringMistakeCopy.mjs';
import { practiceHref } from '../../../lib/paper/problems.mjs';

/** What the screen does by itself after Send, ms: the scan (or "reading your question"), the chat with its chips, the read. */
export const MOBI_TIMING = Object.freeze({ scan: 2200, read: 4500 });

// The fresh question's right option (bringMistakeCopy.mjs check.correct, 0-based), as a CSS position among its siblings.
const RIGHT = W.check.correct + 1;

/** Beat 5's line, from the practice set's own count (bringMistakeCopy.mjs practice.count = FIRST_SET_COUNT). */
export const practiceLine = (count = W.practice.count) => `Check it on a fresh one, then ${count} more from the bank.`;

/** The example's subject (data/subjects.js id of W.slip.subject). */
export const MOBI_SUBJECT = Object.freeze({ id: 'accountancy', name: W.slip.subject });

/**
 * The practice key the read ends on, as the app makes it (src/services/mobi/bringMistake.mjs nextStep, held equal by the test):
 * "Practise 10 <chapter> questions", to Practice on that chapter. The screen sends a guest to sign up first.
 */
export const MOBI_PRACTICE = Object.freeze({
  label: `Practise ${W.practice.count} ${W.read.chapter} questions`,
  href: practiceHref({ subject: MOBI_SUBJECT.id, mode: 'quick', count: W.practice.count, chapter: W.read.chapter }),
});

export const MOBI_SAYS = Object.freeze({
  photo: Object.freeze([
    'Photograph the question you got wrong.',
    'Mobi reads the page.',
    'It names the chapter.',
    'And finds where you slipped.',
    practiceLine(),
  ]),
  typed: Object.freeze([
    'Type the question you got wrong.',
    'Mobi reads the question.',
    'It names the chapter.',
    'And finds where you slipped.',
    practiceLine(),
  ]),
});

const click = (target, move, dwell, more = {}) => Object.freeze({ target, move, dwell, click: true, ...more });

/** The steps for the screen with the photo switch on (data/mistake_photo.mjs) or off. */
export function mobiSteps(photo = true) {
  const says = photo ? MOBI_SAYS.photo : MOBI_SAYS.typed;
  const question = photo ? '.st-mobi__finder' : '.st-mobi__compose';
  return Object.freeze([
    // 1. The question: the sheet in the camera, the shutter, then Send (or the field, where the question is typed).
    Object.freeze({ say: says[0], focus: question, wait: 590 }),
    photo
      ? click('[data-demo="mobi-shoot"]', 520, 420)
      : click('[data-demo="mobi-type"]', 520, 420, { at: [0.3, 0.4] }),
    click('[data-demo="mobi-send"]', 420, 0),
    // 2. The scan sweeps the whole page while the line stands (the screen's own clock: MOBI_TIMING.scan).
    Object.freeze({ say: says[1], focus: question, wait: MOBI_TIMING.scan }),
    // 3. The page goes into the chat; the CUET chapter chip arrives, lit. It is the beat's one subject.
    Object.freeze({ say: says[2], focus: '.st-mobi__chip--volt', wait: MOBI_TIMING.read - MOBI_TIMING.scan }),
    // 4. The read arrives (MOBI_TIMING.read): the working lines one by one, then the slip, circled in pen.
    Object.freeze({ say: says[3], focus: '.st-mobi__slip', wait: 2250 }),
    // 5. The fresh question and its right option; then the practice set from the bank is dealt. The cursor leaves the
    // practice key alone (it is a link to sign up).
    Object.freeze({ say: says[4], focus: '.st-mobi__card--read .st-mobi__next', wait: 500 }),
    click('[data-demo="mobi-tocheck"]', 380, 250),
    click(`[data-demo="mobi-option"]:nth-child(${RIGHT})`, 400, 550, { at: [0.35, 0.5], focus: '.st-mobi__check' }),
    click('[data-demo="mobi-topractice"]', 320, 0, { focus: null }),
    Object.freeze({ focus: '.st-mobi__practice', wait: 550 }),
  ]);
}

export const MOBI_STORY = Object.freeze({ id: 'mobi', title: W.h2, steps: mobiSteps(true) });
export const MOBI_STORY_TYPED = Object.freeze({ id: 'mobi', title: W.h2, steps: mobiSteps(false) });
/** The story for the app's photo switch (page.js passes MISTAKE_PHOTO_ON as `photo`). */
export const mobiStory = (photo = true) => (photo ? MOBI_STORY : MOBI_STORY_TYPED);
