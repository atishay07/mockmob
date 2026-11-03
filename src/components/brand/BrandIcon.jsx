import { CalendarCheck, Compass, FileStack, GalleryVerticalEnd, Layers, ListChecks, NotebookPen, Bookmark, BookOpen, Printer, RotateCcw, Users, Bandage } from 'lucide-react';
import { BRAND_ICONS, brandIconSrc, brandIconSrcSet } from '@/../data/brand_icons.mjs';
import './brand-icon.css';

// MockMob's branded icons (R7 packet I, LK60): one small desk object per meaning, from the same lamp-lit study desk as the
// subject objects (brass, cream paper, kraft, charcoal and one lime felt or foil accent). They replace the generic line
// drawings that stood in for a MockMob thing (a printer for the print sheet, a wrench for your mistakes).
//
//   <BrandIcon name="keycards" size={40} />
//
// The box is a fixed square, laid out before the file decodes, so nothing shifts. Decorative by default (the row prints
// its words beside it); pass `label` when it stands alone. Below 32 px a photo-real object turns to mush (the same rule as
// SubjectObject), so a smaller request draws the line icon of the same meaning instead.
// Controls (chevrons, close, check, search, steppers) are never brand icons: they are the interface's verbs.

const MIN_OBJECT_PX = 32;

const LINE = {
  keycards: Layers, questions: ListChecks, mistakes: Bandage, lesson: BookOpen, print: Printer, revise: RotateCcw,
  feeds: GalleryVerticalEnd, saved: Bookmark, papers: FileStack, compass: Compass, today: CalendarCheck, mob: Users,
  you: NotebookPen,
};

/**
 * Mobi's face as a small drawn mark (the lime folded diamond, the charcoal visor, two cream eyes, the antenna), for the
 * places that say "Ask Mobi" at text size, where the speech bubble used to stand. Crisp from 14 px; decorative.
 */
export function MobiMark({ size = 18, className = '' }) {
  return (
    <svg className={`mobi-mark ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15.6 6.1Q17.2 3.4 19.4 3.3" fill="none" stroke="#14170e" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="19.7" cy="3.3" r="1.55" fill="#D2F000" stroke="#14170e" strokeWidth="0.8" />
      <path d="M12 2.6L21.2 12L12 21.4L2.8 12Z" fill="#D2F000" stroke="#9db400" strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M2.8 12L15.6 6.1" fill="none" stroke="#b5cf00" strokeWidth="0.7" />
      <rect x="5.6" y="9.4" width="12.8" height="4.9" rx="2.45" fill="#14170e" />
      <ellipse cx="9.8" cy="11.85" rx="1.05" ry="1.55" fill="#f7f4e6" />
      <ellipse cx="14.2" cy="11.85" rx="1.05" ry="1.55" fill="#f7f4e6" />
    </svg>
  );
}

export function BrandIcon({ name, size = 40, label, className = '', style }) {
  const icon = BRAND_ICONS[name];
  if (!icon || size < MIN_OBJECT_PX) {
    const Line = LINE[name] || Layers;
    const glyph = Math.max(14, Math.min(24, Math.round(size * 0.6)));
    return (
      <span className={`brand-icon brand-icon--line ${className}`.trim()} style={{ '--bi-size': `${size}px`, ...style }} data-icon={name}
        role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        <Line size={glyph} strokeWidth={1.9} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className={`brand-icon ${className}`.trim()} style={{ '--bi-size': `${size}px`, ...style }} data-icon={name}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized webp pair, no optimizer round trip for a 40 px mark */}
      <img className="brand-icon__img" src={brandIconSrc(name, size)} srcSet={brandIconSrcSet(name)} sizes={`${size}px`}
        width={size} height={size} alt="" decoding="async" loading="lazy" draggable={false} />
    </span>
  );
}
