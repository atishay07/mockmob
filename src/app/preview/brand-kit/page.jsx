import { notFound } from 'next/navigation';
import { LogoMark } from '@/components/Logo';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SUBJECT_ART_BY_ID, SUBJECT_RENDERS } from '@/../data/subject_art.mjs';
import '@/app/(app)/arena.css';
import './brand-kit.css';

export const metadata = { robots: { index: false, follow: false } };

// Development only: the brand layer in one place for captures (logo B at every size it is used, on Night and
// Day, the subject objects as tiles and as lit hero objects, and the Bricolage display face).
const SIZES = [17, 19, 22, 26, 30, 72];
const LAUNCH = [['accountancy', 'Accountancy'], ['business_studies', 'Business Studies'], ['economics', 'Economics'], ['english', 'English']];
const firstId = (name) => Object.keys(SUBJECT_ART_BY_ID).find((id) => SUBJECT_ART_BY_ID[id] === name) || name;

export default function BrandKitPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="app-shell bk">
      <header className="bk-head">
        <p className="bk-eyebrow">Development brand inspection</p>
        <ThemeToggle />
      </header>
      <h1 className="bk-h1">Find the marks you are losing.</h1>
      <p className="bk-lead">Bricolage Grotesque for headings, logo B as the only mark, and the app&apos;s lamp-lit subject objects.</p>

      <section className="bk-logos" aria-label="Logo B sizes">
        {['night', 'day'].map((ground) => (
          <div key={ground} className={`bk-ground bk-ground--${ground}`}>
            {SIZES.map((h) => (
              <span key={h} className="logo bk-logo">
                <LogoMark height={h} title={`mockmob at ${h} px`} />
                <span className="bk-size">{h}px</span>
              </span>
            ))}
          </div>
        ))}
      </section>

      <h2 className="bk-h2">Your subjects</h2>
      <ul className="bk-launch">
        {LAUNCH.map(([id, name]) => (
          <li key={id}>
            <button type="button" className="bk-tile">
              <SubjectObject id={id} size={120} lit priority />
              <span>{name}</span>
            </button>
          </li>
        ))}
      </ul>

      <h2 className="bk-h2">Every subject object</h2>
      <ul className="bk-grid">
        {Object.values(SUBJECT_RENDERS).map((art) => (
          <li key={art.name}>
            <button type="button" className="bk-tile bk-tile--small">
              <SubjectObject id={firstId(art.name)} size={80} />
              <span>{art.name}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="bk-tile bk-tile--small">
            <SubjectObject id="astrology" size={80} />
            <span>Unknown subject keeps its icon</span>
          </button>
        </li>
      </ul>
    </main>
  );
}
