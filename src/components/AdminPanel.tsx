import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  CreditCard,
  ShieldAlert,
  Ticket,
  Tag,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MEMBERSHIP_PLANS } from '../data/studioCatalog';
import type {
  MembershipPlan,
  PaymentRecord,
  PlanId,
  PromoCode,
  SupportTicket,
  UserProfile,
  VideoProject,
} from '../types/clipverse';

interface AdminPanelProps {
  plans: MembershipPlan[];
  onPlansUpdated: () => void;
}

type AdminTab = 'payments' | 'users' | 'plans' | 'promos' | 'tickets' | 'jobs';

export const AdminPanel: React.FC<AdminPanelProps> = ({ plans, onPlansUpdated }) => {
  const [tab, setTab] = useState<AdminTab>('payments');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProjects: 0,
    totalExports: 0,
    pendingPayments: 0,
    totalRevenueInr: 0,
  });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);

  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoPct, setNewPromoPct] = useState(25);
  const [ticketReplies, setTicketReplies] = useState<Record<string, string>>({});

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersSnap, paymentsSnap, projectsSnap, exportsSnap, ticketsSnap, promosSnap] =
        await Promise.all([
          getDocs(query(collection(db, 'users'), limit(100))),
          getDocs(query(collection(db, 'payments'), limit(100))),
          getDocs(query(collection(db, 'projects'), limit(100))),
          getDocs(query(collection(db, 'exports'), limit(100))),
          getDocs(query(collection(db, 'tickets'), limit(100))),
          getDocs(collection(db, 'promoCodes')),
        ]);

      const usersList = usersSnap.docs.map((d) => ({ ...(d.data() as UserProfile), uid: d.id }));
      const paymentsList = paymentsSnap.docs.map((d) => ({
        ...(d.data() as PaymentRecord),
        id: d.id,
      }));
      const projectsList = projectsSnap.docs.map((d) => ({
        ...(d.data() as VideoProject),
        id: d.id,
      }));
      const ticketsList = ticketsSnap.docs.map((d) => ({
        ...(d.data() as SupportTicket),
        id: d.id,
      }));
      const promosList = promosSnap.docs.map((d) => ({ ...(d.data() as PromoCode), id: d.id }));

      const totalRevenueInr = paymentsList
        .filter((p) => p.status === 'verified')
        .reduce((acc, p) => acc + Number(p.amountInr || 0), 0);

      setStats({
        totalUsers: usersList.length,
        totalProjects: projectsList.length,
        totalExports: exportsSnap.size,
        pendingPayments: paymentsList.filter((p) => p.status === 'awaiting_verification').length,
        totalRevenueInr,
      });
      setUsers(usersList);
      setPayments(paymentsList);
      setProjects(projectsList);
      setTickets(ticketsList);
      setPromos(promosList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin data error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleVerifyPayment = async (pay: PaymentRecord, decision: 'verify' | 'reject') => {
    try {
      if (decision === 'reject') {
        await updateDoc(doc(db, 'payments', pay.id), {
          status: 'rejected',
          verifiedAt: new Date().toISOString(),
        });
      } else {
        const planDef = MEMBERSHIP_PLANS.find((p) => p.id === pay.plan) || MEMBERSHIP_PLANS[1];
        const expiresAt = new Date(Date.now() + planDef.durationDays * 86400 * 1000).toISOString();
        await updateDoc(doc(db, 'payments', pay.id), {
          status: 'verified',
          verifiedAt: new Date().toISOString(),
        });
        await updateDoc(doc(db, 'users', pay.userId), {
          plan: planDef.id,
          planExpiresAt: expiresAt,
          credits: increment(planDef.dailyProjectsLimit * 10),
          updatedAt: serverTimestamp(),
        });
      }
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment reconciliation failed.');
    }
  };

  const handleUpdateUser = async (
    uid: string,
    patch: { plan?: PlanId; credits?: number; status?: 'active' | 'suspended' }
  ) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'User update failed.');
    }
  };

  const handleUpdatePlanLimit = async (
    plan: MembershipPlan,
    dailyProjectsLimit: number,
    dailyMinutesLimit: number
  ) => {
    try {
      await setDoc(
        doc(db, 'plans', plan.id),
        {
          ...plan,
          dailyProjectsLimit,
          dailyMinutesLimit,
        },
        { merge: true }
      );
      onPlansUpdated();
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan update failed.');
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newPromoCode.trim().toUpperCase();
    if (!cleanCode) return;
    try {
      await setDoc(doc(db, 'promoCodes', cleanCode), {
        id: cleanCode,
        code: cleanCode,
        discountPercent: Math.max(5, Math.min(90, Number(newPromoPct || 20))),
        active: true,
        usesCount: 0,
      });
      setNewPromoCode('');
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Promo creation failed.');
    }
  };

  const handleReplyTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        adminReply: ticketReplies[ticketId] || 'Resolved by CLIPVERSE Admin.',
        status: 'resolved',
        updatedAt: serverTimestamp(),
      });
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ticket update failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Admin Operations Console</h2>
          <p className="text-xs text-slate-500">
            Reconcile UPI payments, configure free limits, manage users, promo codes, and support tickets.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOverview}
          disabled={loading}
          className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Revenue', val: `₹${stats.totalRevenueInr.toLocaleString('en-IN')}` },
          { label: 'Pending UPI Reviews', val: String(stats.pendingPayments) },
          { label: 'Registered Creators', val: String(stats.totalUsers) },
          { label: 'Video Projects', val: String(stats.totalProjects) },
          { label: 'MP4 Exports', val: String(stats.totalExports) },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] text-slate-500">{kpi.label}</div>
            <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">{kpi.val}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-100 rounded-xl w-fit max-w-full">
        {[
          { id: 'payments', label: 'UPI Reconciliation', icon: CreditCard },
          { id: 'users', label: 'Users & Credits', icon: Users },
          { id: 'plans', label: 'Free Limits & Plans', icon: ShieldAlert },
          { id: 'promos', label: 'Promo Codes', icon: Tag },
          { id: 'tickets', label: 'Support Tickets', icon: Ticket },
          { id: 'jobs', label: 'Processing Jobs', icon: RefreshCw },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as AdminTab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                tab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'payments' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">UTR Number</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-mono">{p.referenceId}</td>
                  <td className="px-4 py-3 text-slate-600">{p.userEmail || p.userId}</td>
                  <td className="px-4 py-3 font-semibold">{p.plan}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">₹{p.amountInr}</td>
                  <td className="px-4 py-3 font-mono">{p.utrNumber || '—'}</td>
                  <td className="px-4 py-3 capitalize">{p.status.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {p.status !== 'verified' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleVerifyPayment(p, 'verify')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Verify &amp; Activate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerifyPayment(p, 'reject')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-[11px] font-semibold hover:bg-red-50 cursor-pointer"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No UPI transactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'users' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-medium">Creator</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.uid}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{u.displayName}</div>
                    <div className="text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.plan}
                      onChange={(e) => handleUpdateUser(u.uid, { plan: e.target.value as PlanId })}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    >
                      {['FREE', 'STARTER', 'PRO', 'ULTIMATE', 'YEARLY'].map((pl) => (
                        <option key={pl} value={pl}>{pl}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">{u.credits}</td>
                  <td className="px-4 py-3 capitalize">{u.status}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleUpdateUser(u.uid, { credits: Number(u.credits || 0) + 50 })}
                      className="px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold cursor-pointer"
                    >
                      +50 Credits
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateUser(u.uid, { status: u.status === 'active' ? 'suspended' : 'active' })
                      }
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                    >
                      {u.status === 'active' ? 'Suspend' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((pl) => (
            <div key={pl.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-slate-900">{pl.name} ({pl.id})</div>
                <span className="font-mono text-xs text-blue-600 tabular-nums">₹{pl.priceInr}</span>
              </div>
              <div className="text-xs text-slate-600 tabular-nums">
                Daily Projects: {pl.dailyProjectsLimit} · Daily Minutes: {pl.dailyMinutesLimit}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdatePlanLimit(pl, pl.dailyProjectsLimit + 5, pl.dailyMinutesLimit + 15)
                  }
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 cursor-pointer"
                >
                  +5 Daily Projects / +15m
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'promos' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <form onSubmit={handleCreatePromo} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              required
              value={newPromoCode}
              onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
              placeholder="PROMO CODE"
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-blue-600"
            />
            <input
              type="number"
              min={5}
              max={90}
              value={newPromoPct}
              onChange={(e) => setNewPromoPct(Number(e.target.value))}
              className="w-24 px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
            >
              Create Promo
            </button>
          </form>

          <div className="divide-y divide-slate-100">
            {promos.map((pr) => (
              <div key={pr.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-bold text-slate-900">{pr.code}</span>
                  <span className="text-slate-500 ml-2">{pr.discountPercent}% off · {pr.usesCount} uses</span>
                </div>
                <span className={pr.active ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                  {pr.active ? 'Active' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
              No open support tickets.
            </div>
          ) : (
            tickets.map((tk) => (
              <div key={tk.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">{tk.subject}</span>
                  <span className="capitalize font-medium text-blue-600">{tk.status}</span>
                </div>
                <div className="text-xs text-slate-500">{tk.userEmail}</div>
                <p className="text-xs text-slate-700">{tk.message}</p>
                {tk.status !== 'resolved' && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={ticketReplies[tk.id] || ''}
                      onChange={(e) => setTicketReplies({ ...ticketReplies, [tk.id]: e.target.value })}
                      placeholder="Write admin reply..."
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleReplyTicket(tk.id)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                    >
                      Reply &amp; Resolve
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'jobs' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-medium">Project Title</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((pr) => (
                <tr key={pr.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{pr.title}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono">{pr.userId}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{pr.durationSec}s</td>
                  <td className="px-4 py-3 capitalize">{pr.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
