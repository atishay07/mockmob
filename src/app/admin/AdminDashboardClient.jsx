'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import {
  Banknote,
  CheckCircle2,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Tag,
  Users,
  X,
} from 'lucide-react';

const zeroStats = (creatorId) => ({
  creatorId,
  totalSales: 0,
  totalRevenuePaise: 0,
  totalEarningsPaise: 0,
  pendingPayoutPaise: 0,
  paidPayoutPaise: 0,
});

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

const referralStatusMeta = {
  offer_attached: { label: 'Discount offer', className: 'bg-volt/10 text-volt' },
  tracked_no_offer: { label: 'Tracked only', className: 'bg-sky-500/10 text-sky-200' },
  inactive: { label: 'Inactive code', className: 'bg-amber-500/10 text-amber-200' },
  unknown: { label: 'Unknown code', className: 'bg-red-500/10 text-red-200' },
  none: { label: 'No referral', className: 'bg-white/10 text-zinc-400' },
};

function ReferralStatusBadge({ status }) {
  const meta = referralStatusMeta[status || 'none'] || referralStatusMeta.none;
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
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

function SectionHeader({ title, action }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {action}
    </div>
  );
}

function CreateCreatorForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    code: '',
    offerId: '',
    payoutRupees: '20',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const response = await fetch('/api/admin/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          code: form.code.trim().toLowerCase(),
          offerId: form.offerId.trim() || null,
          payoutPerSale: Math.max(0, Math.round((Number(form.payoutRupees) || 0) * 100)),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Creator could not be created');
        return;
      }
      onCreated(data.creator);
    } catch (err) {
      setError(err?.message || 'Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">Create creator</h3>
        <button type="button" onClick={onCancel} className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">Name</span>
          <input className="input" required value={form.name} onChange={(e) => update('name', e.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">Email</span>
          <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">Code</span>
          <input
            className="input"
            required
            maxLength={64}
            value={form.code}
            onChange={(e) => update('code', e.target.value.toLowerCase().replace(/\s/g, ''))}
            placeholder="creator-code"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">Razorpay offer_id</span>
          <input className="input" value={form.offerId} onChange={(e) => update('offerId', e.target.value.trim())} placeholder="offer_xxxxxxxx" />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">Payout per sale (INR)</span>
          <input className="input" type="number" min="0" step="1" value={form.payoutRupees} onChange={(e) => update('payoutRupees', e.target.value)} />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="btn-volt inline-flex items-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

function EmptyRow({ colSpan, label }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-zinc-500">{label}</td>
    </tr>
  );
}

export default function AdminDashboardClient({ adminEmail, initialData }) {
  const [overview, setOverview] = useState(initialData.overview);
  const [creators, setCreators] = useState(initialData.creators);
  const [orders, setOrders] = useState(initialData.orders);
  const [pendingPayouts, setPendingPayouts] = useState(initialData.pendingPayouts);
  const [payoutHistory, setPayoutHistory] = useState(initialData.payoutHistory);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCreatorId, setEditingCreatorId] = useState('');
  const [creatorDraft, setCreatorDraft] = useState({});
  const [orderFilter, setOrderFilter] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  async function refreshData() {
    const [overviewRes, creatorsRes, ordersRes, payoutsRes] = await Promise.all([
      fetch('/api/admin/overview'),
      fetch('/api/admin/creators'),
      fetch('/api/admin/orders?limit=100'),
      fetch('/api/admin/payouts'),
    ]);

    const [overviewData, creatorsData, ordersData, payoutsData] = await Promise.all([
      overviewRes.json().catch(() => ({})),
      creatorsRes.json().catch(() => ({})),
      ordersRes.json().catch(() => ({})),
      payoutsRes.json().catch(() => ({})),
    ]);

    if (overviewRes.ok) setOverview(overviewData.overview);
    if (creatorsRes.ok) setCreators(creatorsData.creators || []);
    if (ordersRes.ok) setOrders(ordersData.orders || []);
    if (payoutsRes.ok) {
      setPendingPayouts(payoutsData.pending || []);
      setPayoutHistory(payoutsData.history || []);
    }
  }

  async function toggleCreator(creator) {
    setBusyId(creator.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/creators/${creator.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !creator.isActive }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Creator could not be updated');
        return;
      }
      setCreators((current) => current.map((row) => (
        row.id === creator.id ? { ...row, ...data.creator, stats: row.stats || zeroStats(row.id) } : row
      )));
    } finally {
      setBusyId('');
    }
  }

  function beginEditCreator(creator) {
    setEditingCreatorId(creator.id);
    setCreatorDraft({
      name: creator.name || '',
      email: creator.email || '',
      code: creator.code || '',
      offerId: creator.offerId || '',
      payoutRupees: String((Number(creator.payoutPerSale) || 0) / 100),
      notes: creator.notes || '',
    });
  }

  async function saveCreator(creator) {
    setBusyId(creator.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/creators/${creator.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: creatorDraft.name?.trim(),
          email: creatorDraft.email?.trim() || null,
          code: creatorDraft.code?.trim().toLowerCase(),
          offerId: creatorDraft.offerId?.trim() || null,
          payoutPerSale: Math.max(0, Math.round((Number(creatorDraft.payoutRupees) || 0) * 100)),
          notes: creatorDraft.notes?.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Creator could not be updated');
        return;
      }
      setCreators((current) => current.map((row) => (
        row.id === creator.id ? { ...row, ...data.creator, stats: row.stats || zeroStats(row.id) } : row
      )));
      setEditingCreatorId('');
      setCreatorDraft({});
    } finally {
      setBusyId('');
    }
  }

  async function markPaid(row) {
    const ok = window.confirm(`Mark ${money(row.pendingPaise)} as paid to ${row.creator?.name || row.creatorId}?`);
    if (!ok) return;

    setBusyId(row.creatorId);
    setError('');
    try {
      const response = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: row.creatorId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Payout could not be marked as paid');
        return;
      }
      await refreshData();
    } finally {
      setBusyId('');
    }
  }

  function handleCreated(creator) {
    setShowCreate(false);
    setCreators((current) => [{ ...creator, stats: zeroStats(creator.id) }, ...current]);
    setOverview((current) => ({
      ...current,
      totalCreators: (current?.totalCreators || 0) + 1,
      activeCreators: (current?.activeCreators || 0) + (creator.isActive ? 1 : 0),
    }));
  }

  const filteredOrders = orders.filter((order) => {
    const needle = orderFilter.trim().toLowerCase();
    if (!needle) return true;
    return [
      order.creatorCode,
      order.referralCodeAttempted,
      order.referralStatus,
      order.paymentId,
      order.subscriptionId,
      order.userId,
    ].some((value) => String(value || '').toLowerCase().includes(needle));
  });

  return (
    <main className="min-h-screen bg-[#07070b] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-volt">
              <ShieldCheck className="h-4 w-4" />
              <span>Admin Dashboard</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-normal text-white sm:text-3xl">Referral and payouts</h1>
            <p className="mt-1 text-sm text-zinc-500">{adminEmail}</p>
          </div>
          <Link href="/dashboard" className="rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white">
            Dashboard
          </Link>
        </header>

        {error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Banknote} label="Total revenue" value={money(overview?.totalRevenuePaise)} detail={`${overview?.totalSales || 0} sales`} />
          <StatCard icon={ReceiptText} label="Total sales" value={overview?.totalSales || 0} detail="Successful payments" />
          <StatCard icon={Users} label="Total creators" value={overview?.totalCreators || 0} detail={`${overview?.activeCreators || 0} active`} />
          <StatCard icon={CheckCircle2} label="Total payouts due" value={money(overview?.pendingPayoutPaise)} detail="Unpaid creator earnings" />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Tag} label="Referral attempts" value={overview?.referralAttempts || 0} detail="All checkout code entries" />
          <StatCard icon={CheckCircle2} label="Attributed referrals" value={overview?.attributedReferrals || 0} detail="Linked to a creator" />
          <StatCard icon={RefreshCw} label="Tracked without offer" value={overview?.trackedNoOfferReferrals || 0} detail="No Razorpay discount needed" />
          <StatCard icon={Search} label="Invalid attempts" value={overview?.invalidReferralAttempts || 0} detail="Unknown or inactive codes" />
        </section>

        <section>
          <SectionHeader
            title="Creator management"
            action={(
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 rounded-md border border-volt/30 bg-volt/10 px-3 py-2 text-sm font-semibold text-volt hover:bg-volt/20"
              >
                <Plus className="h-4 w-4" />
                Create creator
              </button>
            )}
          />
          {showCreate ? <CreateCreatorForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} /> : null}

          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Code</th>
                  <th className="px-3 py-3 font-medium">Sales</th>
                  <th className="px-3 py-3 font-medium">Revenue</th>
                  <th className="px-3 py-3 font-medium">Total earnings</th>
                  <th className="px-3 py-3 font-medium">Payout due</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Offer</th>
                  <th className="px-3 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {creators.length === 0 ? <EmptyRow colSpan={9} label="No creators yet." /> : creators.map((creator) => {
                  const stats = creator.stats || zeroStats(creator.id);
                  const isEditing = editingCreatorId === creator.id;
                  return (
                    <Fragment key={creator.id}>
                      <tr className="border-t border-white/[0.06]">
                        <td className="px-3 py-3">
                          <div className="font-medium text-white">{creator.name}</div>
                          <div className="text-xs text-zinc-500">{creator.email || '-'}</div>
                        </td>
                        <td className="px-3 py-3"><code className="rounded bg-white/10 px-2 py-1 text-xs">{creator.code}</code></td>
                        <td className="px-3 py-3 text-zinc-300">{stats.totalSales}</td>
                        <td className="px-3 py-3 text-zinc-300">{money(stats.totalRevenuePaise)}</td>
                        <td className="px-3 py-3 text-zinc-300">{money(stats.totalEarningsPaise)}</td>
                        <td className="px-3 py-3 text-volt">{money(stats.pendingPayoutPaise)}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs ${creator.isActive ? 'bg-volt/10 text-volt' : 'bg-white/10 text-zinc-400'}`}>
                            {creator.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <code className="text-xs text-zinc-400">{creator.offerId || 'Tracked only'}</code>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => beginEditCreator(creator)}
                              className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/10"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCreator(creator)}
                              disabled={busyId === creator.id}
                              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/10 disabled:opacity-50"
                            >
                              {busyId === creator.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : creator.isActive ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
                              {creator.isActive ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isEditing ? (
                        <tr className="border-t border-white/[0.06] bg-white/[0.025]">
                          <td colSpan={9} className="px-3 py-4">
                            <div className="grid gap-3 md:grid-cols-3">
                              <input className="input" value={creatorDraft.name || ''} onChange={(e) => setCreatorDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Name" />
                              <input className="input" type="email" value={creatorDraft.email || ''} onChange={(e) => setCreatorDraft((d) => ({ ...d, email: e.target.value }))} placeholder="Email" />
                              <input className="input" value={creatorDraft.code || ''} onChange={(e) => setCreatorDraft((d) => ({ ...d, code: e.target.value.toLowerCase().replace(/\s/g, '') }))} placeholder="Code" />
                              <input className="input" value={creatorDraft.offerId || ''} onChange={(e) => setCreatorDraft((d) => ({ ...d, offerId: e.target.value.trim() }))} placeholder="Razorpay offer_id (optional)" />
                              <input className="input" type="number" min="0" step="1" value={creatorDraft.payoutRupees || '0'} onChange={(e) => setCreatorDraft((d) => ({ ...d, payoutRupees: e.target.value }))} placeholder="Payout INR" />
                              <input className="input" value={creatorDraft.notes || ''} onChange={(e) => setCreatorDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Internal notes" />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button" onClick={() => saveCreator(creator)} disabled={busyId === creator.id} className="btn-volt inline-flex items-center gap-2">
                                {busyId === creator.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save creator
                              </button>
                              <button type="button" onClick={() => setEditingCreatorId('')} className="btn-ghost">Cancel</button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <SectionHeader
            title="Referral and payment ledger"
            action={(
              <label className="relative block min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  className="input w-full pl-9"
                  value={orderFilter}
                  onChange={(event) => setOrderFilter(event.target.value)}
                  placeholder="Search code, user, payment"
                />
              </label>
            )}
          />
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Referral</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Amount paid</th>
                  <th className="px-3 py-3 font-medium">Creator earning</th>
                  <th className="px-3 py-3 font-medium">Payment status</th>
                  <th className="px-3 py-3 font-medium">Payment id</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? <EmptyRow colSpan={8} label="No matching orders yet." /> : filteredOrders.map((order) => (
                  <tr key={order.id} className="border-t border-white/[0.06]">
                    <td className="px-3 py-3 text-xs text-zinc-400">{dateTime(order.createdAt)}</td>
                    <td className="px-3 py-3"><code className="text-xs text-zinc-400">{order.userId || '-'}</code></td>
                    <td className="px-3 py-3">
                      <code className="text-xs text-zinc-300">{order.referralCodeAttempted || order.creatorCode || '-'}</code>
                      {order.referralReason ? <div className="mt-1 text-xs text-zinc-500">{order.referralReason}</div> : null}
                    </td>
                    <td className="px-3 py-3"><ReferralStatusBadge status={order.referralStatus} /></td>
                    <td className="px-3 py-3 text-white">{order.amountPaid == null ? '-' : money(order.amountPaid)}</td>
                    <td className="px-3 py-3 text-volt">{order.creatorEarning == null ? '-' : money(order.creatorEarning)}</td>
                    <td className="px-3 py-3"><span className="rounded-full bg-white/10 px-2 py-1 text-xs text-zinc-300">{order.status || '-'}</span></td>
                    <td className="px-3 py-3"><code className="text-xs text-zinc-500">{order.paymentId || '-'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div>
            <SectionHeader title="Pending payouts" />
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-3 font-medium">Creator</th>
                    <th className="px-3 py-3 font-medium">Amount</th>
                    <th className="px-3 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPayouts.length === 0 ? <EmptyRow colSpan={3} label="No pending payouts." /> : pendingPayouts.map((row) => (
                    <tr key={row.creatorId} className="border-t border-white/[0.06]">
                      <td className="px-3 py-3">
                        <div className="font-medium text-white">{row.creator?.name || row.creatorId}</div>
                        <code className="text-xs text-zinc-500">{row.creator?.code || '-'}</code>
                      </td>
                      <td className="px-3 py-3 text-volt">{money(row.pendingPaise)}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => markPaid(row)}
                          disabled={busyId === row.creatorId}
                          className="inline-flex items-center gap-1.5 rounded-md border border-volt/30 bg-volt/10 px-2.5 py-1.5 text-xs font-semibold text-volt hover:bg-volt/20 disabled:opacity-50"
                        >
                          {busyId === row.creatorId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
                          Mark as paid
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <SectionHeader title="Payout history" />
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Creator</th>
                    <th className="px-3 py-3 font-medium">Amount</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutHistory.length === 0 ? <EmptyRow colSpan={4} label="No payouts yet." /> : payoutHistory.map((payout) => (
                    <tr key={payout.id} className="border-t border-white/[0.06]">
                      <td className="px-3 py-3 text-xs text-zinc-400">{dateTime(payout.paidAt || payout.createdAt)}</td>
                      <td className="px-3 py-3 text-zinc-300">{payout.creator?.name || payout.creatorId}</td>
                      <td className="px-3 py-3 text-white">{money(payout.amount)}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-zinc-300">{payout.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
