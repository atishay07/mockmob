'use client';

// Mobi, drawn: the web twin of the app's MobiFigure and painter. One SVG in the app's own design
// box (140 by 168, soles on y 162): the folded paper body with its core shadow and soft specular
// bloom, the lamp-lit visor with its gloss, rubber-hose arms with mittens (or a pointing hand), legs
// that step into the boots (boot, then the leg clipped at the cuff, then the boot's front lip), the
// antenna with its bulb, and eyes that can look, blink, smile, slope and close. The shapes are the
// app's numbers; mobiPaint.js turns a rig into this frame's transforms and paths, and `paint()`
// writes them on the elements (no React work per frame). Colours are CSS variables for Night and
// Day (mobi-figure.css).
//
//   const ref = useRef(); <MobiFigure ref={ref} /> ... ref.current.paint(rig, { px })
//
// Props: `lite` (below about 56 px: one stroke per limb, no rim lines, no screen glow), `head` (only
// the head, framed to fill the box). Decorative: aria-hidden; the caller labels the whole.
//
// Server render: every moving element carries its first frame as attributes (`initial` rig), computed
// by the same paint function run on plain attribute bags, so he is drawn before any script runs and
// the first client paint matches the server's.

import { useCallback, useId, useImperativeHandle, useRef, useState } from 'react';
import { BODY_PATH, CUFF, GEO, arcPath } from './mobiPaint';
import { defaultRig } from './mobiRig';
import { GlintMark, GroundMarks, HeadMarks, MarksDefs, ZzzMarks } from './MobiMarks';
import { paintFigure, virtualPaint } from './mobiDom';
import './mobi-figure.css';

const PI = Math.PI;
const stop = (o, c, a = 1) => <stop offset={o} style={{ stopColor: c, stopOpacity: a }} />;
const LIME = { hi: '#EFFF7A', light: '#E2FA2E', base: '#D2F000', mid: '#BFDB00', lo: '#A2BB00', deep: '#6F8200', shade: '#4F5D00' };
const BOOT_PATH = 'M-9 1C-14.5 3 -15 13.8 -9 15L13 15C20 15 21 8 15 6.2C11 5 9.2 3 8.6 1C8 -2 -8 -2 -9 1Z';
const VISOR = { x: GEO.visor[0] - GEO.visorSize[0] / 2, y: GEO.visor[1] - GEO.visorSize[1] / 2, w: GEO.visorSize[0], h: GEO.visorSize[1], r: GEO.visorRadius };

// ---- Static art ------------------------------------------------------------------------------------

