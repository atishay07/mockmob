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
import ArenaHead from '@/components/arena/ArenaHead';
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
  WALLET_COPY, WALLET_V13_COPY, WALLET_URL, balanceSplit, balanceTile, historyRow, packCards, packsIntro, priceRows, proBridge, walletFromResponse,
} from '@/components/wallet/walletModel.mjs';
import './wallet.css';

const EMPTY = { status: 'loading', data: null };
const PRICES = Object.freeze({ question: PRACTICE_PRICE.perQuestion, fullMock: PRACTICE_PRICE.full, reply: 1, repair: REPAIR_CREDIT_COST, firstMockFree: FIRST_FULL_MOCK_ON });

function reducedMotion() {
  if (typeof window === 'undefined') return true;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// The balance counts to its value (600 ms, ease-out) when it first arrives and whenever it changes, e.g. after a top-up.
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
      const p = Math.min(1, (now - t0) / 600);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return target === null ? null : shown;
}

export default function WalletPageClient({ proOffer = null }) {
  const { user, refreshSession } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState(EMPTY);
  const [phases, setPhases] = useState({});
  const sequence = useRef(0);

  const load = useCallback(() => {
    const mine = ++sequence.current;
    setState((prev) => (prev.data ? prev : EMPTY));
    return apiGet(WALLET_URL)
      .then((body) => {
        if (mine !== sequence.current) return;
        const data = walletFromResponse(body);
        setState(data ? { status: 'ready', data } : { status: 'failed', data: null });
      })
      .catch(() => { if (mine === sequence.current) setState((prev) => (prev.data ? prev : { status: 'failed', data: null })); });
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    const timer = window.setTimeout(load, 0);
    return () => { window.clearTimeout(timer); sequence.current += 1; };
  }, [userId, load]);

  const setPhase = (packId, phase) => setPhases((prev) => ({ ...prev, [packId]: phase }));

  async function buy(pack) {
    setPhase(pack.packId, { status: 'working', message: '' });
    const result = await startWalletPurchase(pack, { prefill: { name: shownName(user?.name, user?.email) || '', email: user?.email } });
    setPhase(pack.packId, { status: result.status === 'paid' ? 'paid' : result.status === 'dismissed' ? 'idle' : result.status, message: result.message });
    if (result.status === 'paid') {
      // Both balances come from the server again, and the top bar chips take them at once.
      await load();
      refreshSession?.({ silent: true });
      try {
        const body = await apiGet('/api/ai/credits');
        const wallet = aiWalletFromResponse(body);
        if (wallet.known) announceWallet(userId, wallet);
      } catch { /* the chip catches up on its next read */ }
    }
  }

  const data = state.data;
  const tile = data ? balanceTile(data) : null;
  const split = data ? balanceSplit(data) : null;
  const shown = useCountTo(split?.total ?? null);
  const bridge = data ? proBridge(data, proOffer) : null;
  const cards = data ? packCards(data, phases) : [];
  const packsHead = data ? packsIntro(data) : null;
  const costs = data ? priceRows(data, PRICES) : [];
  const lines = data?.history ? data.history.map(historyRow) : null;
  const isPro = data?.plan?.name === 'Pro';
  // The sentences under the figure that the split does not already say: out of credits, unknown, or Pro.
  const leadLine = tile && (tile.state === 'zero' || tile.state === 'unknown') ? tile.lines[0] : null;

  return (
    <div className="student-page wl" aria-busy={state.status === 'loading' || undefined}>
      <ArenaHead title={WALLET_COPY.title} lede={WALLET_COPY.lede} />

      {state.status === 'loading' ? (
        <div className="wl-loading" role="status" aria-label={WALLET_COPY.loading}>
          <span className="wl-sk wl-sk--hero skeleton" aria-hidden="true" />
          <span className="wl-sk skeleton" aria-hidden="true" />
        </div>
      ) : null}

      {state.status === 'failed' ? (
        <div className="wl-failed" role="alert">
          <p>{WALLET_COPY.failed}</p>
          <button type="button" className="wl-key" onClick={load}>{WALLET_COPY.retry}</button>
        </div>
      ) : null}

      {data ? (
        <>
          <section className="wl-hero" data-state={split.state} aria-labelledby="wl-balance-h">
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
            {leadLine ? <p className="wl-hero__lead">{leadLine}</p> : null}
            {isPro ? <p className="wl-hero__lead">{WALLET_COPY.proNow(data.plan.until)}</p> : null}

            {split.free || split.kept ? (
              <>
                {split.shares ? (
                  <div className="wl-bar" aria-hidden="true">
                    <span className="wl-bar__free" style={{ '--share': split.shares.free }} />
                    <span className="wl-bar__kept" style={{ '--share': split.shares.kept }} />
                  </div>
                ) : null}
                <dl className="wl-parts">
                  {split.free ? (
                    <div className="wl-part" data-part="free">
                      <dt><span className="wl-part__dot" aria-hidden="true" />{WALLET_V13_COPY.freePart}</dt>
                      <dd className="wl-part__num">{split.free.text}</dd>
                      <dd className="wl-part__note">{split.free.note}</dd>
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

          <section className="wl-packs" aria-labelledby="wl-packs-h">
            <div className="wl-packs__head">
              <h2 className="wl-h" id="wl-packs-h">{packsHead.heading}</h2>
              <p className="wl-note">{packsHead.lead}</p>
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
                  <button
                    type="button"
                    className="wl-key wl-pack__key"
                    data-solid={card.best || undefined}
                    disabled={card.disabled}
                    onClick={() => buy(data.packs.find((p) => p.packId === card.packId))}
                  >
                    {card.status === 'working' ? <span className="wl-spin" aria-hidden="true" /> : null}
                    {card.key}
                  </button>
                  {card.message ? <p className="wl-pack__msg" data-tone={card.status === 'paid' ? 'good' : card.status === 'failed' ? 'bad' : 'plain'} role="status">{card.message}</p> : null}
                </li>
              ))}
            </ul>
            {!data.commerce.open ? <p className="wl-note">{WALLET_COPY.openSoonNote}</p> : null}
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
              <ol className="wl-list">
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
            ) : (
              <p className="wl-note">{WALLET_COPY.historyEmpty}</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
