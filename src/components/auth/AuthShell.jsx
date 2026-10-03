import { Check } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import '@/app/auth.css';

// Shared frame for /login and /signup: promise on the left, the form on the
// right, stacked on a phone with the form first so the action is on screen.
export function AuthShell({ title, lead, points = [], children }) {
  return (
    <div className="mm auth">
      <NavBar />
      <main id="main-content" className="mm-wrap auth__grid">
        <div className="auth__copy">
          <h1 className="mm-h1">{title}</h1>
          <p className="mm-lead">{lead}</p>
          {points.length > 0 ? (
            <ul className="auth__points">
              {points.map((point) => (
                <li key={point}>
                  <Check size={18} aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="auth__card">{children}</div>
      </main>
      <MarketingFooter />
    </div>
  );
}
