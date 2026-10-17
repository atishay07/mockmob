// The held story's optional rows (ScrollStory fitAll, data-ss-drop). A screen short of room sets its optional rows
// aside, lowest number first and equal numbers together, until it fits at full size; only then may it be scaled.
// Pure, so node --test can check the order without a browser.
//
//   setAsideUntilFit(rows, { rank, setAside, fits }) -> the ranks that were set aside
//     rows      the optional rows, in any order
//     rank      row -> its number (data-ss-drop)
//     setAside  row -> void, takes the row out of the layout
//     fits      () -> true once the screen fits its room
export function setAsideUntilFit(rows, { rank, setAside, fits }) {
  const done = [];
  const ranks = [...new Set(rows.map(rank))].filter(Number.isFinite).sort((a, b) => a - b);
  for (const r of ranks) {
    if (fits()) break;
    rows.forEach((row) => { if (rank(row) === r) setAside(row); });
    done.push(r);
  }
  return done;
}
