"use client";

// Wallet (/wallet): ONE credits balance (owner D78: free credits left this month plus the credits you hold), what a credit buys,
// one set of reload packs, a Pro row for Free students and the last 20 lines of activity. Reads GET /api/wallet once (and again after a
// purchase). Every pack key calls the one client function startWalletPurchase. While top-ups are closed (WALLET_COMMERCE_OPEN) the packs
// show their prices and the key says "Top-ups open soon"; no order is made. All the words and numbers come from walletModel.mjs,
// which a test holds. No lime on this page, so the shell's Start key stays the viewport's one lime key.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ArenaHead from '@/components/arena/ArenaHead';
import { CreditMark } from '@/components/ui/Glyph';
import { useAuth } from '@/components/AuthProvider';
import { apiGet } from '@/lib/fetcher';
import { startWalletPurchase } from '@/lib/wallet/startWalletPurchase';
import { announceWallet } from '@/components/useWalletSummary';
import { walletFromResponse as aiWalletFromResponse } from '@/services/credits/aiWalletState';
import {
  WALLET_COPY, WALLET_URL, balanceTile, historyRow, packRows, proRow, walletFromResponse,
} from '@/components/wallet/walletModel.mjs';
import './wallet.css';

const EMPTY = { status: 'loading', data: null };

export default function WalletPageClient() {
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
    const result = await startWalletPurchase(pack, { prefill: { name: user?.name, email: user?.email } });
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
  const pro = data ? proRow(data) : null;
  const rows = data ? packRows(data, phases) : [];
  const lines = data?.history ? data.history.map(historyRow) : null;

  return (
    <div className="student-page wl" aria-busy={state.status === 'loading' || undefined}>
      <ArenaHead title={WALLET_COPY.title} lede={WALLET_COPY.lede} />

      {state.status === 'loading' ? (
        <div className="wl-cols" role="status" aria-label={WALLET_COPY.loading}>
          <span className="wl-sk skeleton" aria-hidden="true" />
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
          <div className="wl-cols">
            <section className="wl-col" aria-labelledby="wl-balance-h">
              <div className="wl-bal" data-state={tile.state}>
                <h2 className="wl-bal__name" id="wl-balance-h"><CreditMark kind="practice" size={18} />{WALLET_COPY.heading}</h2>
                <p className="wl-bal__figure">{tile.figure ?? <span className="wl-bal__unknown">{WALLET_COPY.unknown}</span>}</p>
                {tile.lines.map((text) => <p className="wl-bal__line" key={text}>{text}</p>)}
              </div>
            </section>

            <section className="wl-col" aria-labelledby="wl-packs-h">
              <div className="wl-packs">
                <h2 className="wl-packs__h" id="wl-packs-h">{WALLET_COPY.packsHeading}</h2>
                <ul className="wl-packlist">
                  {rows.map((row) => (
                    <li key={row.packId} className="wl-pack" data-featured={row.featured || undefined}>
                      <div className="wl-pack__what">
                        <b>{row.title}{row.featured ? <span className="wl-pack__tag">{row.featuredLabel}</span> : null}</b>
                        <span>{row.value}</span>
                      </div>
                      <div className="wl-pack__buy">
                        <span className="wl-pack__price">{row.price}</span>
                        <button
                          type="button"
                          className="wl-key"
                          data-solid={row.featured || undefined}
                          disabled={row.disabled}
                          onClick={() => buy(data.packs.find((p) => p.packId === row.packId))}
                        >
                          {row.key}
                        </button>
                      </div>
                      {row.message ? <p className="wl-pack__msg" data-tone={row.status === 'paid' ? 'good' : 'plain'} role="status">{row.message}</p> : null}
                    </li>
                  ))}
                </ul>
                {!data.commerce.open ? <p className="wl-note">{WALLET_COPY.openSoonNote}</p> : null}
              </div>
            </section>
          </div>

          {pro ? (
            <p className="wl-pro">
              <span>{pro.text}</span>
              <Link href={pro.href} className="wl-link">{pro.link}</Link>
            </p>
          ) : null}

          <section className="wl-history" aria-labelledby="wl-history-h">
            <h2 id="wl-history-h">{WALLET_COPY.historyHeading}</h2>
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
