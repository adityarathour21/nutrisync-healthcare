import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  FileSearch,
  Stethoscope,
  Utensils,
  CalendarCheck,
  ShieldCheck,
} from 'lucide-react';
import { PortalLayout, PortalNavItem } from '../../layouts/PortalLayout';
import { useApp } from '../../context/AppContext';
import { api, getApiErrorMessage } from '../../services/api';
import { MealDto } from '../public/HomeAndInfoPages';

interface ClinicalPatient {
  userId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  dietaryPreference: string;
  allergies: string[];
  intolerances: string[];
  medicalConditions: string[];
  approvedTargets: {
    dailyCalories: number;
    maxCarbsGrams: number;
    minProteinGrams: number;
    maxFatGrams: number;
    minFiberGrams: number;
    maxSodiumMg: number;
    restrictedIngredients: string[];
    approvedByDietitianName: string;
    approvedAt: string;
    clinicalNotes: string;
  };
}

interface ClinicalPrescription {
  id: string;
  patientId: string;
  patientName: string;
  fileName: string;
  doctorName: string;
  issuedDate: string;
  verificationStatus: 'pending_dietitian_review' | 'verified' | 'rejected';
  dietitianVerificationNotes: string;
  ocrExtracted: {
    patientSummary: string;
    extractedConditions: string[];
    dietaryInstructions: string[];
    potentialAllergies: string[];
    uncertainOrUnreadableFields: string[];
    recommendedMacroFocus: string;
  };
}

interface ClinicalMealPlan {
  id: string;
  patientId: string;
  patientName: string;
  createdByRole: 'ai_draft' | 'dietitian';
  title: string;
  durationType: 'daily' | 'weekly';
  status: 'pending_review' | 'approved' | 'rejected';
  dietitianNotes: string;
  days: {
    dayLabel: string;
    breakfastMealId: string;
    lunchMealId: string;
    snackMealId: string;
    dinnerMealId: string;
    totals: {
      calories: number;
      protein: number;
      carbs: number;
      sodium: number;
    };
  }[];
}

interface ClinicalConsultation {
  id: string;
  patientId: string;
  patientName: string;
  preferredDate: string;
  preferredSlot: string;
  healthConcern: string;
  status: 'requested' | 'scheduled' | 'completed' | 'cancelled';
  clinicalSummaryNotes: string;
  followUpDate: string;
}