function Defs({ p, A }) {
  const V = VISOR;
  return (
    <defs>
      <clipPath id={`${p}body`}><path d={BODY_PATH} /></clipPath>
      <clipPath id={`${p}boot`}><path d={BOOT_PATH} /></clipPath>
      <clipPath id={`${p}cuff`}><ellipse cx={CUFF.cx} cy={CUFF.cy} rx={CUFF.rx} ry={CUFF.ry} /></clipPath>
      <clipPath id={`${p}leg`}><rect x="-400" y="-400" width="800" height={400 + CUFF.cy} /><ellipse cx={CUFF.cx} cy={CUFF.cy} rx={CUFF.rx} ry={CUFF.ry} /></clipPath>
      <clipPath id={`${p}eyes`}><rect x={V.x + 1.2} y={V.y + 1.2} width={V.w - 2.4} height={V.h - 2.4} rx={V.r - 1.2} /></clipPath>
      <clipPath id={`${p}glass`}><rect x={V.x + 0.8} y={V.y + 0.8} width={V.w - 1.6} height={V.h - 1.6} rx={V.r - 0.8} /></clipPath>
      {['L', 'R'].map((s) => (
        <g key={s}>
          <clipPath id={`${p}ecl${s}`}><path {...A(`ecl${s}`)} /></clipPath>
          <clipPath id={`${p}ecd${s}`}><path {...A(`ecd${s}`)} /></clipPath>
        </g>
      ))}
      <linearGradient id={`${p}bodyFill`} gradientUnits="userSpaceOnUse" x1="28" y1="34" x2="118" y2="140">{stop(0, LIME.light)}{stop(0.38, LIME.base)}{stop(0.72, LIME.mid)}{stop(1, LIME.lo)}</linearGradient>
      <radialGradient id={`${p}sheen`} gradientUnits="userSpaceOnUse" cx="46" cy="58" r="58">{stop(0, LIME.hi, 0.7)}{stop(1, LIME.hi, 0)}</radialGradient>
      <linearGradient id={`${p}flap`} gradientUnits="userSpaceOnUse" x1="96" y1="58" x2="106" y2="48">{stop(0, LIME.mid)}{stop(1, LIME.lo)}</linearGradient>
      <linearGradient id={`${p}fold`} gradientUnits="userSpaceOnUse" x1="84" y1="100" x2="96" y2="138">{stop(0, LIME.light)}{stop(0.35, LIME.base)}{stop(1, LIME.lo)}</linearGradient>
      <radialGradient id={`${p}occlude`} gradientUnits="userSpaceOnUse" cx="72" cy="146" r="42">{stop(0, LIME.shade, 0.42)}{stop(1, LIME.shade, 0)}</radialGradient>
      <radialGradient id={`${p}core`} gradientUnits="userSpaceOnUse" cx="134" cy="128" r="82">{stop(0, LIME.shade, 0.34)}{stop(0.55, LIME.shade, 0.12)}{stop(1, LIME.shade, 0)}</radialGradient>
      <radialGradient id={`${p}bloom`} cx="0" cy="0" r="22" gradientUnits="userSpaceOnUse">{stop(0, '#fff', 'var(--mb-bloom-a)')}{stop(0.45, '#fff', 'var(--mb-bloom-b)')}{stop(1, '#fff', 0)}</radialGradient>
      <linearGradient id={`${p}lamp`} gradientUnits="userSpaceOnUse" x1="22" y1="50" x2="70" y2="98">{stop(0, 'var(--mb-lamp)', 'var(--mb-lamp-a)')}{stop(1, 'var(--mb-lamp)', 0)}</linearGradient>
      <linearGradient id={`${p}bevel`} gradientUnits="userSpaceOnUse" x1="30" y1="40" x2="116" y2="132">{stop(0, LIME.hi)}{stop(0.5, LIME.hi, 0.2)}{stop(1, LIME.deep, 0.65)}</linearGradient>
      <linearGradient id={`${p}recess`} gradientUnits="userSpaceOnUse" x1="70" y1={V.y} x2="70" y2={V.y + V.h}>{stop(0, LIME.shade)}{stop(0.55, LIME.lo)}{stop(1, LIME.hi)}</linearGradient>
      <linearGradient id={`${p}visor`} gradientUnits="userSpaceOnUse" x1="70" y1={V.y} x2="70" y2={V.y + V.h}>{stop(0, '#2B2926')}{stop(0.45, '#151413')}{stop(1, '#0B0A09')}</linearGradient>
      <linearGradient id={`${p}edge`} gradientUnits="userSpaceOnUse" x1="70" y1={V.y} x2="70" y2={V.y + V.h}>{stop(0, '#fff', 0.2)}{stop(0.5, '#fff', 0)}{stop(1, '#fff', 0.06)}</linearGradient>
      <linearGradient id={`${p}band`} gradientUnits="userSpaceOnUse" x1="0" y1={V.y + 2.2} x2="0" y2={V.y + 12}>{stop(0, '#fff', 0.2)}{stop(1, '#fff', 0)}</linearGradient>
      <linearGradient id={`${p}eye`} x1="0" y1="0" x2="0" y2="1">{stop(0, '#FFFAEE')}{stop(0.55, '#FFFAEE')}{stop(1, '#D9D0BD')}</linearGradient>
      <radialGradient id={`${p}eyeglow`} cx="0.5" cy="0.5" r="0.5">{stop(0, '#FFFAEE', 1)}{stop(0.45, '#FFFAEE', 0.35)}{stop(1, '#FFFAEE', 0)}</radialGradient>
      <radialGradient id={`${p}hand`} gradientUnits="userSpaceOnUse" cx="-2.5" cy="5" r="14">{stop(0, 'var(--mb-limb-hi)')}{stop(0.5, 'var(--mb-limb)')}{stop(1, 'var(--mb-limb-lo)')}</radialGradient>
      <radialGradient id={`${p}bootfill`} gradientUnits="userSpaceOnUse" cx="-3" cy="2" r="24">{stop(0, 'var(--mb-limb-hi)')}{stop(0.45, 'var(--mb-limb)')}{stop(1, 'var(--mb-limb-lo)')}</radialGradient>
      <linearGradient id={`${p}bootrim`} gradientUnits="userSpaceOnUse" x1="-12" y1="0" x2="4" y2="10">{stop(0, 'var(--mb-rim)', 'var(--mb-rim-a)')}{stop(1, 'var(--mb-rim)', 0)}</linearGradient>
      <radialGradient id={`${p}toe`} gradientUnits="userSpaceOnUse" cx="10.5" cy="8.2" r="5">{stop(0, '#fff', 0.16)}{stop(1, '#fff', 0)}</radialGradient>
      <radialGradient id={`${p}bulb`} gradientUnits="userSpaceOnUse" cx="-1.8" cy="-2" r={GEO.antennaBall * 1.5}>{stop(0, LIME.hi)}{stop(0.5, LIME.base)}{stop(1, LIME.lo)}</radialGradient>
      <radialGradient id={`${p}halo`} cx="0.5" cy="0.5" r="0.5">{stop(0, 'var(--mb-halo-in)')}{stop(0.45, 'var(--mb-halo-mid)', 0.35)}{stop(1, 'var(--mb-halo-mid)', 0)}</radialGradient>
      <radialGradient id={`${p}pool`} cx="0.5" cy="0.5" r="0.5">{stop(0, 'var(--mb-shadow)', 'var(--mb-pool-a)')}{stop(0.5, 'var(--mb-shadow)', 'calc(var(--mb-pool-a) * 0.45)')}{stop(1, 'var(--mb-shadow)', 0)}</radialGradient>
      <radialGradient id={`${p}coregrad`} cx="0.5" cy="0.5" r="0.5">{stop(0, 'var(--mb-shadow)', 'var(--mb-core-a)')}{stop(0.5, 'var(--mb-shadow)', 'calc(var(--mb-core-a) * 0.45)')}{stop(1, 'var(--mb-shadow)', 0)}</radialGradient>
      <linearGradient id={`${p}sheet`} gradientUnits="userSpaceOnUse" x1="-18" y1="-13" x2="18" y2="13">{stop(0, '#FFFBF1')}{stop(1, '#E9E1CF')}</linearGradient>
      <MarksDefs p={p} />
    </defs>
  );
}

