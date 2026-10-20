// The Pro page's pictures (/pricing, version 16, owner 20 Oct 11:20 pm: "built like how it is on the app"). Each one mirrors the
// app's Pro page (flutter_app/lib/features/billing/widgets/pro_page.dart ProHeroArt, pro_showcase.dart): the foil seal on a dotted
// answer sheet under a desk lamp, the fanned papers, the plain and smart sets, and the exam-day screen. Drawn in CSS and markup
// (src/app/pricing/pro-page.css); the only rasters are the small foil seal and the "Also in Pro" objects. Every picture is an
// illustration, hidden from assistive technology: the words beside it say the same thing. Server components, no state.

// The answer sheet behind the seal: 4 columns by 8 rows, the volt dots where the app draws them.
const SHEET_FILLED = new Set([0, 9, 13, 18, 22, 29, 30]);

/** The hero art: lamp light, the dotted answer sheet, the foil seal, and the "MockMob Pro" label under it. */
export function ProHeroArt({ label }) {
  return (
    <div className="pro-art">
      <div className="pro-art__scene" aria-hidden="true">
        <span className="pro-art__lamp" />
        <span className="pro-art__sheet">
          <span className="pro-art__rule" />
          <span className="pro-art__dots">
            {Array.from({ length: 32 }, (_, i) => <i key={i} data-on={SHEET_FILLED.has(i) ? '' : undefined} />)}
          </span>
        </span>
        <span className="pro-art__seal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/pro/foil-seal.webp" alt="" width={320} height={315} decoding="async" fetchPriority="high" />
        </span>
      </div>
      <p className="pro-chip"><span className="pro-chip__dot" aria-hidden="true" />{label}</p>
    </div>
  );
}

// One sheet of the fan: a header rule and a 3 by 5 grid of answer circles; `marks` are the circles shaded in.
const FAN = [
  { tilt: -14, marks: [3, 7, 11] },
  { tilt: -6, marks: [4, 9, 12] },
  { tilt: 3, marks: [5, 10, 14] },
  { tilt: 12, marks: [0, 4, 6, 9, 13], lit: true },
];

/** Unlimited mocks: four answer sheets fanned out, the newest lit, under the "A new paper every time" badge. */
export function PapersArt({ badge }) {
  return (
    <div className="pro-show__art pro-papers">
      <p className="pro-badge">{badge}</p>
      <div className="pro-papers__fan" aria-hidden="true">
        {FAN.map((sheet, n) => (
          <span key={n} className="pro-papers__sheet" style={{ '--tilt': `${sheet.tilt}deg`, '--n': n }} data-lit={sheet.lit ? '' : undefined}>
            <span className="pro-papers__rule" />
            <span className="pro-papers__dots">
              {Array.from({ length: 15 }, (_, i) => <i key={i} data-on={sheet.marks.includes(i) ? '' : undefined} />)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

const SMART_ROWS = [
  { chapter: 'Ratio analysis', missed: true, smart: 100 },
  { chapter: 'Cash flow', missed: true, smart: 80 },
  { chapter: 'Partnership', missed: false, smart: 40 },
  { chapter: 'Share capital', missed: false, smart: 30 },
];

/** Smart practice: the same four chapters in a plain set and a smart set, the smart set leaning toward the missed ones. */
export function SmartArt({ plain, smart, legend, caption }) {
  return (
    <figure className="pro-smart">
      <div className="pro-show__art pro-smart__art" aria-hidden="true">
        <div className="pro-smart__grid">
          <span />
          <span className="pro-smart__head">{plain}</span>
          <span className="pro-smart__head" data-smart="">{smart}</span>
          {SMART_ROWS.map((row) => (
            <div key={row.chapter} className="pro-smart__row">
              <span className="pro-smart__chapter" data-missed={row.missed ? '' : undefined}><i />{row.chapter}</span>
              <span className="pro-smart__bar"><b style={{ width: '62%' }} /></span>
              <span className="pro-smart__bar" data-smart=""><b style={{ width: `${row.smart}%` }} /></span>
            </div>
          ))}
        </div>
        <p className="pro-smart__legend"><i />{legend}</p>
      </div>
      <figcaption className="pro-smart__caption">{caption}</figcaption>
    </figure>
  );
}

// The palette's 20 buttons as the exam-day screen colours them: answered, not answered, marked for review, the current one, not seen.
const PALETTE = ['a', 'a', 'n', 'a', 'm', 'a', 'a', 'n', 'n', 'a', 'm', 'a', 'a', 'c', 'v', 'v', 'v', 'v', 'v', 'v'];

/** NTA mode: the exam-day screen in miniature, with its clock, a question, Mark for Review and the question palette. */
export function NtaArt({ copy }) {
  return (
    <div className="pro-show__art pro-nta" aria-hidden="true">
      <div className="pro-nta__screen">
        <div className="pro-nta__bar">
          <span>{copy.mode}</span>
          <span className="pro-nta__clock"><svg viewBox="0 0 16 16" width="13" height="13"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 4.5V8l2.4 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>{copy.clock}</span>
        </div>
        <div className="pro-nta__body">
          <div className="pro-nta__q">
            <span className="pro-nta__qn">{copy.question}</span>
            <i className="pro-nta__line" style={{ width: '96%' }} />
            <i className="pro-nta__line" style={{ width: '70%' }} />
            {[56, 82, 46, 58].map((w, n) => (
              <span key={n} className="pro-nta__opt" data-picked={n === 1 ? '' : undefined}><b /><i style={{ width: `${w}%` }} /></span>
            ))}
            <span className="pro-nta__keys"><span className="pro-nta__mark">{copy.mark}</span><span className="pro-nta__save">{copy.save}</span></span>
          </div>
          <div className="pro-nta__pal">
            <span className="pro-nta__palhead">{copy.palette}</span>
            <span className="pro-nta__grid">
              {PALETTE.map((s, i) => <b key={i} data-s={s}>{i + 1}</b>)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A tick, for the comparison table and the plan's lines. */
export function Tick({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M4.5 10.5l3.6 3.6 7.4-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
