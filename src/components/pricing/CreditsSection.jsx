import { PrepOSCreditPurchaseButton } from '@/components/billing/PrepOSCreditPurchaseButton';
import { aiCreditRows, practiceCreditRows } from './pricingContent';

// "Two kinds of credits" (web IA plan 4.4): practice credits and AI credits, each with what an action
// uses. It carries the #ai-credits anchor that /pricing/prepos now points to, so a student who used
// to open the old wallet page lands on their own balance here. Balances are shown only when the
// wallet read succeeded; nothing says "unavailable".
//
// `wallet` is readAIWallet() output or null (signed out). `practiceBalance` is the account's
// practice credits or null. `packs` is the list of top-up packs, empty while checkout is closed.
export function CreditsSection({ wallet = null, practiceBalance = null, isPro = false, repairOn = true, askOn = true, packs = [] }) {
  const aiRows = aiCreditRows({ repairOn, askOn });
  const walletKnown = Boolean(wallet?.known);
  const resetText = wallet?.resetAt && !Number.isNaN(new Date(wallet.resetAt).getTime())
    ? new Date(wallet.resetAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    : null;
  const signedIn = Boolean(wallet) || practiceBalance !== null;

  return (
    <section id="ai-credits" className="mm-section mm-section--sunken">
      <div className="mm-wrap">
        <h2 className="mm-h2">Two kinds of credits, two jobs.</h2>
        <p className="mm-body mm-section__intro">
          Practice credits pay for mocks and practice. AI credits pay for Mistake Repair and Ask Mobi. They are never mixed.
        </p>

        <div className="mm-credits">
          <div className="mm-credits__col">
            <h3 className="mm-credits__title">Practice credits</h3>
            <dl className="mm-credits__rows">
              {practiceCreditRows().map(([term, value]) => (
                <div key={term} className="mm-credits__row">
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="mm-credits__col">
            <h3 className="mm-credits__title">AI credits</h3>
            <dl className="mm-credits__rows">
              {aiRows.map(([term, value]) => (
                <div key={term} className="mm-credits__row">
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {signedIn ? (
          <div className="mm-credits__mine">
            <h3 className="mm-credits__title">Your balance</h3>
            <ul>
              {isPro ? (
                <li>Practice comes with Pro: mocks and practice use no credits.</li>
              ) : practiceBalance !== null ? (
                <li><b>{practiceBalance}</b> practice credits</li>
              ) : null}
              {walletKnown ? (
                <li>
                  <b>{wallet.includedRemaining}</b> of {wallet.includedMonthlyCredits} AI credits left this month
                  {resetText ? `. Renews ${resetText}.` : '.'}
                </li>
              ) : (
                <li>We could not read your AI credits just now. Reload the page to try again.</li>
              )}
              {walletKnown && wallet.bonusCredits > 0 ? (
                <li><b>{wallet.bonusCredits}</b> purchased AI credits. They do not expire and are used after the monthly ones.</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {packs.length > 0 ? (
          <>
            <h3 className="mm-credits__title mm-credits__title--packs">Add AI credits</h3>
            <ul className="mm-packs">
              {packs.map((pack) => (
                <li key={pack.key} className="mm-pack" data-featured={pack.featured ? 'true' : 'false'}>
                  <p className="mm-pack__name">{pack.shortLabel}{pack.featured ? <span>Most credits per rupee</span> : null}</p>
                  <p className="mm-pack__price">₹{pack.amountInr}</p>
                  <p className="mm-pack__credits">{pack.credits} AI credits<small>They do not expire.</small></p>
                  <PrepOSCreditPurchaseButton pack={pack} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}