function BodyArt({ p }) {
  const V = VISOR;
  return (
    <g>
      <path d={BODY_PATH} fill={`url(#${p}bodyFill)`} />
      <g clipPath={`url(#${p}body)`}>
        <circle cx="46" cy="58" r="58" fill={`url(#${p}sheen)`} />
        <path d="M73 26L132 84L121 86Q97 63 74 33Z" fill={`url(#${p}flap)`} />
        <path d="M74.5 33Q97 63 121 86" fill="none" stroke={LIME.deep} strokeOpacity="0.22" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M74.5 33Q97 63 121 86" fill="none" stroke={LIME.hi} strokeOpacity="0.85" strokeWidth="1.1" strokeLinecap="round" />
        <path transform="translate(0 -1.6)" d="M121 86Q86 101 44 113" fill="none" stroke={LIME.deep} strokeOpacity="0.2" strokeWidth="5" strokeLinecap="round" />
        <path d="M134 82L121 86Q86 101 44 113L10 132L72 176L140 112Z" fill={`url(#${p}fold)`} />
        <path d="M121 86Q86 101 44 113" fill="none" stroke={LIME.hi} strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="72" cy="146" r="42" fill={`url(#${p}occlude)`} />
        <circle cx="134" cy="128" r="82" fill={`url(#${p}core)`} />
        <ellipse transform="translate(47 57) rotate(-41.3) scale(1 0.58)" rx="22" ry="22" fill={`url(#${p}bloom)`} />
        <path d={BODY_PATH} fill="none" stroke={`url(#${p}lamp)`} strokeWidth="5" />
        <path d={BODY_PATH} fill="none" stroke={`url(#${p}bevel)`} strokeWidth="3.6" />
      </g>
      <rect x={V.x - 2.2} y={V.y - 2.2} width={V.w + 4.4} height={V.h + 4.4} rx={V.r + 2.2} fill={`url(#${p}recess)`} />
      <rect x={V.x} y={V.y} width={V.w} height={V.h} rx={V.r} fill={`url(#${p}visor)`} />
    </g>
  );
}

