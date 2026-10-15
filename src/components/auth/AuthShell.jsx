import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import '@/app/auth.css';

// Shared frame for /login and /signup (web IA plan section 3, step 3). What the page is for on the
// left, the sign-in card on the right; on a phone the short copy comes first and the card still
// sits above the fold. `title` may hold two audience variants (see LoginPageClient): the
// <html data-visitor> hint, or `visitor` here, picks one without a flash.
//
//   title  the page's one heading           lead   one sentence on what MockMob does
//   facts  one line of verified free facts  note   an optional line (the sample hand-off); an empty
//                                            string keeps its line reserved so nothing jumps
export function AuthShell({ title, lead, facts = null, note = null, visitor = null, children }) {
  return (
    <div className="mm auth" data-visitor={visitor || undefined}>
      <NavBar />
      <main id="main-content" className="mm-wrap auth__grid">
        <div className="auth__copy">
          <h1 className="mm-h1">{title}</h1>
          {lead ? <p className="mm-lead">{lead}</p> : null}
          {facts ? <p className="auth__facts">{facts}</p> : null}
          {note != null ? <p className="auth__note">{note}</p> : null}
        </div>
        <div className="auth__card">{children}</div>
      </main>
      <MarketingFooter />
    </div>
  );
}
