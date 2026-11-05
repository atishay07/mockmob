// The brand's own texture (round 4, owner LK117/LK120, 5 Nov 2026: "some sort of texture ... in the background, like we had
// previously ... in black mode the black space is even more significant"): an answer sheet, the OMR bubble field CUET is
// marked on and the one pinned on the wall of Mobi's room, never a generic grid, dot matrix or glow (research brandloss B10,
// R3-D2). Columns of numbered questions, four oval bubbles a question (A to D), one pencil mark a row, drawn in the page's
// hairline colour; the desk lamp's light decides where it shows (brand-texture.css): strongest around the desk, falling off
// toward the words and the section's edge, stronger in Night than in Day. Neutral in both themes, never volt; it does not
// move; hidden from assistive technology. Server-drawn, one small SVG pattern, no image file.
//
//   <BrandTexture variant="hero" />      behind the home hero (its section is the positioned, isolated parent)
//   <BrandTexture variant="section" />   behind a key section (a quiet band at its edges; the section sets the same parent rules)

import '@/app/brand-texture.css';

// The pencil marks, by row: which of the four options is filled. Fixed, so the server and every visit draw the same sheet.
const MARKS = [1, 3, 0, 2, 2, 0, 3, 1, 0, 2];
const ROWS = MARKS.length;
const RX = 7;
const RY = 5.25;
const STEP_X = 19;
const STEP_Y = 19;
// A question: its number, then its four bubbles. Two columns of questions a tile, the way a printed sheet runs them.
const NUM_W = 20;
const COL_W = NUM_W + STEP_X * 3 + RX * 2 + 34;
const TILE_W = COL_W * 2;
const TILE_H = STEP_Y * ROWS + 22;

export function BrandTexture({ variant = 'hero', id }) {
  const pattern = id || `mm-omr-${variant}`;
  return (
    <svg className={`mm-texture mm-texture--${variant}`} aria-hidden="true" focusable="false" width="100%" height="100%">
      <defs>
        <pattern id={pattern} width={TILE_W} height={TILE_H} patternUnits="userSpaceOnUse">
          {[0, 1].map((col) => MARKS.map((mark, row) => {
            // The second column's marks run in a different order, so the field never reads as one stamped tile.
            const filled = col === 0 ? mark : MARKS[(row + 4) % ROWS];
            const x = col * COL_W;
            const y = 14 + row * STEP_Y;
            return (
              <g key={`${col}-${row}`}>
                <text x={x + NUM_W - 6} y={y + 3} textAnchor="end" className="mm-texture__num">{col * ROWS + row + 1}</text>
                {[0, 1, 2, 3].map((option) => (
                  <ellipse
                    key={option}
                    cx={x + NUM_W + RX + option * STEP_X}
                    cy={y}
                    rx={RX}
                    ry={RY}
                    className={option === filled ? 'mm-texture__mark' : 'mm-texture__ring'}
                  />
                ))}
              </g>
            );
          }))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pattern})`} />
    </svg>
  );
}

export default BrandTexture;
