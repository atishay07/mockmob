// Mobi's written answer, laid out for reading (16 Nov 2026). PURE: text in, blocks out; the thread draws them as React text
// nodes, never as HTML, so nothing in a reply can become markup.
//
// A reply is plain text: paragraphs apart by a blank line, steps and sums on their own lines. This reads only what is plainly
// there: a short line that ends with a colon (or is wrapped in **) is a heading, lines that start "1." or "-" are a list, and
// everything else is a paragraph that keeps its own line breaks, so a worked sum stays lined up.

const STEP = /^\s*(\d{1,2})[.)]\s+(\S.*)$/;
const BULLET = /^\s*[-•*]\s+(\S.*)$/;
const BOLD_LINE = /^\*\*(.+?)\*\*:?$/;

/** "**Step 1** then" -> [{ text: 'Step 1', bold: true }, { text: ' then', bold: false }]. Unpaired stars stay as typed. */
export function inlineParts(line) {
  const text = String(line ?? '');
  const out = [];
  const re = /\*\*([^*\n]+?)\*\*/g;
  let at = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), bold: false });
  return out.length ? out : [{ text, bold: false }];
}

const isHeading = (lines) => lines.length === 1 && (BOLD_LINE.test(lines[0].trim()) || (/:$/.test(lines[0].trim()) && lines[0].trim().length <= 60 && !/[.?!]\s/.test(lines[0])));

/**
 * -> [{ type: 'h', text } | { type: 'p', lines: [string] } | { type: 'ol', start, items: [string] } | { type: 'ul', items: [string] }]
 * A paragraph whose lines mix prose and steps is split where the kind of line changes, in the order written.
 */
export function proseBlocks(reply) {
  const text = String(reply ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) return [];
  const blocks = [];
  for (const para of text.split(/\n{2,}/)) {
    const lines = para.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    if (!lines.length) continue;
    if (isHeading(lines)) {
      const bold = BOLD_LINE.exec(lines[0].trim());
      blocks.push({ type: 'h', text: bold ? bold[1] : lines[0].trim() });
      continue;
    }
    let run = null;
    const flush = () => { if (run) blocks.push(run); run = null; };
    for (const line of lines) {
      const step = STEP.exec(line);
      const bullet = step ? null : BULLET.exec(line);
      if (step) {
        if (run?.type !== 'ol') { flush(); run = { type: 'ol', start: Number(step[1]), items: [] }; }
        run.items.push(step[2]);
      } else if (bullet) {
        if (run?.type !== 'ul') { flush(); run = { type: 'ul', items: [] }; }
        run.items.push(bullet[1]);
      } else {
        if (run?.type !== 'p') { flush(); run = { type: 'p', lines: [] }; }
        run.lines.push(line);
      }
    }
    flush();
  }
  return blocks;
}
