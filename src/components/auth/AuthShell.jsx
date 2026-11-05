"use client";
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import { Check } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import MobiReact from '@/components/brand/MobiReact';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { keepTogether } from '@/lib/keepTogether.mjs';
import '@/app/auth.css';

// The four commerce subjects most students sit, as the app's lamp-lit objects on one desk.
const DESK = ['accountancy', 'economics', 'business_studies', 'english'];

// Shared frame for /login and /signup (W-057, redesigned 17 Oct). Phone: the headline, then the form, then the desk.
// Wide: the headline and the desk on the left, the form on the right. The desk is the product's own art (Mobi and the
// subject objects settling in once), not a stock picture; the points under it are plain facts, ruled, not badges.
export function AuthShell({ title, lead, points = [], children }) {
  return (
    <div className="mm auth">
      <NavBar />
      <main id="main-content" className="mm-wrap auth__grid">
        <div className="auth__copy">
          {/* "CUET 2027" never parts at a line end (it split at 360, 390 and 1440 before, night 1105). */}
          <h1 className="mm-h1 auth__title">{keepTogether(title)}</h1>
          <p className="mm-lead auth__lead">{keepTogether(lead)}</p>
        </div>
        <div className="auth__card">{children}</div>
        <div className="auth__scene">
          <figure className="auth__desk" aria-hidden="true">
            <span className="auth__floor" />
            <span className="auth__mobi"><MobiReact act="hello" size={96} /></span>
            {DESK.map((id, i) => (
              <span key={id} className={`auth__obj auth__obj--${i}`} style={{ '--i': i }}>
                <SubjectObject id={id} size={i === 0 ? 112 : 92} lit framed={false} priority={i < 2} />
              </span>
            ))}
          </figure>
          {points.length > 0 ? (
            <ul className="auth__points">
              {points.map((point, i) => (
                <li key={point} style={{ '--i': i }}>
                  <Check size={18} aria-hidden="true" />
                  {keepTogether(point)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
