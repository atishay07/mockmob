import React from 'react';

// A static, server-rendered example of what Radar returns after a mock.
// The numbers are illustrative and labelled as such — the product's real
// readout is built from the visitor's own attempts.
const ROWS = [
  { chapter: 'Partnership · Retirement', subject: 'Accountancy', accuracy: 38, pace: 'slow' },
  { chapter: 'Money and Banking', subject: 'Economics', accuracy: 52, pace: 'ok' },
  { chapter: 'Reading Comprehension', subject: 'English', accuracy: 61, pace: 'slow' },
  { chapter: 'Cash Flow Statement', subject: 'Accountancy', accuracy: 84, pace: 'fast' },
];

export function ChapterReadout() {
  return (
    <figure className="mm-screen mm-readout">
      <div className="mm-screen__bar">
        Radar · after one full mock
        <span className="mm-readout__badge">Example</span>
      </div>
      <div className="mm-screen__body">
        <p className="mm-readout__verdict">
          Fix <strong>Partnership · Retirement</strong> first. It is costing more marks than the
          next two combined.
        </p>
        <ul className="mm-readout__rows">
          {ROWS.map((row) => (
            <li key={row.chapter} className="mm-readout__row">
              <span className="mm-readout__chapter">
                {row.chapter}
                <span className="mm-readout__subject">{row.subject}</span>
              </span>
              <span className="mm-readout__bar" aria-hidden="true">
                <span
                  className="mm-readout__fill"
                  data-band={row.accuracy < 50 ? 'low' : row.accuracy < 70 ? 'mid' : 'high'}
                  style={{ width: `${row.accuracy}%` }}
                />
              </span>
              <span className="mm-readout__pct mm-measure">{row.accuracy}%</span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mm-readout__caption">
        Illustrative readout. Yours is built only from questions you actually attempt.
      </figcaption>
    </figure>
  );
}
