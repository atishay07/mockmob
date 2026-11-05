// What a feature-tour screen shows (R3-D5, LK105, 5 Nov 2026). Pure, so the rule is tested without React.
//
// Every screen keeps its demo as { epoch, value }: `value` is the demo's current frame and `epoch` the activation it
// belongs to. ScrollStory counts every step change (its transition state carries { step, seq }), and the tour hands the
// screen on stage that count as its activation epoch. So a screen coming on stage shows its FIRST frame until its own
// playback has spoken for this activation, in the same render that brings it on stage, without a render-phase setState
// (the old reset ran during the startTransition render, and a parked settle update rebased it to the finished screen:
// 0, then finished, then 0 again, mid-fade).
//
//   reduced motion              finished (no demo)
//   on stage, playing           this activation's frame, or the first frame until the playback speaks
//   held tour, off stage        frozen where it was: never settled, so a leaving screen does not pop to finished
//   paused (Pause, keyboard)    frozen where it was
//   carousel (unheld), off      finished (an unheld screen is remounted each time it comes on, see FeatureTour)
export function shownValue({ held, active, reduced, paused, epoch, state, first, settled }) {
  if (reduced) return settled;
  if (active && !paused) return state.epoch === epoch ? state.value : first;
  if (!active && !held) return settled;
  return state.value;
}

/** The state a screen starts with: its first frame when it will play at once, otherwise finished. */
export function firstState({ active, reduced, paused, epoch, first, settled }) {
  return { epoch, value: active && !reduced && !paused ? first : settled };
}
