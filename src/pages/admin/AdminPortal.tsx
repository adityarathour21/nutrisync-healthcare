import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  CreditCard,
  MessageSquareWarning,
  Settings,
  ShieldCheck,
  Users,
  UtensilsCrossed,
  FileClock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { PortalLayout, PortalNavItem } from '../../layouts/PortalLayout';
import { useApp } from '../../context/AppContext';
import { api, getApiErrorMessage } from '../../services/api';
import { MealDto } from '../public/HomeAndInfoPages';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isVerifiedByAdmin: boolean;
}

interface AdminPaymentRow {
  id: string;
  patientName: string;
  invoiceNumber: string;
  gatewayPaymentId: string;
  amountInr: number;
  status: string;
  refundReason: string;
  createdAt: string;
}

interface AdminReviewRow {
  id: string;
  patientName: string;
  rating: number;
  comment: string;
  moderationStatus: 'published' | 'flagged' | 'hidden';
  adminResolution: string;
}

interface AuditLogRow {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  details: string;
  createdAt: string;
}

export const AdminPortal: React.FC = () => {
  const { pushToast, realtimeTick } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'analytics';
  const setTab = (tab: string) => setSearchParams({ tab });

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    totalUsers: 0,
    totalPatients: 0,
    verifiedDietitians: 0,
    totalOrders: 0,
    activeSubscriptions: 0,
    totalRevenueInr: 0,
  });
  const [demandForecast, setDemandForecast] = useState<
    { mealName: string; historicalUnits: number; projectedNext7Days: number; revenueContributionInr: number }[]
  >([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [reviews, setReviews] = useState<AdminReviewRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<Record<string, boolean>>({});
  const [freeThreshold, setFreeThreshold] = useState(500);
  const [deliveryFee, setDeliveryFee] = useState(45);
  const [retentionDays, setRetentionDays] = useState(365);

  // New Meal Creator State
  const [newMealName, setNewMealName] = useState('');
  const [newMealCategory, setNewMealCategory] = useState('diabetes-care');
  const [newMealDiet, setNewMealDiet] = useState<'vegetarian' | 'vegan' | 'non_vegetarian'>('vegetarian');
  const [newMealPrice, setNewMealPrice] = useState(329);
  const [newMealCal, setNewMealCal] = useState(410);
  const [newMealProt, setNewMealProt] = useState(27);
  const [newMealCarbs, setNewMealCarbs] = useState(39);
  const [newMealSodium, setNewMealSodium] = useState(265);
  const [newMealIngredients, setNewMealIngredients] = useState(
    'Foxtail millet, Roasted tofu, Steamed broccoli, Cold-pressed sesame oil'
  );

  const fetchAdmin = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/dashboard');
      if (data.kpis) setKpis(data.kpis);
      setDemandForecast(data.demandForecast || []);
      setUsers(data.users || []);
      setMeals(data.meals || []);
      setPayments(data.payments || []);
      setReviews(data.reviews || []);
      setAuditLogs(data.auditLogs || []);
      setIntegrationStatus(data.integrationStatus || {});
      if (data.platformSettings) {
        setFreeThreshold(data.platformSettings.freeDeliveryThresholdInr);
        setDeliveryFee(data.platformSettings.standardDeliveryFeeInr);
        setRetentionDays(data.platformSettings.prescriptionRetentionDays);
      }
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Failed to load Super Admin console'), 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void fetchAdmin();
  }, [fetchAdmin, realtimeTick]);

  const navItems: PortalNavItem[] = [
    { id: 'analytics', label: 'Analytics & Demand', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'users', label: 'Users & Credentialing', icon: <Users className="w-4 h-4" />, count: users.length },
    { id: 'catalogue', label: 'Meal Catalogue', icon: <UtensilsCrossed className="w-4 h-4" />, count: meals.length },
    { id: 'payments', label: 'Payments & Refunds', icon: <CreditCard className="w-4 h-4" />, count: payments.length },
    { id: 'moderation', label: 'Review Moderation', icon: <MessageSquareWarning className="w-4 h-4" />, count: reviews.length },
    { id: 'audit', label: 'Audit Logs & Settings', icon: <FileClock className="w-4 h-4" /> },
  ];

  const handleToggleUser = async (u: AdminUserRow, payload: { isActive?: boolean; verificationStatus?: 'verified' | 'rejected' }) => {
    try {
      await api.put(`/admin/users/${u.id}/status`, payload);
      pushToast(`Updated account ${u.email}`, 'success');
      await fetchAdmin();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleCreateMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/meals', {
        name: newMealName,
        categorySlug: newMealCategory,
        dietaryType: newMealDiet,
        priceInr: newMealPrice,
        calories: newMealCal,
        protein: newMealProt,
        carbs: newMealCarbs,
        sodium: newMealSodium,
        ingredients: newMealIngredients
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setNewMealName('');
      pushToast('New verified clinical meal published to marketplace', 'success');
      await fetchAdmin();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleToggleMealAvailability = async (m: MealDto) => {
    try {
      await api.put(`/admin/meals/${m.id}`, { isAvailable: !m.isAvailable });
      pushToast(`Updated availability for ${m.name}`, 'info');
      await fetchAdmin();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleRefundPayment = async (p: AdminPaymentRow) => {
    try {
      await api.put(`/admin/payments/${p.id}/refund`, {
        reason: 'Super Admin authorized full refund to patient payment method',
      });
      pushToast(`Refunded ${p.invoiceNumber}`, 'success');
      await fetchAdmin();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleModerateReview = async (id: string, moderationStatus: 'published' | 'hidden') => {
    try {
      await api.put(`/admin/reviews/${id}/moderate`, {
        moderationStatus,
        adminResolution: `Moderated as ${moderationStatus} by Super Admin`,
      });
      pushToast(`Review marked ${moderationStatus}`, 'info');
      await fetchAdmin();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/admin/settings', {
        freeDeliveryThresholdInr: freeThreshold,
        standardDeliveryFeeInr: deliveryFee,
        prescriptionRetentionDays: retentionDays,
      });
      pushToast('Platform governance settings saved', 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  return (
    <PortalLayout
      roleTitle="Super Admin Governance Console"
      subtitle="Platform analytics, clinician credentialing, catalogue verification, refunds, and immutable audit logs"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setTab}
    >
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : (
        <>
          {/* TAB 1: ANALYTICS & DEMAND FORECASTING */}
          {activeTab === 'analytics' && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Captured Revenue</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                    ₹{kpis.totalRevenueInr}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Total Users</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {kpis.totalUsers}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Patients</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {kpis.totalPatients}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Verified Dietitians</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {kpis.verifiedDietitians}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Total Orders</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {kpis.totalOrders}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Active Subscriptions</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {kpis.activeSubscriptions}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      7-Day Kitchen Prep Demand Forecast (Units)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Projected meal volume derived from active subscriptions and verified orders
                    </p>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={demandForecast}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="mealName" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip />
                        <Bar
                          dataKey="projectedNext7Days"
                          fill="#059669"
                          radius={[6, 6, 0, 0]}
                          name="Projected 7-Day Units"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Revenue Contribution by Clinical Meal (INR)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Historical unit volume multiplied by catalogue price
                    </p>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={demandForecast}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="mealName" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip />
                        <Bar
                          dataKey="revenueContributionInr"
                          fill="#0f172a"
                          radius={[6, 6, 0, 0]}
                          name="Revenue (INR)"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Runtime Service Mode</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <span className="text-slate-500 block">Persistence Layer</span>
                    <span className="font-semibold text-slate-900">
                      {integrationStatus.mongoConnected
                        ? 'MongoDB Atlas Connected'
                        : 'Resilient JSON Persistence Store'}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <span className="text-slate-500 block">Gemini AI Engine</span>
                    <span className="font-semibold text-slate-900">
                      {integrationStatus.geminiApiConfigured
                        ? 'Gemini 3.8 Flash Active'
                        : 'Deterministic Clinical Fallback'}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <span className="text-slate-500 block">Payment Gateway</span>
                    <span className="font-semibold text-slate-900">
                      {integrationStatus.razorpayConfigured
                        ? 'Razorpay Live/Test Keys Active'
                        : 'HMAC-SHA256 Verified Test Sandbox'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USERS & CREDENTIAL VERIFICATION */}
          {activeTab === 'users' && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                User Accounts & Practitioner Credentialing ({users.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Credential Status</th>
                      <th className="py-2 pr-4">Account</th>
                      <th className="py-2 text-right">Governance Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="py-3 pr-4 font-semibold text-slate-900">{u.name}</td>
                        <td className="py-3 pr-4 font-mono text-slate-600">{u.email}</td>
                        <td className="py-3 pr-4 uppercase font-mono text-slate-700">{u.role}</td>
                        <td className="py-3 pr-4">
                          {u.isVerifiedByAdmin ? (
                            <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" /> Verified
                            </span>
                          ) : (
                            <span className="text-amber-700">Pending Review</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {u.isActive ? (
                            <span className="text-emerald-700">Active</span>
                          ) : (
                            <span className="text-red-600">Suspended</span>
                          )}
                        </td>
                        <td className="py-3 text-right space-x-2 whitespace-nowrap">
                          {!u.isVerifiedByAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleToggleUser(u, { verificationStatus: 'verified' })
                              }
                              className="px-2.5 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700"
                            >
                              Verify Credentials
                            </button>
                          )}
                          {u.role !== 'admin' && (
                            <button
                              type="button"
                              onClick={() => void handleToggleUser(u, { isActive: !u.isActive })}
                              className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MEAL CATALOGUE MANAGEMENT */}
          {activeTab === 'catalogue' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={handleCreateMeal}
                className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4 h-fit"
              >
                <h2 className="text-base font-bold text-slate-900">Publish Verified Catalogue Meal</h2>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Meal Name</label>
                  <input
                    type="text"
                    required
                    value={newMealName}
                    onChange={(e) => setNewMealName(e.target.value)}
                    placeholder="e.g., Foxtail Millet & Sesame Tofu Bowl"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                    <select
                      value={newMealCategory}
                      onChange={(e) => setNewMealCategory(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
                    >
                      <option value="diabetes-care">Diabetes-Friendly</option>
                      <option value="low-sodium-heart">Low-Sodium & Heart</option>
                      <option value="thyroid-support">Thyroid Balance</option>
                      <option value="weight-management">Weight Management</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Dietary Type</label>
                    <select
                      value={newMealDiet}
                      onChange={(e) =>
                        setNewMealDiet(e.target.value as 'vegetarian' | 'vegan' | 'non_vegetarian')
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
                    >
                      <option value="vegetarian">Vegetarian</option>
                      <option value="vegan">Vegan</option>
                      <option value="non_vegetarian">Non-Vegetarian</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Price (₹)</label>
                    <input
                      type="number"
                      value={newMealPrice}
                      onChange={(e) => setNewMealPrice(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Calories</label>
                    <input
                      type="number"
                      value={newMealCal}
                      onChange={(e) => setNewMealCal(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Sodium (mg)</label>
                    <input
                      type="number"
                      value={newMealSodium}
                      onChange={(e) => setNewMealSodium(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Protein (g)</label>
                    <input
                      type="number"
                      value={newMealProt}
                      onChange={(e) => setNewMealProt(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Carbs (g)</label>
                    <input
                      type="number"
                      value={newMealCarbs}
                      onChange={(e) => setNewMealCarbs(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ingredients (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newMealIngredients}
                    onChange={(e) => setNewMealIngredients(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                >
                  Add Verified Meal
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                <h2 className="text-base font-bold text-slate-900">Active Catalogue ({meals.length})</h2>
                {meals.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{m.name}</p>
                      <p className="text-xs font-mono tabular-nums text-slate-500">
                        ₹{m.priceInr} · {m.calories} kcal · {m.protein}g P · {m.sodium}mg Na
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleToggleMealAvailability(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        m.isAvailable
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {m.isAvailable ? 'Available' : 'Paused'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PAYMENTS & REFUND WORKFLOW */}
          {activeTab === 'payments' && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                Payment Ledger & Authorized Refunds ({payments.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4">Invoice</th>
                      <th className="py-2 pr-4">Patient</th>
                      <th className="py-2 pr-4">Amount</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 pr-4 font-semibold text-slate-900">{p.invoiceNumber}</td>
                        <td className="py-3 pr-4 font-sans text-slate-700">{p.patientName}</td>
                        <td className="py-3 pr-4 text-slate-900">₹{p.amountInr}</td>
                        <td className="py-3 pr-4 uppercase text-emerald-700">{p.status}</td>
                        <td className="py-3 text-right font-sans">
                          {p.status === 'captured' ? (
                            <button
                              type="button"
                              onClick={() => void handleRefundPayment(p)}
                              className="px-3 py-1 rounded border border-red-200 text-red-600 font-medium hover:bg-red-50"
                            >
                              Issue Refund
                            </button>
                          ) : (
                            <span className="text-slate-400">Refunded</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: REVIEW MODERATION */}
          {activeTab === 'moderation' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900">Customer Review Moderation</h2>
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-900">
                      {r.patientName} · ★ {r.rating}/5
                    </span>
                    <span className="font-mono uppercase text-slate-500">{r.moderationStatus}</span>
                  </div>
                  <p className="text-slate-700">{r.comment}</p>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => void handleModerateReview(r.id, 'published')}
                      className="px-3 py-1 rounded bg-emerald-600 text-white font-medium"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleModerateReview(r.id, 'hidden')}
                      className="px-3 py-1 rounded border border-slate-300 text-slate-700"
                    >
                      Hide Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 6: IMMUTABLE AUDIT LOGS & PLATFORM SETTINGS */}
          {activeTab === 'audit' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={handleSaveSettings}
                className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-6 space-y-4 h-fit"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-900">Platform Governance</h2>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Free Cold-Chain Threshold (₹)
                  </label>
                  <input
                    type="number"
                    value={freeThreshold}
                    onChange={(e) => setFreeThreshold(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Standard Delivery Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Prescription Document Retention (Days)
                  </label>
                  <input
                    type="number"
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  Save Governance Policy
                </button>
              </form>

              <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">
                  Security & Clinical Audit Trail ({auditLogs.length})
                </h2>
                <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto text-xs">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-2.5 space-y-0.5">
                      <div className="flex justify-between font-mono">
                        <span className="font-semibold text-slate-900">{log.action}</span>
                        <span className="text-slate-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600">
                        {log.actorEmail} ({log.actorRole}) — {log.details}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PortalLayout>
  );
};
