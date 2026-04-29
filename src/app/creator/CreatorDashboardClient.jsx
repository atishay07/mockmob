'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Banknote, ClipboardCopy, ExternalLink, ReceiptText, Sparkles, TrendingUp } from 'lucide-react';

const money = (paise) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format((Number(paise) || 0) / 100);

const dateTime = (value) => {
  if (!value) return '-';
  return new Date(Number(value)).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const paidSaleStatuses = new Set(['captured', 'completed', 'paid']);

function isPaidSale(order) {
  return Boolean(order?.paymentId) &&
    paidSaleStatuses.has(order?.status) &&
    Number(order?.amountPaid) > 0;
}

function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
        <Icon className="h-4 w-4 text-volt" />
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {detail ? <div className="mt-1 text-xs text-zinc-500">{detail}</div> : null}
    </div>
  );
}

function EmptyRow({ colSpan, label }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-zinc-500">{label}</td>
    </tr>
  );
}

export default function CreatorDashboardClient({ creator, stats, orders, payouts, baseUrl }) {
  const [copied, setCopied] = useState('');
  const siteBase = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://mockmob.in');
  const referralLink = `${siteBase.replace(/\/$/, '')}/?ref=${creator.code}`;
  const successfulOrders = orders.filter(isPaidSale);

  function copy(text, key) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(''), 1400);
  }

  return (
    <main className="min-h-screen bg-[#07070b] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-volt">
              <Sparkles className="h-4 w-4" />
              <span>Creator Dashboard</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-normal text-white sm:text-3xl">{creator.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">{creator.email || 'Creator account'}</p>
          </div>
          <Link href="/dashboard" className="rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white">
            Dashboard
          </Link>
        </header>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Referral code</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="rounded-md border border-volt/30 bg-volt/10 px-3 py-2 text-lg font-bold text-volt">{creator.code}</code>
                <button
                  type="button"
                  onClick={() => copy(creator.code, 'code')}
                  className="rounded-md border border-white/10 p-2 text-zinc-300 hover:bg-white/10 hover:text-white"
                  title="Copy code"
                >
                  <ClipboardCopy className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{copied === 'code' ? 'Code copied' : `Earning ${money(creator.payoutPerSale)} per sale`}</p>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Referral link</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200">{referralLink}</code>
                <button
                  type="button"
                  onClick={() => copy(referralLink, 'link')}
                  className="rounded-md border border-white/10 p-2 text-zinc-300 hover:bg-white/10 hover:text-white"
                  title="Copy referral link"
                >
                  <ClipboardCopy className="h-4 w-4" />
                </button>
                <a
                  href={referralLink}
                  className="rounded-md border border-white/10 p-2 text-zinc-300 hover:bg-white/10 hover:text-white"
                  title="Open referral link"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{copied === 'link' ? 'Link copied' : 'Share this link with students.'}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={ReceiptText} label="Total sales" value={stats.totalSales || 0} detail="Successful payments" />
          <StatCard icon={TrendingUp} label="Revenue generated" value={money(stats.totalRevenuePaise)} detail="Paid by students" />
          <StatCard icon={Banknote} label="Total earnings" value={money(stats.totalEarningsPaise)} detail="Recorded per sale" />
          <StatCard icon={Banknote} label="Pending payout" value={money(stats.pendingPayoutPaise)} detail="Unpaid earnings" />
          <StatCard icon={Banknote} label="Paid payout" value={money(stats.paidPayoutPaise)} detail="Settled earnings" />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">Sales</h2>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Amount paid</th>
                  <th className="px-3 py-3 font-medium">Earning</th>
                  <th className="px-3 py-3 font-medium">Payout</th>
                </tr>
              </thead>
              <tbody>
                {successfulOrders.length === 0 ? <EmptyRow colSpan={4} label="No successful sales yet." /> : successfulOrders.map((order) => (
                  <tr key={order.id} className="border-t border-white/[0.06]">
                    <td className="px-3 py-3 text-xs text-zinc-400">{dateTime(order.createdAt)}</td>
                    <td className="px-3 py-3 text-white">{money(order.amountPaid)}</td>
                    <td className="px-3 py-3 text-volt">{order.creatorEarning == null ? '-' : money(order.creatorEarning)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs ${order.payoutId ? 'bg-volt/10 text-volt' : 'bg-white/10 text-zinc-300'}`}>
                        {order.payoutId ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">Payout history</h2>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Amount</th>
                  <th className="px-3 py-3 font-medium">Sales bundled</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? <EmptyRow colSpan={4} label="No payouts yet." /> : payouts.map((payout) => (
                  <tr key={payout.id} className="border-t border-white/[0.06]">
                    <td className="px-3 py-3 text-xs text-zinc-400">{dateTime(payout.paidAt || payout.createdAt)}</td>
                    <td className="px-3 py-3 text-white">{money(payout.amount)}</td>
                    <td className="px-3 py-3 text-zinc-300">{payout.paymentCount}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-zinc-300">{payout.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