function Gloss({ p }) {
  const V = VISOR;
  return (
    <g aria-hidden="true">
      <rect x={V.x + 0.7} y={V.y + 0.7} width={V.w - 1.4} height={V.h - 1.4} rx={V.r - 0.7} fill="none" stroke={`url(#${p}edge)`} strokeWidth="1.1" />
      <rect x={V.x + 6} y={V.y + 2.2} width={V.w - 12} height="9.8" rx="8" fill={`url(#${p}band)`} />
      <rect x={V.x + 9} y={V.y + 4} width="10" height="2.6" rx="2" fill="#fff" fillOpacity="0.55" />
      <circle cx={V.x + 22.5} cy={V.y + 5.3} r="1.2" fill="#fff" fillOpacity="0.4" />
    </g>
  );
}

function Eye({ p, s, lite, A }) {
  return (
    <g>
      {lite ? null : <ellipse {...A(`glow${s}`)} className="mb-n" fill={`url(#${p}eyeglow)`} />}
      <path {...A(`lid${s}`)} fill="none" strokeLinecap="round" style={{ stroke: '#FFFAEE' }} />
      <g {...A(`eg1${s}`)}>
        <g {...A(`eg2${s}`)}>
          <rect {...A(`eye${s}`)} fill={`url(#${p}eye)`} />
          <ellipse {...A(`catch${s}`)} fill="#fff" />
        </g>
      </g>
      <path {...A(`arc${s}`)} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: '#FFFAEE' }} />
    </g>
  );
}

function Hand({ p, lite, k, A }) {
  const fill = `url(#${p}hand)`;
  return (
    <g>
      <g {...A(`${k}_finger`)}>
        <rect x="-2.5" y="9" width="5" rx="2.5" ry="2.5" {...A(`${k}_fingerR`)} fill={fill} />
        {lite ? null : <line x1="-2.1" x2="2.1" {...A(`${k}_crease`)} className="mb-crease" strokeWidth="0.9" strokeLinecap="round" />}
        <rect x="-2.1" y="9.4" width="4.2" rx="2.1" ry="2.1" {...A(`${k}_fingerRim`)} fill="none" className="mb-hand-rim mb-hand-rim--finger" strokeWidth="0.8" />
      </g>
      <ellipse {...A(`${k}_palm`)} fill={fill} />
      <g {...A(`${k}_thumb`)}><ellipse rx="3.4" {...A(`${k}_thumbE`)} fill={fill} /></g>
      {lite ? null : <path {...A(`${k}_palmRim`)} fill="none" className="mb-hand-rim" strokeWidth="0.8" strokeLinecap="round" />}
    </g>
  );
}

/** The rubber hose: a dark tube with a lamp-lit copy under the dark stroke (one stroke when lite). */
function Hose({ lite, k, A }) {
  if (lite) return <path {...A(`${k}_h0`)} className="mb-hose mb-hose--main" fill="none" strokeLinecap="round" strokeWidth={GEO.armWidth} />;
  return (
    <>
      <path {...A(`${k}_h0`)} className="mb-hose mb-hose--lo" fill="none" strokeLinecap="round" strokeWidth={GEO.armWidth} />
      <path {...A(`${k}_h1`)} transform="translate(-0.8 -0.8)" className="mb-hose mb-hose--hi" fill="none" strokeLinecap="round" strokeWidth={GEO.armWidth * 0.72} />
      <path {...A(`${k}_h2`)} transform="translate(0.45 0.45)" className="mb-hose mb-hose--main" fill="none" strokeLinecap="round" strokeWidth={GEO.armWidth * 0.66} />
    </>
  );
}

