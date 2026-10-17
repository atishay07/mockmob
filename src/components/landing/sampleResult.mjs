// What the landing's five-question sample says when it is finished (DemoDrill.jsx). Plain module, tested in
// sampleBank.test.mjs.
//
// The bank labels a question 'Chapter: topic' ('Partnership: admission of a partner'), so the finished screen lists
// each missed chapter once, with one readable topic under it.
export function groupMissed(list) {
  const groups = new Map();
  for (const label of list) {
    const cut = label.indexOf(': ');
    const chapter = cut > 0 ? label.slice(0, cut) : label;
    const topic = cut > 0 ? label.slice(cut + 2) : '';
    if (!groups.has(chapter)) groups.set(chapter, { chapter, misses: 0, topic: '' });
    const group = groups.get(chapter);
    group.misses += 1;
    if (!group.topic && topic) group.topic = `${topic[0].toUpperCase()}${topic.slice(1)}`;
  }
  return [...groups.values()];
}

// Five questions name a chapter only when it holds the most misses outright and at least two of them: one miss, or
// a tie (three misses in three chapters), says nothing about which chapter to fix, so the move is then a Full mock.
export const FOCUS_MIN_MISSES = 2;
export function nextChapter(groups) {
  const sorted = [...groups].sort((a, b) => b.misses - a.misses);
  const [top, second] = sorted;
  if (!top || top.misses < FOCUS_MIN_MISSES) return null;
  if (second && second.misses === top.misses) return null;
  return top.chapter;
}

/** The finished sample's one next move, in the words the card prints. */
export function sampleMove(missed) {
  const groups = groupMissed(missed);
  const focus = nextChapter(groups);
  const total = missed.length;
  if (focus) {
    const misses = groups.find((g) => g.chapter === focus).misses;
    return { focus, groups, text: `10 questions on ${focus}, where ${misses} of your ${total} misses came from. On Free, that set uses 10 of the 100 practice credits you start with.` };
  }
  return { focus: null, groups, text: 'a Full mock of 50 questions, to see which chapter to fix first. On Free, it uses 50 of the 100 practice credits you start with.' };
}
