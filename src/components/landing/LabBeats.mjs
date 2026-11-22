// The Mistake Lab's beat lines (look="next", LK368, 22 Nov 2026 night). One plain line a beat under each scene's title, the
// way the Ask Mobi story explains each step (owner: one idea a beat, a plain line that explains it): beat 0 says what the
// card is as it stands, beats 1 and 2 say what the cursor's two taps just showed. LabCinema draws the three lines in one cell;
// the scene's data-beat (written by the tapped control, LabNextScreens `beat`) picks the one shown, so a beat costs no render.
// Each line is one line on a 360 px phone (40 characters or fewer, held by lab_next_1121.test.mjs). Figures come from
// labStory, never typed.
import { labStory, GAP, REPAIR, repairRecordLine } from './labStory.mjs';

const S = labStory();
const repairChanged = Boolean(repairRecordLine());
const turned = S.changes.find((c) => c.net < 0 && c.fromVerdict === 'right');

export const LAB_BEATS = Object.freeze({
  chapters: Object.freeze([
    'Every lost mark, traced to its chapter.',
    'Tap a question to see how it went wrong.',
    `A question left blank still costs ${GAP.blank} marks.`,
  ]),
  time: Object.freeze([
    `Slowest first, against the ${S.pace} pace.`,
    'Over the pace, and still wrong.',
    'Some slow answers were still right.',
  ]),
  changes: Object.freeze([
    'Every switch, and what it won or cost.',
    turned ? `Q${turned.n} was right before you changed it.` : 'What each switch did to your marks.',
    S.gainedCount === 1 ? 'Only one change found the key.' : `${S.gainedCount} changes found the key.`,
  ]),
  repair: Object.freeze([
    'Why your pick tempted you, and the rule.',
    repairChanged ? 'You had it right, then changed it.' : `Your pick was ${REPAIR.picked}. The key is ${REPAIR.key}.`,
    'Written from the official key only.',
  ]),
  swot: Object.freeze([
    'A plan after every mock. Free, no credits.',
    'What cost you marks this time.',
    'What to watch in your next mock.',
  ]),
});
