"use client";

// Wallet (/wallet), version 13 (owner I9, 20 Oct 2026: "this top-up screen is extremely poor ... this wallet screen has to be redone").
// ONE credits balance (owner D78) as the hero, split honestly into this month's free credits (with the refill date) and the credits a
// student keeps; what each thing costs; the reload packs as cards worded as Mobi's written answers and mistake repairs (owner J3: no
// "1 full mock or 50 questions" lines), with the real best-value maths; a clear bridge to Pro for Free
// students; and the last 20 lines of activity. Reads GET /api/wallet once (and again after a purchase). Every pack key calls the one
// client function startWalletPurchase. While top-ups are closed (WALLET_COMMERCE_OPEN) the packs show their prices and the key says
// "Top-ups open soon"; no order is made. All the words and numbers come from walletModel.mjs, which tests hold.
// No lime key on this page, so the shell's Start key stays the viewport's one lime key.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import ArenaHead from '@/components/arena/ArenaHead';
import InviteFriendCard from '@/components/referrals/InviteFriendCard';
import { CreditMark } from '@/components/ui/Glyph';
import { useAuth } from '@/components/AuthProvider';
import { apiGet } from '@/lib/fetcher';
import { shownName } from '@/lib/displayName.mjs';
import { startWalletPurchase } from '@/lib/wallet/startWalletPurchase';
import { announceWallet } from '@/components/useWalletSummary';
import { walletFromResponse as aiWalletFromResponse } from '@/services/credits/aiWalletState';
import { PRACTICE_PRICE } from '@/lib/creditCopy.mjs';
import { FIRST_FULL_MOCK_ON } from '@/../data/first_full_mock';
import { REPAIR_CREDIT_COST } from '@/../data/mistake_repair';
import {
  WALLET_COPY, WALLET_V13_COPY, WALLET_URL, balanceSplit, balanceTile, historyRow, lowBalanceLine, packCards, packsIntro, priceRows, proBridge, walletFromResponse,
} from '@/components/wallet/walletModel.mjs';
import './wallet.css';

const EMPTY = { status: 'loading', data: null };
const VISIBLE_HISTORY = 4;
const PRICES = Object.freeze({ question: PRACTICE_PRICE.perQuestion, fullMock: PRACTICE_PRICE.full, reply: 1, repair: REPAIR_CREDIT_COST, firstMockFree: FIRST_FULL_MOCK_ON });

