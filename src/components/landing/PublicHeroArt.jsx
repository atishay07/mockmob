import { SubjectObject } from '@/components/brand/SubjectObject';

// One picture for a public page's hero (W-072: the text-only Features and About pages get the landing's own imagery, not
// a new style). `subjects` stands the four launch subjects' lamp-lit objects in a row with their names: what MockMob
// covers first, true content rather than decoration. `campus` is one DU campus rendering from the landing's college
// shelf, for the page about the season that ends in DU admissions. Both are still pictures beside the copy; the objects
// keep their own small life on hover and tap.
const LAUNCH = [
  ['english', 'English'],
  ['accountancy', 'Accountancy'],
  ['business', 'Business Studies'],
  ['economics', 'Economics'],
];

export function PublicHeroArt({ kind = 'subjects' }) {
  if (kind === 'campus') {
    const set = (type) => [300, 450, 600].map((w) => `/images/campus/srcc-${w}.${type} ${w}w`).join(', ');
    return (
      <figure className="pub-art pub-art--campus">
        <picture>
          <source type="image/avif" srcSet={set('avif')} sizes="(min-width: 640px) 560px, calc(100vw - 40px)" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/campus/srcc-450.webp" srcSet={set('webp')} sizes="(min-width: 640px) 560px, calc(100vw - 40px)" width={600} height={400} alt="Shri Ram College of Commerce, Delhi University, drawn under evening light" decoding="async" />
        </picture>
        <figcaption>Shri Ram College of Commerce, Delhi University.</figcaption>
      </figure>
    );
  }
  return (
    <ul className="pub-art pub-art--subjects" aria-label="The four CUET subjects MockMob covers first">
      {LAUNCH.map(([id, name], i) => (
        <li key={id}>
          <SubjectObject id={id} size={112} lit={i === 1} sizes="(min-width: 900px) 112px, 72px" className="pub-art__obj" style={{ '--obj-size': 'var(--pub-obj)' }} />
          <span>{name}</span>
        </li>
      ))}
    </ul>
  );
}

// The hero's layout and the picture's sizes, shared by both pages (theme tokens only, so Night and Day match).
export const PUBLIC_HERO_CSS = `
  .pub-hero { display: grid; gap: 1.75rem; }
  @media (min-width: 900px) { .pub-hero { gap: 2.5rem; } }
  .pub-art { margin: 0; }
  .pub-art--subjects { --pub-obj: 72px; list-style: none; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.5rem; }
  @media (min-width: 900px) { .pub-art--subjects { --pub-obj: 112px; gap: 1rem; max-width: 640px; } }
  .pub-art--subjects li { display: grid; justify-items: center; gap: 0.5rem; text-align: center; }
  .pub-art--subjects span { font: 600 0.8125rem/1.25 var(--font-display); color: var(--ink-2); }
  .pub-art--campus { max-width: 560px; }
  .pub-art--campus img { display: block; width: 100%; height: auto; border-radius: 20px; }
  .pub-art--campus figcaption { margin-top: 0.6rem; font-size: 0.8125rem; line-height: 1.45; color: var(--ink-3, var(--ink-2)); }
`;