export const DietitianPortal: React.FC = () => {
  const { pushToast, realtimeTick } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'patients';
  const setTab = (tab: string) => setSearchParams({ tab });

  const [loading, setLoading] = useState(true);
  const [dietitianMeta, setDietitianMeta] = useState<{
    qualification?: string;
    licenseNumber?: string;
    hospitalAffiliation?: string;
    verificationStatus?: string;
  } | null>(null);
  const [patients, setPatients] = useState<ClinicalPatient[]>([]);
  const [prescriptions, setPrescriptions] = useState<ClinicalPrescription[]>([]);
  const [mealPlans, setMealPlans] = useState<ClinicalMealPlan[]>([]);
  const [consultations, setConsultations] = useState<ClinicalConsultation[]>([]);
  const [verifiedMeals, setVerifiedMeals] = useState<MealDto[]>([]);

  // Target Editor State
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [calCap, setCalCap] = useState(1750);
  const [carbCap, setCarbCap] = useState(165);
  const [protMin, setProtMin] = useState(90);
  const [fatCap, setFatCap] = useState(55);
  const [fiberMin, setFiberMin] = useState(32);
  const [sodiumCap, setSodiumCap] = useState(1450);
  const [restrictedInput, setRestrictedInput] = useState('');
  const [allergiesEdit, setAllergiesEdit] = useState('');
  const [clinicalNotesEdit, setClinicalNotesEdit] = useState('');

  // Prescription Review Notes State
  const [rxNotes, setRxNotes] = useState<Record<string, string>>({});

  // Custom Meal Plan Builder State
  const [customPlanPatientId, setCustomPlanPatientId] = useState('');
  const [customPlanTitle, setCustomPlanTitle] = useState('Clinician-Supervised Glycemic & Low-Sodium Protocol');
  const [customPlanNotes, setCustomPlanNotes] = useState(
    'Formulated to maintain <1,450mg daily sodium and high soluble fiber across 4 timed meals.'
  );
  const [slotBreakfast, setSlotBreakfast] = useState('');
  const [slotLunch, setSlotLunch] = useState('');
  const [slotSnack, setSlotSnack] = useState('');
  const [slotDinner, setSlotDinner] = useState('');

  // Consultation Notes State
  const [consultNotesMap, setConsultNotesMap] = useState<Record<string, string>>({});
  const [consultFollowUpMap, setConsultFollowUpMap] = useState<Record<string, string>>({});

  const loadPatientIntoEditor = (p: ClinicalPatient) => {
    setSelectedPatientId(p.userId);
    setCalCap(p.approvedTargets.dailyCalories);
    setCarbCap(p.approvedTargets.maxCarbsGrams);
    setProtMin(p.approvedTargets.minProteinGrams);
    setFatCap(p.approvedTargets.maxFatGrams);
    setFiberMin(p.approvedTargets.minFiberGrams);
    setSodiumCap(p.approvedTargets.maxSodiumMg);
    setRestrictedInput((p.approvedTargets.restrictedIngredients || []).join(', '));
    setAllergiesEdit((p.allergies || []).join(', '));
    setClinicalNotesEdit(p.approvedTargets.clinicalNotes || '');
  };

  const fetchClinicalData = useCallback(async () => {
    try {
      const { data } = await api.get('/dietitian/dashboard');
      setDietitianMeta(data.dietitianProfile || null);
      const pts: ClinicalPatient[] = data.patients || [];
      setPatients(pts);
      if (pts.length > 0 && !selectedPatientId) {
        loadPatientIntoEditor(pts[0]);
        setCustomPlanPatientId(pts[0].userId);
      }
      setPrescriptions(data.prescriptions || []);
      setMealPlans(data.mealPlans || []);
      setConsultations(data.consultations || []);
      const meals: MealDto[] = data.verifiedMeals || [];
      setVerifiedMeals(meals);
      if (meals.length > 0 && !slotBreakfast) {
        setSlotBreakfast(meals[0]?.id || '');
        setSlotLunch(meals[1]?.id || meals[0]?.id || '');
        setSlotSnack(meals[2]?.id || meals[0]?.id || '');
        setSlotDinner(meals[3]?.id || meals[0]?.id || '');
      }
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Failed to load Dietitian clinical portal'), 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast, selectedPatientId, slotBreakfast]);

  useEffect(() => {
    void fetchClinicalData();
  }, [fetchClinicalData, realtimeTick]);

  const pendingRxCount = prescriptions.filter(
    (r) => r.verificationStatus === 'pending_dietitian_review'
  ).length;
  const pendingPlanCount = mealPlans.filter((m) => m.status === 'pending_review').length;

  const navItems: PortalNavItem[] = [
    { id: 'patients', label: 'Patients & Targets', icon: <Stethoscope className="w-4 h-4" />, count: patients.length },
    { id: 'prescriptions', label: 'Prescription OCR Review', icon: <FileSearch className="w-4 h-4" />, count: pendingRxCount },
    { id: 'meal-plans', label: 'Meal Plan Approvals', icon: <ClipboardCheck className="w-4 h-4" />, count: pendingPlanCount },
    { id: 'builder', label: 'Custom Plan Builder', icon: <Utensils className="w-4 h-4" /> },
    {
      id: 'consultations',
      label: 'Consultations & Follow-Ups',
      icon: <CalendarCheck className="w-4 h-4" />,
      count: consultations.filter((c) => c.status === 'requested').length,
    },
  ];

  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    try {
      await api.put(`/dietitian/patients/${selectedPatientId}/targets`, {
        dailyCalories: calCap,
        maxCarbsGrams: carbCap,
        minProteinGrams: protMin,
        maxFatGrams: fatCap,
        minFiberGrams: fiberMin,
        maxSodiumMg: sodiumCap,
        restrictedIngredients: restrictedInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        allergies: allergiesEdit
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        clinicalNotes: clinicalNotesEdit,
      });
      pushToast('Clinician-approved nutrition limits signed & updated', 'success');
      await fetchClinicalData();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleVerifyPrescription = async (rx: ClinicalPrescription, status: 'verified' | 'rejected') => {
    try {
      await api.put(`/dietitian/prescriptions/${rx.id}/verify`, {
        status,
        notes:
          rxNotes[rx.id] ||
          (status === 'verified'
            ? 'Verified against physician discharge instructions; allergen & sodium caps confirmed.'
            : 'Uploaded scan is partially blurred—please upload a clearer copy.'),
        addedAllergies: status === 'verified' ? rx.ocrExtracted.potentialAllergies : [],
      });
      pushToast(`Prescription marked ${status}`, 'success');
      await fetchClinicalData();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleReviewMealPlan = async (planId: string, status: 'approved' | 'rejected') => {
    try {
      await api.put(`/dietitian/meal-plans/${planId}/review`, {
        status,
        dietitianNotes:
          status === 'approved'
            ? 'Clinically approved by Registered Dietitian—macros, fiber, and sodium verified.'
            : 'Returned for sodium/carbohydrate adjustment.',
      });
      pushToast(`Meal plan ${status}`, 'success');
      await fetchClinicalData();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleCreateCustomPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/dietitian/meal-plans', {
        patientId: customPlanPatientId,
        title: customPlanTitle,
        durationType: 'daily',
        dietitianNotes: customPlanNotes,
        days: [
          {
            dayLabel: 'Daily Protocol',
            breakfastMealId: slotBreakfast,
            lunchMealId: slotLunch,
            snackMealId: slotSnack,
            dinnerMealId: slotDinner,
          },
        ],
      });
      pushToast('Custom clinician-approved meal plan published to patient dashboard', 'success');
      await fetchClinicalData();
      setTab('meal-plans');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleUpdateConsultation = async (
    c: ClinicalConsultation,
    status: 'scheduled' | 'completed' | 'cancelled'
  ) => {
    try {
      await api.put(`/dietitian/consultations/${c.id}`, {
        status,
        clinicalSummaryNotes: consultNotesMap[c.id] ?? c.clinicalSummaryNotes,
        followUpDate: consultFollowUpMap[c.id] ?? c.followUpDate,
      });
      pushToast(`Consultation marked ${status}`, 'success');
      await fetchClinicalData();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const resolveMealName = (id: string) => verifiedMeals.find((m) => m.id === id)?.name || id;

  return (
    <PortalLayout
      roleTitle="Registered Dietitian Clinical Desk"
      subtitle={
        dietitianMeta
          ? `${dietitianMeta.qualification || 'RD'} · License ${dietitianMeta.licenseNumber || 'Verified'} · ${dietitianMeta.hospitalAffiliation || ''}`
          : 'Clinical assessment, OCR prescription verification, and meal plan sign-off'
      }
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setTab}
    >
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : (
        <>
          {/* TAB 1: PATIENTS & NUTRITIONAL TARGET APPROVAL */}
          {activeTab === 'patients' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-3">
                <h2 className="text-base font-bold text-slate-900">
                  Authorized Patient Roster ({patients.length})
                </h2>
                {patients.map((p) => (
                  <button
                    key={p.userId}
                    type="button"
                    onClick={() => loadPatientIntoEditor(p)}
                    className={`w-full text-left rounded-xl border p-4 space-y-2 transition-colors ${
                      selectedPatientId === p.userId
                        ? 'border-emerald-600 bg-white shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">{p.patientName}</span>
                      <span className="text-xs font-mono text-slate-500">
                        {p.age}y · {p.gender} · {p.weightKg}kg
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Conditions: {p.medicalConditions.join(', ') || 'General Wellness'}
                    </p>
                    <p className="text-xs text-red-700">
                      Allergies: {p.allergies.join(', ') || 'None'}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-emerald-700">
                      Approved: {p.approvedTargets.dailyCalories} kcal · &le;{p.approvedTargets.maxSodiumMg}mg Na
                    </p>
                  </button>
                ))}
              </div>

              <form
                onSubmit={handleSaveTargets}
                className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-5 h-fit"
              >
                <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Clinical Nutrition Target Configuration</span>
                </div>
                <p className="text-xs text-slate-500">
                  Targets approved here immediately govern Gemini AI meal recommendations, draft meal plans, and patient adherence charts.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Daily Calories (kcal)
                    </label>
                    <input
                      type="number"
                      value={calCap}
                      onChange={(e) => setCalCap(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Max Carbs (g)
                    </label>
                    <input
                      type="number"
                      value={carbCap}
                      onChange={(e) => setCarbCap(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Min Protein (g)
                    </label>
                    <input
                      type="number"
                      value={protMin}
                      onChange={(e) => setProtMin(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Max Total Fat (g)
                    </label>
                    <input
                      type="number"
                      value={fatCap}
                      onChange={(e) => setFatCap(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Min Fiber (g)
                    </label>
                    <input
                      type="number"
                      value={fiberMin}
                      onChange={(e) => setFiberMin(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Max Sodium (mg)
                    </label>
                    <input
                      type="number"
                      value={sodiumCap}
                      onChange={(e) => setSodiumCap(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Verified Allergies (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={allergiesEdit}
                    onChange={(e) => setAllergiesEdit(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Restricted Ingredients (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={restrictedInput}
                    onChange={(e) => setRestrictedInput(e.target.value)}
                    placeholder="Refined sugar, White flour, Pickled condiments"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Signed Clinical Dietetics Notes
                  </label>
                  <textarea
                    rows={3}
                    value={clinicalNotesEdit}
                    onChange={(e) => setClinicalNotesEdit(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                >
                  Approve & Sign Nutritional Limits
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: PRESCRIPTION OCR VERIFICATION */}
          {activeTab === 'prescriptions' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">
                Prescription OCR Verification Queue ({prescriptions.length})
              </h2>
              {prescriptions.map((rx) => (
                <div key={rx.id} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {rx.patientName} — {rx.fileName}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Referring Physician: {rx.doctorName} · Issued {rx.issuedDate}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold uppercase text-emerald-700">
                      {rx.verificationStatus.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs">
                    <p>
                      <strong>Gemini OCR Summary:</strong> {rx.ocrExtracted.patientSummary}
                    </p>
                    <p>
                      <strong>Extracted Dietary Instructions:</strong>{' '}
                      {rx.ocrExtracted.dietaryInstructions.join(' · ') || 'None'}
                    </p>
                    <p className="text-red-700">
                      <strong>Potential Allergies Flagged:</strong>{' '}
                      {rx.ocrExtracted.potentialAllergies.join(', ') || 'None'}
                    </p>
                    {rx.ocrExtracted.uncertainOrUnreadableFields.length > 0 && (
                      <p className="text-amber-800">
                        <strong>Uncertain Fields Requiring Clinician Check:</strong>{' '}
                        {rx.ocrExtracted.uncertainOrUnreadableFields.join(' · ')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Add clinical verification or clarification note..."
                      value={rxNotes[rx.id] ?? rx.dietitianVerificationNotes ?? ''}
                      onChange={(e) => setRxNotes((prev) => ({ ...prev, [rx.id]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleVerifyPrescription(rx, 'verified')}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                      >
                        Approve & Merge Restrictions
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleVerifyPrescription(rx, 'rejected')}
                        className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                      >
                        Request Clearer Upload
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: AI & CUSTOM MEAL PLAN APPROVALS */}
          {activeTab === 'meal-plans' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">
                Patient Meal Plans & AI Draft Sign-Offs ({mealPlans.length})
              </h2>
              {mealPlans.map((mp) => (
                <div key={mp.id} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {mp.patientName} · {mp.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Source: {mp.createdByRole === 'ai_draft' ? 'Gemini AI Draft' : 'Dietitian Custom'} ·{' '}
                        {mp.durationType.toUpperCase()}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold uppercase text-emerald-700">
                      {mp.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">{mp.dietitianNotes}</p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-3">Day</th>
                          <th className="py-2 pr-3">Breakfast</th>
                          <th className="py-2 pr-3">Lunch</th>
                          <th className="py-2 pr-3">Snack</th>
                          <th className="py-2 pr-3">Dinner</th>
                          <th className="py-2 text-right">Totals</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {mp.days.map((d, i) => (
                          <tr key={i}>
                            <td className="py-2 pr-3 font-semibold">{d.dayLabel}</td>
                            <td className="py-2 pr-3">{resolveMealName(d.breakfastMealId)}</td>
                            <td className="py-2 pr-3">{resolveMealName(d.lunchMealId)}</td>
                            <td className="py-2 pr-3">{resolveMealName(d.snackMealId)}</td>
                            <td className="py-2 pr-3">{resolveMealName(d.dinnerMealId)}</td>
                            <td className="py-2 text-right font-mono tabular-nums">
                              {d.totals.calories} kcal · {d.totals.sodium}mg Na
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {mp.status === 'pending_review' && (
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => void handleReviewMealPlan(mp.id, 'approved')}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                      >
                        Approve & Activate Plan
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReviewMealPlan(mp.id, 'rejected')}
                        className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                      >
                        Reject Draft
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: CUSTOM CLINICIAN MEAL PLAN BUILDER */}
          {activeTab === 'builder' && (
            <form
              onSubmit={handleCreateCustomPlan}
              className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6 space-y-5"
            >
              <h2 className="text-lg font-bold text-slate-900">Assign Custom Clinician Meal Protocol</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Select Patient</label>
                  <select
                    value={customPlanPatientId}
                    onChange={(e) => setCustomPlanPatientId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
                  >
                    {patients.map((p) => (
                      <option key={p.userId} value={p.userId}>
                        {p.patientName} ({p.patientEmail})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Protocol Title</label>
                  <input
                    type="text"
                    required
                    value={customPlanTitle}
                    onChange={(e) => setCustomPlanTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(
                  [
                    ['Breakfast Meal', slotBreakfast, setSlotBreakfast],
                    ['Lunch Meal', slotLunch, setSlotLunch],
                    ['Evening Snack', slotSnack, setSlotSnack],
                    ['Dinner Meal', slotDinner, setSlotDinner],
                  ] as const
                ).map(([lbl, val, setter]) => (
                  <div key={lbl}>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{lbl}</label>
                    <select
                      value={val}
                      onChange={(e) => setter(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
                    >
                      {verifiedMeals.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.calories} kcal · {m.sodium}mg Na)
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Clinical Instructions & Rationale
                </label>
                <textarea
                  rows={3}
                  value={customPlanNotes}
                  onChange={(e) => setCustomPlanNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
              >
                Publish Approved Protocol
              </button>
            </form>
          )}

          {/* TAB 5: CONSULTATION MANAGEMENT */}
          {activeTab === 'consultations' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">
                Patient Consultations & Follow-Ups ({consultations.length})
              </h2>
              {consultations.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{c.patientName}</h3>
                      <p className="text-xs font-mono text-slate-500">
                        {c.preferredDate} · {c.preferredSlot}
                      </p>
                    </div>
                    <span className="text-xs font-mono uppercase font-semibold text-emerald-700">
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    <strong>Patient Concern:</strong> {c.healthConcern}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Clinical consultation summary..."
                      value={consultNotesMap[c.id] ?? c.clinicalSummaryNotes}
                      onChange={(e) =>
                        setConsultNotesMap((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                    <input
                      type="date"
                      value={consultFollowUpMap[c.id] ?? c.followUpDate}
                      onChange={(e) =>
                        setConsultFollowUpMap((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleUpdateConsultation(c, 'scheduled')}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Confirm Slot
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUpdateConsultation(c, 'completed')}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                    >
                      Save Summary & Mark Completed
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </PortalLayout>
  );
};
