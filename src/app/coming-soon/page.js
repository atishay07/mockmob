import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MascotSeat } from '@/components/brand/Mascot';
import { ComingSoonClient } from './ComingSoonClient';
import './release-hold.css';

export const metadata = { title: 'Preview access | MockMob', description: 'MockMob preview access for CUET UG 2027.', robots: { index: false, follow: true } };
export default function ComingSoonPage() {
  return <main className="mm release-hold"><header className="mm-wrap release-hold__header"><Logo /><ThemeToggle /></header><section className="mm-wrap release-hold__body"><div><p className="mm-eyebrow">Preview access</p><h1 className="mm-h1">A clearer next step.<br />One question at a time.</h1><p className="mm-lead">CUET UG 2027 Commerce practice, recorded session review and source-backed DU subject tools.</p><p className="release-hold__note">Have a preview passcode? Enter it below. We will announce release dates when they are confirmed.</p><ComingSoonClient /></div><MascotSeat pose="encouraging" label="One step at a time." note="Mobi’s keeping your place." /></section><footer className="mm-wrap release-hold__footer">MockMob is independent of NTA and Delhi University. Practice scores and eligibility checks do not guarantee a result or admission.</footer></main>;
}