/** An arm (hose plus hand), drawn once behind the body and once in front; only one shows. */
function Arm({ s, layer, p, lite, A }) {
  const k = `arm${s}${layer}`;
  return (
    <g {...A(k)}>
      <Hose lite={lite} k={k} A={A} />
      <g {...A(`${k}_hand`)}><Hand p={p} lite={lite} k={k} A={A} /></g>
    </g>
  );
}

function BootArt({ p }) {
  return (
    <g>
      <path d={BOOT_PATH} fill={`url(#${p}bootfill)`} />
      <g clipPath={`url(#${p}boot)`}>
        <rect x="-16" y="12.4" width="38" height="3.6" style={{ fill: 'var(--mb-limb-lo)' }} />
        <line x1="-14" y1="12.4" x2="20" y2="12.4" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.8" style={{ stroke: 'var(--mb-limb-hi)' }} />
        <ellipse cx="10.5" cy="8.2" rx="5" ry="2.2" fill={`url(#${p}toe)`} />
      </g>
      <path d={BOOT_PATH} fill="none" stroke={`url(#${p}bootrim)`} strokeWidth="0.9" />
      <ellipse cx={CUFF.cx} cy={CUFF.cy} rx={CUFF.rx} ry={CUFF.ry} fill="#0C0B0A" />
      <path d={arcPath(CUFF.cx, CUFF.cy, CUFF.rx, CUFF.ry, PI + 0.15, PI - 0.3)} fill="none" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.55" style={{ stroke: 'var(--mb-limb-hi)' }} />
    </g>
  );
}

