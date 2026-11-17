import React, { useState } from 'react';
import {
  Check,
  QrCode,
  ShieldCheck,
  ExternalLink,
  Clock,
  AlertCircle,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  MembershipPlan,
  PaymentRecord,
  PlanId,
  UserProfile,
} from '../types/clipverse';

interface MembershipUpiPanelProps {
  plans: MembershipPlan[];
  userProfile: UserProfile | null;
  payments: PaymentRecord[];
  authToken: string | null;
  onRequireAuth: () => void;
  onPaymentCreated: () => void;
}

const UPI_APPS: Array<PaymentRecord['upiApp']> = ['Google Pay', 'PhonePe', 'Paytm', 'Other UPI'];

export const MembershipUpiPanel: React.FC<MembershipUpiPanelProps> = ({
  plans,
  userProfile,
  payments,
  authToken,
  onRequireAuth,
  onPaymentCreated,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanId, 'FREE'> | null>(null);
  const [upiApp, setUpiApp] = useState<PaymentRecord['upiApp']>('Google Pay');
  const [promoCode, setPromoCode] = useState('');
  const [activeIntent, setActiveIntent] = useState<PaymentRecord | null>(null);
  const [utrInput, setUtrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const currentPlanId: PlanId = userProfile?.plan || 'FREE';

  const handleStartCheckout = async (planId: Exclude<PlanId, 'FREE'>) => {
    if (!authToken || !userProfile) {
      onRequireAuth();
      return;
    }
    setSelectedPlan(planId);
    setError('');
    setNotice('');
    setLoading(true);
    try {
      let discountPercent = 0;
      const cleanPromo = promoCode.trim().toUpperCase();
      if (cleanPromo) {
        try {
          const promoSnap = await getDoc(doc(db, 'promoCodes', cleanPromo));
          if (promoSnap.exists() && promoSnap.data()?.active) {
            discountPercent = Number(promoSnap.data()?.discountPercent || 0);
          }
        } catch {
          // ignore invalid promo lookup
        }
      }

      const res = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ planId, upiApp, promoCode: cleanPromo, discountPercent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not initialize UPI payment.');

      const paymentObj = data.payment as PaymentRecord;
      await setDoc(doc(db, 'payments', paymentObj.id), {
        id: paymentObj.id,
        userId: userProfile.uid,
        userEmail: userProfile.email,
        plan: paymentObj.plan,
        amountInr: paymentObj.amountInr,
        upiApp: paymentObj.upiApp,
        referenceId: paymentObj.referenceId,
        utrNumber: '',
        promoCode: paymentObj.promoCode || '',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setActiveIntent(paymentObj);
      onPaymentCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment setup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIntent || !authToken) return;
    const cleanUtr = utrInput.trim();
    if (!/^[A-Za-z0-9]{8,32}$/.test(cleanUtr)) {
      setError('Enter a valid 8–32 character alphanumeric UTR / UPI reference.');
      return;
    }
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await updateDoc(doc(db, 'payments', activeIntent.id), {
        utrNumber: cleanUtr,
        status: 'awaiting_verification',
      });
      setNotice(
        'UTR submitted. Your membership will activate once payment reconciliation or admin verification completes.'
      );
      setActiveIntent({ ...activeIntent, status: 'awaiting_verification', utrNumber: cleanUtr });
      setUtrInput('');
      onPaymentCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'UTR submission failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-500">Current Membership</div>
          <div className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <span>{plans.find((p) => p.id === currentPlanId)?.name || currentPlanId}</span>
            <span className="text-xs font-mono text-blue-600 tabular-nums">
              · {currentPlanId}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {userProfile?.planExpiresAt
              ? `Renews / Expires on ${new Date(userProfile.planExpiresAt).toLocaleDateString('en-IN')}`
              : 'Free Forever — 10 projects/day · 30 min/day · 5 GB storage'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Promo code (e.g. ANIME20)"
              className="pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-blue-600 w-48"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isProHighlight = plan.id === 'PRO';
          return (
            <div
              key={plan.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between bg-white transition-all ${
                isProHighlight
                  ? 'border-blue-600 shadow-lg shadow-blue-600/10'
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-[11px] font-semibold text-blue-600">Active</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">{plan.audience}</p>

                <div className="mt-4 pb-4 border-b border-slate-100">
                  <span className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
                    ₹{plan.priceInr.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">/ {plan.billingCycle}</span>
                </div>

                <div className="mt-3 text-[11px] font-mono text-slate-600 space-y-1 tabular-nums">
                  <div>{plan.dailyProjectsLimit} projects/day · {plan.dailyMinutesLimit} min/day</div>
                  <div>{plan.storageGb} GB storage · Up to {plan.maxResolution}</div>
                </div>

                <ul className="mt-4 space-y-2">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                      <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-2">
                {plan.id === 'FREE' ? (
                  <div className="w-full py-2.5 text-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-600">
                    {isCurrent ? 'Your Active Free Plan' : 'Included Forever'}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleStartCheckout(plan.id as Exclude<PlanId, 'FREE'>)}
                    className={`w-full min-h-[42px] rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isProHighlight
                        ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white hover:from-blue-700 hover:to-sky-600 shadow-sm'
                        : 'border border-blue-600 text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {isCurrent ? 'Extend via UPI' : `Pay ₹${plan.priceInr.toLocaleString('en-IN')} via UPI`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeIntent && (
        <div className="rounded-2xl border border-blue-200 bg-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>Direct UPI Checkout · {activeIntent.plan} Plan</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Reference ID: <span className="font-mono font-semibold text-slate-800">{activeIntent.referenceId}</span> · Amount: <span className="font-mono font-semibold text-slate-800">₹{activeIntent.amountInr}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {UPI_APPS.map((app) => (
                <button
                  key={app}
                  type="button"
                  onClick={() => {
                    setUpiApp(app);
                    if (selectedPlan) handleStartCheckout(selectedPlan);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    upiApp === app
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {app}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-3">
              {activeIntent.qrDataUrl && (
                <img
                  src={activeIntent.qrDataUrl}
                  alt="Dynamic UPI QR Code"
                  className="w-48 h-48 rounded-xl border border-slate-200 bg-white p-2"
                />
              )}
              <div className="text-xs text-slate-600 text-center">
                Scan with Google Pay, PhonePe, Paytm, or any BHIM UPI app
              </div>
              {activeIntent.upiUri && (
                <a
                  href={activeIntent.upiUri}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                >
                  <span>Open {upiApp} App</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3.5 space-y-1.5 text-xs text-slate-700">
                <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Verified Server-Side Reconciliation</span>
                </div>
                <p>
                  Opening a UPI link never activates a plan automatically. After completing payment in your UPI app, submit your 12-digit UTR / Transaction ID below. Never enter or share your UPI PIN here.
                </p>
              </div>

              <form onSubmit={handleSubmitUtr} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    UTR / UPI Reference Number
                  </label>
                  <input
                    type="text"
                    required
                    minLength={8}
                    maxLength={32}
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    placeholder="e.g. 431910294857"
                    className="w-full px-3 py-2.5 text-sm font-mono rounded-xl border border-slate-200 outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || activeIntent.status === 'verified'}
                  className="w-full min-h-[42px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Submitting UTR...' : 'Submit UTR for Payment Verification'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">UPI Payment History</h3>
          <span className="text-xs text-slate-500 tabular-nums">{payments.length} transactions</span>
        </div>
        {payments.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No UPI payment transactions yet. Select any paid plan above to generate a dynamic UPI QR code.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                  <th className="px-4 py-2.5 font-medium">Plan</th>
                  <th className="px-4 py-2.5 font-medium">UPI App</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium">UTR</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-slate-700">{p.referenceId}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{p.plan}</td>
                    <td className="px-4 py-3 text-slate-600">{p.upiApp}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      ₹{p.amountInr}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{p.utrNumber || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          p.status === 'verified'
                            ? 'text-emerald-700'
                            : p.status === 'rejected'
                            ? 'text-red-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {p.status === 'verified' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        <span className="capitalize">{p.status.replace('_', ' ')}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
