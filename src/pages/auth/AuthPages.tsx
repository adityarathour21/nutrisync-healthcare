import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { api, getApiErrorMessage } from '../../services/api';

const DEMO_ROLES = [
  { label: 'Patient (Demo)', email: 'patient@nutrisync.demo', roleDesc: 'Aarav Sharma · Diabetes & Low-Sodium Profile' },
  { label: 'Dietitian (Demo)', email: 'dietitian@nutrisync.demo', roleDesc: 'Dr. Meera Nair, RD · Clinical Approvals' },
  { label: 'Kitchen Chef (Demo)', email: 'chef@nutrisync.demo', roleDesc: 'Chef Vikramjit · PHI-Safe KDS & QC' },
  { label: 'Delivery Partner (Demo)', email: 'delivery@nutrisync.demo', roleDesc: 'Rohan Deshmukh · Route Navigation' },
  { label: 'Super Admin (Demo)', email: 'admin@nutrisync.demo', roleDesc: 'Ananya Verma · Analytics & Governance' },
];

export const LoginPage: React.FC = () => {
  const { loginWithCredentials, pushToast } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forgot password modal state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [devCodeHint, setDevCodeHint] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');

  const routeForRole = (role: string) => {
    const redirect = searchParams.get('redirect');
    if (redirect) return redirect;
    switch (role) {
      case 'dietitian':
        return '/portal/dietitian';
      case 'chef':
        return '/portal/kitchen';
      case 'delivery':
        return '/portal/delivery';
      case 'admin':
        return '/portal/admin';
      default:
        return '/portal/patient';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const loggedIn = await loginWithCredentials(email, password);
      navigate(routeForRole(loggedIn.role));
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Invalid credentials'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const quickDemoLogin = async (demoEmail: string) => {
    setSubmitting(true);
    try {
      const loggedIn = await loginWithCredentials(demoEmail, 'Demo@1234');
      navigate(routeForRole(loggedIn.role));
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const requestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/forgot-password', { email: resetEmail });
      if (data.devVerificationCode) {
        setDevCodeHint(data.devVerificationCode);
      }
      setResetStep('confirm');
      pushToast(data.message, 'info');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const confirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/reset-password', {
        email: resetEmail,
        code: resetCode,
        newPassword,
      });
      pushToast(data.message, 'success');
      setResetOpen(false);
      setResetStep('request');
      setDevCodeHint('');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Sign in to NutriSync</h1>
          <p className="text-xs text-slate-500">
            Access your clinical nutrition profile, dietitian queue, kitchen station, or dispatch route.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">Password</label>
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                className="text-xs text-emerald-700 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p className="text-xs text-slate-600 text-center">
          New to NutriSync?{' '}
          <Link to="/register" className="font-semibold text-emerald-700 hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      {/* Clearly Labeled Development Demo Role Switcher */}
      <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-8 space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-mono text-emerald-700">Development Seed Accounts</p>
          <h2 className="text-lg font-bold text-slate-900">Instant Role-Based Demo Access</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Click any pre-seeded role below (Password: <code className="font-mono text-slate-800">Demo@1234</code>) to test real full-stack RBAC, Socket.IO order sync, prescription OCR, and dietitian approvals.
          </p>
        </div>

        <div className="space-y-2.5 pt-1">
          {DEMO_ROLES.map((d) => (
            <button
              key={d.email}
              type="button"
              disabled={submitting}
              onClick={() => void quickDemoLogin(d.email)}
              className="w-full text-left rounded-xl border border-slate-200 p-3.5 hover:border-emerald-600 hover:bg-emerald-50/40 transition-colors flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{d.label}</p>
                <p className="text-xs text-slate-500">{d.roleDesc}</p>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">{d.email}</p>
              </div>
              <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap shrink-0">
                Sign In →
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Password Reset Modal */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reset Your Password</h3>
            {resetStep === 'request' ? (
              <form onSubmit={requestResetCode} className="space-y-3">
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your account email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setResetOpen(false)} className="px-4 py-2 text-xs text-slate-600">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold">
                    Send Verification Code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={confirmResetPassword} className="space-y-3">
                {devCodeHint && (
                  <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-lg">
                    Dev Mode Verification Code: <strong className="font-mono">{devCodeHint}</strong>
                  </p>
                )}
                <input
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="6-digit verification code"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 characters)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setResetOpen(false)} className="px-4 py-2 text-xs text-slate-600">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold">
                    Update Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const RegisterPage: React.FC = () => {
  const { registerAccount, pushToast } = useApp();
  const navigate = useNavigate();
  const [role, setRole] = useState<'patient' | 'dietitian' | 'chef' | 'delivery'>('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [qualification, setQualification] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [referralCodeUsed, setReferralCodeUsed] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await registerAccount({
        name,
        email,
        phone,
        password,
        role,
        qualification,
        licenseNumber,
        vehiclePlate,
        referralCodeUsed,
      });
      switch (created.role) {
        case 'dietitian':
          navigate('/portal/dietitian');
          break;
        case 'chef':
          navigate('/portal/kitchen');
          break;
        case 'delivery':
          navigate('/portal/delivery');
          break;
        default:
          navigate('/portal/patient');
      }
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Create your NutriSync account</h1>
          <p className="text-xs text-slate-500">
            Select your ecosystem role. Dietitians and Delivery Partners undergo Super Admin credential verification.
          </p>
        </div>

        {/* Role Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              ['patient', 'Patient'],
              ['dietitian', 'Dietitian'],
              ['chef', 'Chef'],
              ['delivery', 'Delivery'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setRole(val)}
              className={`py-2 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                role === val ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 00000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {role === 'dietitian' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Clinical Qualification</label>
                <input
                  type="text"
                  required
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="MSc Clinical Nutrition, RD"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Dietetics License No.</label>
                <input
                  type="text"
                  required
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="IDA-RD-XXXX"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
          )}

          {role === 'delivery' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle Registration Plate</label>
              <input
                type="text"
                required
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder="KA-01-EV-1234"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          )}

          {role === 'patient' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Referral Code (Optional — +150 Loyalty Pts)</label>
              <input
                type="text"
                value={referralCodeUsed}
                onChange={(e) => setReferralCodeUsed(e.target.value)}
                placeholder="e.g. AARAV50"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password (min 6 characters)</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};
