import { notFound } from 'next/navigation';
import { Mascot } from '@/components/brand/Mascot';
import { ThemeToggle } from '@/components/ThemeToggle';
import '@/app/(app)/arena.css';
import './brand-preview.css';

export const metadata = { robots: { index: false, follow: false } };
const POSES = ['greeting', 'thinking', 'pointing', 'celebrating', 'idle', 'encouraging'];
export default function BrandPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <main className="app-shell brand-preview"><ThemeToggle /><p>Development brand inspection · static poses · real delivery assets</p><h1>Mobi, through the night.</h1><p>A companion at the moments that need a little warmth. Quiet while you answer.</p><div className="brand-poses">{POSES.map((pose) => <figure key={pose}><div className="brand-poses__samples"><div className="brand-sample brand-sample--light"><Mascot pose={pose} alt={`Mobi: ${pose}`} /></div><div className="brand-sample brand-sample--dark"><Mascot pose={pose} alt="" /></div></div><figcaption>{pose} · 80 × 94 CSS px</figcaption></figure>)}</div><figure className="brand-sheet"><Mascot pose="sheet" alt="Mobi's character sheet showing the folded volt body, visor and six poses." /><figcaption>The original sheet. Mobi is a brand character, never a student or endorsement.</figcaption></figure></main>;
}