function reducedMotion() {
  if (typeof window === 'undefined') return true;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// The balance counts to its value (300 ms, ease-out) when it first arrives and whenever it changes, e.g. after a top-up.
// It renders the true number at once with reduced motion, and always ends on the true number.
function useCountTo(target) {
  const [shown, setShown] = useState(target);
  const from = useRef(null);
  useEffect(() => {
    if (target === null) { from.current = null; return undefined; }
    const start = from.current ?? 0;
    from.current = target;
    if (start === target || reducedMotion()) { const id = window.setTimeout(() => setShown(target), 0); return () => window.clearTimeout(id); }
    let raf = 0;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 300);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return target === null ? null : shown;
}

function ActivityRows({ lines, start }) {
  return (
    <ol className="wl-list" start={start}>
      {lines.map((l) => (
        <li className="wl-line" key={l.key}>
          <div className="wl-line__what">
            <b>{l.what}</b>
            <span className="wl-line__meta">
              {l.date ? <span>{l.date}</span> : null}
              {l.time ? <span>{l.time}</span> : null}
            </span>
          </div>
          <div className="wl-line__num" data-sign={l.change > 0 ? 'up' : l.change < 0 ? 'down' : 'flat'}>
            <b aria-hidden="true">{l.changeText}</b>
            <span className="sr-only">{l.spokenChange}</span>
            {l.after ? <span className="wl-line__after">{l.after}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function WalletPageClient({ proOffer = null, previewCheckout = null }) {
  const { user, refreshSession } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState(EMPTY);
  const [purchase, setPurchase] = useState(null);
  const buying = useRef(false);
  const sequence = useRef(0);

  const load = useCallback(() => {
    const mine = ++sequence.current;
    setState((prev) => (prev.data ? { status: 'refreshing', data: prev.data } : EMPTY));
    return apiGet(WALLET_URL)
      .then((body) => {
        if (mine !== sequence.current) return;
        const data = walletFromResponse(body);
        if (!data) throw new Error('Wallet unavailable');
        setState({ status: 'ready', data });
      })
      .catch(() => {
        if (mine === sequence.current) setState((prev) => ({ status: prev.data ? 'refresh-failed' : 'failed', data: prev.data }));
      });
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    const timer = window.setTimeout(load, 0);
    return () => { window.clearTimeout(timer); sequence.current += 1; };
  }, [userId, load]);

  async function buy(pack) {
    if (!pack || buying.current) return;
    buying.current = true;
    setPurchase({ packId: pack.packId, status: 'working', message: '' });
    try {
      const result = await startWalletPurchase(pack, { ...previewCheckout, prefill: { name: shownName(user?.name, user?.email) || '', email: user?.email } });
      setPurchase({ packId: pack.packId, ...result });
      if (result.status === 'paid') {
        await load();
        Promise.resolve(refreshSession?.({ silent: true })).catch(() => {});
        apiGet('/api/ai/credits').then((body) => {
          const wallet = aiWalletFromResponse(body);
          if (wallet.known) announceWallet(userId, wallet);
        }).catch(() => {});
      }
    } finally {
      buying.current = false;
    }
  }

  const data = state.data;
  const tile = data ? balanceTile(data) : null;
  const split = data ? balanceSplit(data) : null;
  const shown = useCountTo(split?.total ?? null);
  const bridge = data ? proBridge(data, proOffer) : null;
  const cards = data ? packCards(data, purchase ? { [purchase.packId]: purchase } : {}) : [];
  const packsHead = data ? packsIntro(data) : null;
  // The pack the first screen offers: the best value by the real maths, else the first one.
  const lead = cards.find((c) => c.best) || cards[0] || null;
  const costs = data ? priceRows(data, PRICES) : [];
  const lines = data?.history ? data.history.map(historyRow) : null;
  const isPro = data?.plan?.name === 'Pro';
  // The sentences under the figure that the split does not already say: out of credits, unknown, or Pro.
  const low = data ? lowBalanceLine(data, PRICES.fullMock) : null;
  const leadLine = tile && (tile.state === 'zero' || tile.state === 'unknown') ? tile.lines[0] : low;
  const busy = purchase?.status === 'working' || state.status === 'refreshing';
  const paid = purchase?.status === 'paid';

  return (
    <div className="student-page wl" aria-busy={state.status === 'loading' || undefined}>
      <ArenaHead title={WALLET_COPY.title} lede={WALLET_COPY.lede} />

      {state.status === 'loading' ? (
        <section className="wl-hero wl-loading" role="status">
          <p className="wl-hero__name"><CreditMark kind="practice" size={18} />{WALLET_COPY.loading}</p>
          <span className="wl-sk wl-sk--hero" aria-hidden="true" />
          <div className="wl-parts" aria-hidden="true">
            <span className="wl-sk" /><span className="wl-sk" />
          </div>
        </section>
      ) : null}

      {state.status === 'failed' ? (
        <div className="wl-hero wl-failed" role="alert">
          <p>{WALLET_COPY.failed}</p>
          <button type="button" className="wl-key" onClick={load}>{WALLET_COPY.retry}</button>
        </div>
      ) : null}

      {data ? (
        <>
          <section className="wl-hero" data-state={low ? 'low' : split.state} aria-labelledby="wl-balance-h">
            <h2 className="wl-hero__name" id="wl-balance-h"><CreditMark kind="practice" size={18} />{WALLET_COPY.heading}</h2>
            <p className="wl-hero__figure">
              {split.figure !== null ? (
                <>
                  <span className="wl-hero__num" aria-hidden="true">{(shown ?? 0).toLocaleString('en-IN')}</span>
                  <span className="sr-only">{split.figure}</span>
                  <span className="wl-hero__unit">{WALLET_V13_COPY.toSpend}</span>
                </>
              ) : <span className="wl-hero__unknown">{WALLET_COPY.unknown}</span>}
            </p>
            {paid ? <p className="wl-paid" role="status">{purchase.message}</p> : null}
            {state.status === 'refreshing' ? <p className="wl-note" role="status">{WALLET_COPY.refreshing}</p> : null}
            {state.status === 'refresh-failed' ? (
              <div className="wl-balance-note"><p className="wl-note" role="status">{WALLET_COPY.refreshFailed}</p><button type="button" className="wl-key" onClick={load}>{WALLET_COPY.retry}</button></div>
            ) : null}
            {leadLine ? <p className="wl-hero__lead">{leadLine}</p> : null}
            {split.state === 'unknown' && state.status === 'ready' ? <button type="button" className="wl-key wl-retry" onClick={load}>{WALLET_COPY.retry}</button> : null}
            {isPro ? <p className="wl-hero__lead">{WALLET_COPY.proNow(data.plan.until)}</p> : null}

            {split.free || split.kept ? (
              <>
                {split.shares ? (
                  <div className="wl-bar" aria-hidden="true">
                    {split.shares.free > 0 ? <span className="wl-bar__free" style={{ '--share': split.shares.free }} /> : null}
                    {split.shares.kept > 0 ? <span className="wl-bar__kept" style={{ '--share': split.shares.kept }} /> : null}
                  </div>
                ) : null}
                <dl className="wl-parts">
                  {split.free ? (
                    <div className="wl-part" data-part="free">
                      <dt><span className="wl-part__dot" aria-hidden="true" />{WALLET_V13_COPY.freePart}</dt>
                      <dd className="wl-part__num">{split.free.text}<span className="wl-part__of">{split.free.ofText}</span></dd>
                      <dd className="wl-part__note">{split.free.refill || split.free.note}</dd>
                    </div>
                  ) : null}
                  {split.kept ? (
                    <div className="wl-part" data-part="kept">
                      <dt><span className="wl-part__dot" aria-hidden="true" />{WALLET_V13_COPY.keptPart}</dt>
                      <dd className="wl-part__num">{split.kept.text}</dd>
                      <dd className="wl-part__note">{split.kept.note}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="wl-hero__foot">{WALLET_V13_COPY.freeFirst}</p>
              </>
            ) : null}

            {/* 10 Nov app pass: the one next action sits on the first screen, above the dock. Open: the best pack's key (the same
                purchase as its card below). Closed: the honest line, once on the page, and for a Free student the way to practise
                without credits as a quiet second key. */}
            <div className="wl-next">
              {data.commerce.open && lead ? (
                <>
                  <button type="button" className="wl-key wl-next__key" data-solid="" disabled={lead.disabled || busy} onClick={() => buy(data.packs.find((p) => p.packId === lead.packId))}>
                    {lead.status === 'working' ? <span className="wl-spin" aria-hidden="true" /> : null}
                    {lead.status === 'working' ? lead.key : WALLET_V13_COPY.addPack(lead.title, lead.price)}
                  </button>
                  <p className="wl-next__note">{lead.perCredit}{lead.save ? <span className="wl-pack__save">{lead.save}</span> : null}</p>
                  {lead.message && !paid ? <p className="wl-pack__msg" data-tone={lead.status === 'failed' ? 'bad' : 'plain'} role="status">{lead.message}</p> : null}
                </>
              ) : null}
              {!data.commerce.open ? <p className="wl-next__soon">{WALLET_COPY.openSoonNote}</p> : null}
              {!data.commerce.open && bridge ? (
                <p className="wl-next__pro">
                  <span>{WALLET_V13_COPY.practiceUnlimited}</span>
                  <Link href={bridge.href} className="wl-key">{bridge.key}</Link>
                </p>
              ) : null}
            </div>
          </section>

          <section className="wl-costs" aria-labelledby="wl-costs-h">
            <h2 className="wl-h" id="wl-costs-h">{WALLET_V13_COPY.buysTitle}</h2>
            <ul className="wl-costlist">
              {costs.map((row) => (
                <li key={row.key} className="wl-cost" data-included={row.included || undefined}>
                  <span className="wl-cost__what">
                    <b>{row.what}</b>
                    {row.note ? <span>{row.note}</span> : null}
                  </span>
                  <span className="wl-cost__num">{row.cost}</span>
                </li>
              ))}
            </ul>
            <p className="wl-note">{WALLET_V13_COPY.costShows}</p>
          </section>

          {/* Earn before you buy (owner D165): invite a friend and you both get 100 credits. Renders nothing while invites are off. */}
          <InviteFriendCard id="wl-invite" />

          <section className="wl-packs" aria-labelledby="wl-packs-h">
            <div className="wl-packs__head">
              <h2 className="wl-h" id="wl-packs-h">{packsHead.heading}</h2>
              <p className="wl-note">{packsHead.lead}</p>
              {/* 10 Nov app pass: while selling is closed the page says so once, under the balance on the first screen, and the
                  packs carry no key (three greyed-out "Top-ups open soon" keys read as broken buttons). Open, every pack has its key. */}
            </div>
            <ul className="wl-packgrid">
              {cards.map((card) => (
                <li key={card.packId} className="wl-pack" data-best={card.best || undefined}>
                  <div className="wl-pack__top">
                    <b className="wl-pack__credits">{card.title}</b>
                    {card.best ? <span className="wl-pack__tag">{WALLET_V13_COPY.bestValue}</span> : null}
                  </div>
                  <p className="wl-pack__value">{card.worth}</p>
                  <p className="wl-pack__price">
                    <span className="wl-pack__rupees">{card.price}</span>
                    <span className="wl-pack__per">{card.perCredit}{card.save ? <span className="wl-pack__save">{card.save}</span> : null}</span>
                  </p>
                  {data.commerce.open ? (
                    <button
                      type="button"
                      className="wl-key wl-pack__key"
                      data-solid={card.best || undefined}
                      disabled={card.disabled || busy}
                      onClick={() => buy(data.packs.find((p) => p.packId === card.packId))}
                    >
                      {card.status === 'working' ? <span className="wl-spin" aria-hidden="true" /> : null}
                      {card.key}
                    </button>
                  ) : null}
                  {card.status === 'paid' ? <a className="wl-pack__msg wl-balance-link" href="#wl-balance-h">See balance</a> : card.message ? <p className="wl-pack__msg" data-tone={card.status === 'failed' ? 'bad' : 'plain'} role="status">{card.message}</p> : null}
                </li>
              ))}
            </ul>
          </section>

          {bridge ? (
            <section className="wl-pro" aria-labelledby="wl-pro-h">
              <div className="wl-pro__copy">
                <h2 id="wl-pro-h">{bridge.title}</h2>
                <p>{bridge.body}</p>
                {bridge.price ? <p className="wl-pro__price">{bridge.price}</p> : null}
              </div>
              <Link href={bridge.href} className="wl-key wl-pro__key" data-solid="">{bridge.key}</Link>
            </section>
          ) : null}

          <section className="wl-history" aria-labelledby="wl-history-h">
            <h2 className="wl-h" id="wl-history-h">{WALLET_COPY.historyHeading}</h2>
            {lines === null ? (
              <div className="wl-failed" role="alert">
                <p>{WALLET_COPY.historyFailed}</p>
                <button type="button" className="wl-key" onClick={load}>{WALLET_COPY.retry}</button>
              </div>
            ) : lines.length ? (
              <>
                <ActivityRows lines={lines.slice(0, VISIBLE_HISTORY)} />
                {lines.length > VISIBLE_HISTORY ? (
                  <details className="wl-history__more">
                    <summary>
                      <span>Show {lines.length - VISIBLE_HISTORY} older {lines.length - VISIBLE_HISTORY === 1 ? 'entry' : 'entries'}</span>
                      <span>Hide older entries</span>
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    <ActivityRows lines={lines.slice(VISIBLE_HISTORY)} start={VISIBLE_HISTORY + 1} />
                  </details>
                ) : null}
              </>
            ) : (
              <p className="wl-note">{WALLET_COPY.historyEmpty}</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