function BootLip({ p, lite }) {
  return (
    <g>
      {lite ? null : (
        <g clipPath={`url(#${p}cuff)`}>
          <path d={arcPath(CUFF.cx, CUFF.cy + 0.9, CUFF.rx, CUFF.ry, 0.15, PI - 0.3)} fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}
      <path d={arcPath(CUFF.cx, CUFF.cy, CUFF.rx, CUFF.ry, 0.12, PI - 0.24)} fill="none" strokeWidth="2" strokeLinecap="round" style={{ stroke: 'var(--mb-limb)' }} />
      <path d={arcPath(CUFF.cx, CUFF.cy, CUFF.rx, CUFF.ry, 0.3, PI - 0.6)} fill="none" strokeWidth="0.9" strokeLinecap="round" style={{ stroke: 'var(--mb-lip-hi)' }} />
    </g>
  );
}

/** A boot, the leg going into it (clipped at the cuff) and the boot's front lip over the leg. */
function Leg({ s, p, lite, A }) {
  return (
    <>
      <g {...A(`boot${s}`)}><BootArt p={p} /></g>
      <g {...A(`legc${s}`)} clipPath={`url(#${p}leg)`}>
        <g {...A(`legu${s}`)}><Hose lite={lite} k={`leg${s}`} A={A} /></g>
      </g>
      <g {...A(`lip${s}`)}><BootLip p={p} lite={lite} /></g>
    </>
  );
}

function Sheet({ p, A }) {
  const filled = new Set([1, 8]);
  return (
    <g {...A('sheet')}>
      <rect x="-17.2" y="-11.6" width="36" height="26" rx="3" fill="#000" fillOpacity="0.25" />
      <rect x="-18" y="-13" width="36" height="26" rx="3" fill={`url(#${p}sheet)`} />
      {Array.from({ length: 12 }, (_, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const cx = -10.5 + col * 7;
        const cy = -6.5 + row * 6.5;
        if (i === 6) return <circle key={i} cx={cx} cy={cy} r="2.3" fill={LIME.base} stroke={LIME.deep} strokeWidth="0.6" />;
        if (filled.has(i)) return <circle key={i} cx={cx} cy={cy} r="2.3" fill="#2B2824" />;
        return <circle key={i} cx={cx} cy={cy} r="2.1" fill="none" stroke="#3A362F" strokeOpacity="0.55" strokeWidth="0.8" />;
      })}
    </g>
  );
}

function Antenna({ p, lite, A }) {
  return (
    <g>
      <path {...A('antStem')} fill="none" strokeWidth="4.4" strokeLinecap="round" style={{ stroke: 'var(--mb-limb)' }} />
      {lite ? null : <path {...A('antRim')} transform="translate(-0.7 -0.4)" fill="none" className="mb-hand-rim mb-ant-rim" strokeWidth="1" strokeLinecap="round" />}
      <g {...A('antBulbG')}>
        <circle {...A('antHalo')} className="mb-n" r="1" fill={`url(#${p}halo)`} />
        <circle r={GEO.antennaBall} fill={`url(#${p}bulb)`} />
        <circle {...A('antGlow')} r={GEO.antennaBall * 0.62} fill={LIME.hi} />
        <circle {...A('antLit')} className="mb-d" fill="none" strokeWidth="1" stroke="#526700" />
        <circle cx="-1.9" cy="-2.1" r="1.3" fill="#fff" fillOpacity="0.8" />
      </g>
    </g>
  );
}

/** The SVG's elements by data-m name (done once at mount). */
function collect(svg) {
  const els = {};
  svg.querySelectorAll('[data-m]').forEach((el) => { els[el.getAttribute('data-m')] = el; });
  return els;
}

/**
 * The SVG. `ref` gives { paint(rig, { px }) }, which writes a frame; call it from the frame loop.
 * `initial` is the rig drawn on the server and before the first frame; `px` its pixel density.
 */
export default function MobiFigure({ ref, initial, px = 1, lite = false, head = false, className = '' }) {
  const raw = useId();
  const p = `mb${raw.replace(/[^a-zA-Z0-9]/g, '')}-`;
  const svgRef = useRef(null);
  const els = useRef(null);
  const [first] = useState(() => virtualPaint(initial || defaultRig(), { px, lite, head, prefix: p }));
  const A = useCallback((name) => ({ 'data-m': name, ...first[name] }), [first]);
  const view = head ? '8 1 130 149' : '0 0 140 168';

  useImperativeHandle(ref, () => ({
    paint(rig, opts = {}) {
      if (!svgRef.current) return;
      if (!els.current) els.current = collect(svgRef.current);
      paintFigure(els.current, rig, { px, lite, head, prefix: p, ...opts });
    },
  }), [px, lite, head, p]);

  return (
    <svg ref={svgRef} className={`mb-svg ${className}`.trim()} viewBox={view} aria-hidden="true" focusable="false" overflow="visible">
      <Defs p={p} A={A} />
      {head ? null : (
        <g aria-hidden="true">
          <ellipse {...A('pool')} cy="162.5" fill={`url(#${p}pool)`} />
          <ellipse {...A('core')} cy="162.5" fill={`url(#${p}coregrad)`} />
        </g>
      )}
      {head ? null : <GroundMarks p={p} A={A} />}
      <g {...A('bodyBack')}>
        <Antenna p={p} lite={lite} A={A} />
        {head ? null : <><Arm s="L" layer="Back" p={p} lite={lite} A={A} /><Arm s="R" layer="Back" p={p} lite={lite} A={A} /></>}
      </g>
      {head ? null : <><Leg s="L" p={p} lite={lite} A={A} /><Leg s="R" p={p} lite={lite} A={A} /></>}
      <g {...A('bodyFront')}>
        <BodyArt p={p} />
        <g clipPath={`url(#${p}glass)`}><GlintMark p={p} A={A} /></g>
        <g clipPath={`url(#${p}eyes)`}><Eye p={p} s="L" lite={lite} A={A} /><Eye p={p} s="R" lite={lite} A={A} /></g>
        <Gloss p={p} />
        {head ? null : <><Arm s="L" layer="Front" p={p} lite={lite} A={A} /><Arm s="R" layer="Front" p={p} lite={lite} A={A} /><Sheet p={p} A={A} /></>}
        <HeadMarks p={p} A={A} />
      </g>
      <ZzzMarks A={A} />
    </svg>
  );
}
