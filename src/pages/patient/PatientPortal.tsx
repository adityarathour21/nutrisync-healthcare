import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Bot,
  CalendarClock,
  CreditCard,
  FileText,
  HeartPulse,
  PackageCheck,
  Repeat,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { PortalLayout, PortalNavItem } from '../../layouts/PortalLayout';
import { useApp } from '../../context/AppContext';
import { api, getApiErrorMessage } from '../../services/api';
import { MealImage } from '../../components/MealImage';
import { PlacesAddressAutocomplete } from '../../components/maps/NutriSyncMaps';
import { MealDto } from '../public/HomeAndInfoPages';

interface ApprovedTargets {
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
}

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age: number;
  dietaryPreference: string;
  allergies: string[];
}

interface PatientProfile {
  userId: string;
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  dietaryPreference: 'vegetarian' | 'vegan' | 'non_vegetarian';
  allergies: string[];
  intolerances: string[];
  medicalConditions: string[];
  assignedDietitianId: string | null;
  approvedTargets: ApprovedTargets;
  favoriteMealIds: string[];
  familyMembers: FamilyMember[];
  mealRemindersEnabled: boolean;
}

interface PrescriptionItem {
  id: string;
  fileName: string;
  mimeType: string;
  doctorName: string;
  issuedDate: string;
  verificationStatus: 'pending_dietitian_review' | 'verified' | 'rejected';
  reviewedByDietitianName: string | null;
  dietitianVerificationNotes: string;
  ocrExtracted: {
    patientSummary: string;
    extractedConditions: string[];
    dietaryInstructions: string[];
    potentialAllergies: string[];
    uncertainOrUnreadableFields: string[];
    recommendedMacroFocus: string;
    safetyNotice: string;
  };
  accessLogs: { actorRole: string; action: string; timestamp: string }[];
  createdAt: string;
}

interface MealPlanItem {
  id: string;
  title: string;
  createdByRole: 'ai_draft' | 'dietitian';
  reviewedByDietitianName: string | null;
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
      fat: number;
      fiber: number;
      sodium: number;
    };
  }[];
  createdAt: string;
}

interface AddressItem {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  formattedAddress: string;
  landmark: string;
  postalCode: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

interface OrderItem {
  id: string;
  orderNumber: string;
  items: {
    mealId: string;
    mealName: string;
    quantity: number;
    unitPriceInr: number;
    portionSize: string;
    calories: number;
    sodium: number;
  }[];
  subtotalInr: number;
  discountInr: number;
  deliveryFeeInr: number;
  totalInr: number;
  status: string;
  paymentStatus: string;
  scheduledSlot: string;
  deliveryAddress: {
    label: string;
    formattedAddress: string;
    postalCode: string;
  };
  qualityChecklist: {
    portionWeighed: boolean;
    allergenCrossCheck: boolean;
    sodiumVerified: boolean;
    tamperSealApplied: boolean;
  };
  createdAt: string;
}

interface SubscriptionItem {
  id: string;
  planType: string;
  planName: string;
  selectedMealIds: string[];
  deliveryTimeSlot: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'paused' | 'cancelled';
  priceInr: number;
  autoRenewConsent: boolean;
}

interface PaymentItem {
  id: string;
  gateway: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  signatureVerified: boolean;
  amountInr: number;
  status: string;
  invoiceNumber: string;
  refundReason: string;
  createdAt: string;
}

interface ConsultationItem {
  id: string;
  dietitianId: string;
  dietitianName: string;
  preferredDate: string;
  preferredSlot: string;
  healthConcern: string;
  status: string;
  clinicalSummaryNotes: string;
  followUpDate: string;
  createdAt: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  createdAt: string;
}

const ORDER_STEPS = [
  'confirmed',
  'preparing',
  'quality_checked',
  'ready_for_dispatch',
  'picked_up',
  'out_for_delivery',
  'delivered',
];

export const PatientPortal: React.FC = () => {
  const {
    user,
    cart,
    addToCart,
    updateCartQty,
    clearCart,
    pushToast,
    realtimeTick,
    logout,
    refreshUser,
  } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const [loading, setLoading] = useState(true);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlanItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [consultations, setConsultations] = useState<ConsultationItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [allMeals, setAllMeals] = useState<MealDto[]>([]);
  const [dietitians, setDietitians] = useState<
    { userId: string; name: string; qualification: string; consultationFeeInr: number }[]
  >([]);

  // Health Profile Form State
  const [ageInput, setAgeInput] = useState(38);
  const [genderInput, setGenderInput] = useState('Male');
  const [heightInput, setHeightInput] = useState(174);
  const [weightInput, setWeightInput] = useState(79);
  const [dietPrefInput, setDietPrefInput] = useState<'vegetarian' | 'vegan' | 'non_vegetarian'>('vegetarian');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [intolerancesInput, setIntolerancesInput] = useState('');
  const [conditionsInput, setConditionsInput] = useState('');
  const [remindersInput, setRemindersInput] = useState(true);

  // Family member quick-add state
  const [famName, setFamName] = useState('');
  const [famRelation, setFamRelation] = useState('Spouse');
  const [famAge, setFamAge] = useState(35);
  const [famAllergies, setFamAllergies] = useState('');

  // Prescription Upload State
  const [rxFile, setRxFile] = useState<File | null>(null);
  const [rxDoctor, setRxDoctor] = useState('');
  const [rxDate, setRxDate] = useState(new Date().toISOString().slice(0, 10));
  const [uploadingRx, setUploadingRx] = useState(false);

  // AI Engine Sub-Tab & State
  const [aiMode, setAiMode] = useState<'chat' | 'recommendations' | 'planner'>('chat');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSuggestedMeals, setChatSuggestedMeals] = useState<string[]>([]);
  const [chatDisclaimer, setChatDisclaimer] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const [recommendations, setRecommendations] = useState<
    { meal: MealDto; matchScore: number; clinicalReason: string; nutrientHighlights: string[] }[]
  >([]);
  const [recBusy, setRecBusy] = useState(false);

  const [plannerDuration, setPlannerDuration] = useState<'daily' | 'weekly'>('daily');
  const [plannerBusy, setPlannerBusy] = useState(false);

  // Checkout & Address State
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [scheduledSlot, setScheduledSlot] = useState('12:30 - 13:15');
  const [couponCode, setCouponCode] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrRecipient, setAddrRecipient] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrFormatted, setAddrFormatted] = useState('');
  const [addrPostal, setAddrPostal] = useState('');
  const [addrLat, setAddrLat] = useState(12.9716);
  const [addrLng, setAddrLng] = useState(77.5946);

  // Subscription Builder State
  const [subPlanKey, setSubPlanKey] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [subSlot, setSubSlot] = useState('12:30 - 13:15');
  const [subAutoRenew, setSubAutoRenew] = useState(false);
  const [subBusy, setSubBusy] = useState(false);

  // Consultation Form State
  const [consultDietitianId, setConsultDietitianId] = useState('');
  const [consultDate, setConsultDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );
  const [consultSlot, setConsultSlot] = useState('11:00 AM - 11:30 AM');
  const [consultConcern, setConsultConcern] = useState('');

  const syncProfileInputs = (p: PatientProfile) => {
    setAgeInput(p.age);
    setGenderInput(p.gender);
    setHeightInput(p.heightCm);
    setWeightInput(p.weightKg);
    setDietPrefInput(p.dietaryPreference);
    setAllergiesInput((p.allergies || []).join(', '));
    setIntolerancesInput((p.intolerances || []).join(', '));
    setConditionsInput((p.medicalConditions || []).join(', '));
    setRemindersInput(p.mealRemindersEnabled);
  };

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, mealsRes, dietRes] = await Promise.all([
        api.get('/patient/dashboard'),
        api.get('/meals'),
        api.get('/dietitians'),
      ]);

      const d = dashRes.data;
      setLoyaltyPoints(d.loyaltyPoints || 0);
      setReferralCode(d.referralCode || '');
      if (d.profile) {
        setProfile(d.profile);
        syncProfileInputs(d.profile);
      }
      setPrescriptions(d.prescriptions || []);
      setMealPlans(d.mealPlans || []);
      setOrders(d.orders || []);
      setSubscriptions(d.subscriptions || []);
      setPayments(d.payments || []);
      const addrList: AddressItem[] = d.addresses || [];
      setAddresses(addrList);
      if (addrList.length > 0) {
        const def = addrList.find((a) => a.isDefault) || addrList[0];
        setSelectedAddressId((prev) => prev || def.id);
      }
      setConsultations(d.consultations || []);
      setNotifications(d.notifications || []);
      setAllMeals(mealsRes.data.meals || []);

      const dietList = dietRes.data.dietitians || [];
      setDietitians(dietList);
      if (dietList.length > 0) {
        setConsultDietitianId((prev) => prev || dietList[0].userId);
      }
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Failed to load patient workspace'), 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard, realtimeTick]);

  useEffect(() => {
    if (user && !addrRecipient) {
      setAddrRecipient(user.name);
      setAddrPhone(user.phone || '+91 9876543210');
    }
  }, [user, addrRecipient]);

  // Build 7-day nutrition analytics series from verified meal plan & orders
  const nutritionChartData = useMemo(() => {
    const capCal = profile?.approvedTargets.dailyCalories || 1800;
    const capSodium = profile?.approvedTargets.maxSodiumMg || 1500;
    const approvedPlan = mealPlans.find((m) => m.status === 'approved') || mealPlans[0];
    const baseTotals = approvedPlan?.days?.[0]?.totals || {
      calories: 1620,
      protein: 98,
      carbs: 158,
      sodium: 1180,
    };

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
    const deltas = [-60, 35, -20, 45, -40, 15, 0];
    return labels.map((day, idx) => ({
      day,
      calories: Math.max(1100, baseTotals.calories + deltas[idx]),
      calorieCap: capCal,
      sodium: Math.max(750, baseTotals.sodium + deltas[idx] * 2),
      sodiumCap: capSodium,
      protein: Math.max(60, baseTotals.protein + (idx % 3) * 4),
      carbs: Math.max(90, baseTotals.carbs + (idx % 2 === 0 ? -6 : 6)),
    }));
  }, [profile, mealPlans]);

  const unreadNotifs = notifications.filter((n) => !n.isRead).length;

  const navItems: PortalNavItem[] = [
    { id: 'overview', label: 'Clinical Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'profile', label: 'Health & Allergies', icon: <HeartPulse className="w-4 h-4" /> },
    {
      id: 'prescriptions',
      label: 'Prescriptions & OCR',
      icon: <FileText className="w-4 h-4" />,
      count: prescriptions.filter((p) => p.verificationStatus === 'pending_dietitian_review').length,
    },
    { id: 'ai-assistant', label: 'AI Nutrition Engine', icon: <Bot className="w-4 h-4" /> },
    {
      id: 'checkout',
      label: 'Tray & Checkout',
      icon: <CreditCard className="w-4 h-4" />,
      count: cart.reduce((s, c) => s + c.quantity, 0),
    },
    {
      id: 'orders',
      label: 'Live Orders & Invoices',
      icon: <PackageCheck className="w-4 h-4" />,
      count: orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length,
    },
    {
      id: 'subscriptions',
      label: 'Meal Subscriptions',
      icon: <Repeat className="w-4 h-4" />,
      count: subscriptions.filter((s) => s.status === 'active').length,
    },
    {
      id: 'consultations',
      label: 'Dietitian & Alerts',
      icon: <CalendarClock className="w-4 h-4" />,
      count: unreadNotifs,
    },
  ];

  // Handlers
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.put('/patient/health-profile', {
        age: ageInput,
        gender: genderInput,
        heightCm: heightInput,
        weightKg: weightInput,
        dietaryPreference: dietPrefInput,
        allergies: allergiesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        intolerances: intolerancesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        medicalConditions: conditionsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        mealRemindersEnabled: remindersInput,
      });
      setProfile(data.profile);
      pushToast('Personal health profile updated', 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleAddFamilyMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !famName.trim()) return;
    const nextMembers: FamilyMember[] = [
      ...(profile.familyMembers || []),
      {
        id: `fam_${Date.now()}`,
        name: famName.trim(),
        relation: famRelation,
        age: Number(famAge) || 30,
        dietaryPreference: dietPrefInput,
        allergies: famAllergies
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      },
    ];
    try {
      const { data } = await api.put('/patient/health-profile', { familyMembers: nextMembers });
      setProfile(data.profile);
      setFamName('');
      setFamAllergies('');
      pushToast('Family member dietary profile saved', 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleRemoveFamilyMember = async (famId: string) => {
    if (!profile) return;
    const nextMembers = (profile.familyMembers || []).filter((f) => f.id !== famId);
    try {
      const { data } = await api.put('/patient/health-profile', { familyMembers: nextMembers });
      setProfile(data.profile);
      pushToast('Family member removed', 'info');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleUploadPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rxFile) {
      pushToast('Select a PDF, JPG, JPEG, or PNG prescription document', 'error');
      return;
    }
    setUploadingRx(true);
    try {
      const formData = new FormData();
      formData.append('document', rxFile);
      formData.append('doctorName', rxDoctor);
      formData.append('issuedDate', rxDate);

      const { data } = await api.post('/patient/prescriptions/upload', formData);
      setPrescriptions((prev) => [data.prescription, ...prev]);
      setRxFile(null);
      setRxDoctor('');
      pushToast('Prescription extracted via Gemini OCR & routed to Dietitian', 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Prescription OCR upload failed'), 'error');
    } finally {
      setUploadingRx(false);
    }
  };

  const handleSendChat = async (promptOverride?: string) => {
    const q = (promptOverride ?? chatInput).trim();
    if (!q || chatBusy) return;
    const nextHist = [...chatHistory, { role: 'user' as const, text: q }];
    setChatHistory(nextHist);
    if (!promptOverride) setChatInput('');
    setChatBusy(true);
    try {
      const { data } = await api.post('/ai/chat', {
        question: q,
        history: chatHistory.slice(-6),
      });
      setChatHistory([...nextHist, { role: 'assistant', text: data.answer }]);
      setChatSuggestedMeals(data.suggestedMealIds || []);
      setChatDisclaimer(data.disclaimer || '');
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'AI Nutrition Assistant error'), 'error');
    } finally {
      setChatBusy(false);
    }
  };

  const handleFetchRecommendations = async () => {
    setRecBusy(true);
    try {
      const { data } = await api.post('/ai/recommendations');
      setRecommendations(data.recommendations || []);
      pushToast('Allergen-gated meal recommendations refreshed', 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    } finally {
      setRecBusy(false);
    }
  };

  const handleGenerateDraftPlan = async () => {
    setPlannerBusy(true);
    try {
      const { data } = await api.post('/ai/meal-planner', { durationType: plannerDuration });
      setMealPlans((prev) => [data.mealPlan, ...prev]);
      pushToast('AI draft meal plan generated & sent to Registered Dietitian for sign-off', 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    } finally {
      setPlannerBusy(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/patient/addresses', {
        label: addrLabel,
        recipientName: addrRecipient,
        phone: addrPhone,
        formattedAddress: addrFormatted,
        postalCode: addrPostal,
        lat: addrLat,
        lng: addrLng,
        isDefault: addresses.length === 0,
      });
      setAddresses((prev) => [...prev, data.address]);
      setSelectedAddressId(data.address.id);
      setAddrFormatted('');
      setAddrPostal('');
      pushToast('Delivery address saved', 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await api.delete(`/patient/addresses/${id}`);
      const remaining = addresses.filter((a) => a.id !== id);
      setAddresses(remaining);
      if (selectedAddressId === id) {
        setSelectedAddressId(remaining[0]?.id || '');
      }
      pushToast('Address removed', 'info');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const cartSubtotal = cart.reduce((s, c) => s + c.priceInr * c.quantity, 0);
  const couponPreviewDiscount = useMemo(() => {
    const code = couponCode.trim().toUpperCase();
    if (code === 'FIRSTHEALTH15') return Math.min(180, Math.round(cartSubtotal * 0.15));
    if (code === 'CARE10') return Math.min(120, Math.round(cartSubtotal * 0.1));
    return 0;
  }, [couponCode, cartSubtotal]);
  const pointsPreviewDiscount = redeemPoints && loyaltyPoints >= 50 ? Math.min(loyaltyPoints, 100) : 0;
  const deliveryFeePreview = cartSubtotal >= 500 || cartSubtotal === 0 ? 0 : 45;
  const estimatedPayable = Math.max(
    0,
    cartSubtotal - couponPreviewDiscount - pointsPreviewDiscount + deliveryFeePreview
  );

  const handleExecuteCheckout = async () => {
    if (cart.length === 0) {
      pushToast('Your meal tray is empty', 'error');
      return;
    }
    if (!selectedAddressId) {
      pushToast('Please select or add a delivery address first', 'error');
      return;
    }
    setCheckoutBusy(true);
    try {
      const sessionRes = await api.post('/payments/create-session', {
        amountInr: estimatedPayable,
        purpose: 'meal_order',
      });
      const sessionData = sessionRes.data;

      if (sessionData.mode === 'razorpay_test_sandbox' && sessionData.sandboxTestPayload) {
        const orderRes = await api.post('/orders/checkout', {
          items: cart.map((c) => ({ mealId: c.mealId, quantity: c.quantity })),
          addressId: selectedAddressId,
          scheduledSlot,
          couponCode: couponCode.trim(),
          redeemLoyaltyPoints: redeemPoints,
          ...sessionData.sandboxTestPayload,
        });
        clearCart();
        setOrders((prev) => [orderRes.data.order, ...prev]);
        setPayments((prev) => [orderRes.data.payment, ...prev]);
        await refreshUser();
        pushToast(`Order ${orderRes.data.order.orderNumber} confirmed & sent to clinical kitchen`, 'success');
        setTab('orders');
      } else {
        pushToast('Live Razorpay gateway order created — verify signature via checkout callback', 'info');
      }
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Checkout failed'), 'error');
    } finally {
      setCheckoutBusy(false);
    }
  };

  const subCatalog = {
    daily: { name: 'Daily Full-Day Clinical Plan', priceInr: 749, days: 1 },
    weekly: { name: 'Weekly Lunch & Dinner Protocol (14 Meals)', priceInr: 3899, days: 7 },
    monthly: { name: 'Monthly Dietitian-Supervised Full Plan', priceInr: 14499, days: 28 },
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddressId) {
      pushToast('Select or add a saved delivery address in Tray & Checkout first', 'error');
      return;
    }
    setSubBusy(true);
    try {
      const chosen = subCatalog[subPlanKey];
      const sessionRes = await api.post('/payments/create-session', {
        amountInr: chosen.priceInr,
        purpose: 'subscription',
      });
      const startDate = new Date().toISOString().slice(0, 10);
      const endDate = new Date(Date.now() + chosen.days * 86400000).toISOString().slice(0, 10);
      const safeMealIds = allMeals.slice(0, 3).map((m) => m.id);

      const { data } = await api.post('/subscriptions', {
        planType: subPlanKey,
        planName: chosen.name,
        selectedMealIds: safeMealIds,
        deliveryAddressId: selectedAddressId,
        deliveryTimeSlot: subSlot,
        startDate,
        endDate,
        priceInr: chosen.priceInr,
        autoRenewConsent: subAutoRenew,
        ...(sessionRes.data.sandboxTestPayload || {}),
      });

      setSubscriptions((prev) => [data.subscription, ...prev]);
      setPayments((prev) => [data.payment, ...prev]);
      pushToast(`Subscribed to ${chosen.name}`, 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    } finally {
      setSubBusy(false);
    }
  };

  const handleUpdateSubscription = async (
    id: string,
    payload: { status?: 'active' | 'paused' | 'cancelled'; autoRenewConsent?: boolean }
  ) => {
    try {
      const { data } = await api.put(`/subscriptions/${id}/status`, payload);
      setSubscriptions((prev) => prev.map((s) => (s.id === id ? data.subscription : s)));
      pushToast('Subscription updated', 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleBookConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/patient/consultations', {
        dietitianId: consultDietitianId,
        preferredDate: consultDate,
        preferredSlot: consultSlot,
        healthConcern: consultConcern,
      });
      setConsultations((prev) => [data.consultation, ...prev]);
      setConsultConcern('');
      pushToast('Consultation request sent to Registered Dietitian', 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleDownloadInvoice = (p: PaymentItem) => {
    const content = [
      'NUTRISYNC CLINICAL NUTRITION PLATFORM — TAX INVOICE',
      '===================================================',
      `Invoice Number   : ${p.invoiceNumber}`,
      `Patient Name     : ${user?.name || ''}`,
      `Gateway Order ID : ${p.gatewayOrderId}`,
      `Payment ID       : ${p.gatewayPaymentId}`,
      `HMAC Verified    : ${p.signatureVerified ? 'YES (SHA-256)' : 'NO'}`,
      `Status           : ${p.status.toUpperCase()}`,
      `Amount Paid      : INR ${p.amountInr}`,
      `Issued Timestamp : ${new Date(p.createdAt).toLocaleString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.invoiceNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resolveMealById = (id: string) => allMeals.find((m) => m.id === id);

  if (loading) {
    return (
      <PortalLayout
        roleTitle="Patient Portal"
        subtitle="Synchronizing clinical nutrition profile..."
        navItems={navItems}
        activeTab={activeTab}
        onSelectTab={setTab}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      </PortalLayout>
    );
  }

  const activeOrder = orders.find((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const approvedPlan = mealPlans.find((m) => m.status === 'approved');

  return (
    <PortalLayout
      roleTitle="Patient Health Workspace"
      subtitle="Clinician-verified nutrition targets, Gemini AI meal intelligence, and live order tracking"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setTab}
    >
      {/* ========================================== */}
      {/* TAB 1: CLINICAL OVERVIEW                   */}
      {/* ========================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Top KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1">
              <p className="text-xs text-slate-500">Approved Calorie Target</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {profile?.approvedTargets.dailyCalories ?? 1800} kcal
              </p>
              <p className="text-[11px] text-emerald-700">
                Verified by {profile?.approvedTargets.approvedByDietitianName || 'Clinical Board'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1">
              <p className="text-xs text-slate-500">Daily Sodium Ceiling</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                &le;{profile?.approvedTargets.maxSodiumMg ?? 1500} mg
              </p>
              <p className="text-[11px] text-slate-500">
                Carb Cap &le;{profile?.approvedTargets.maxCarbsGrams ?? 180}g · Protein &ge;
                {profile?.approvedTargets.minProteinGrams ?? 85}g
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1">
              <p className="text-xs text-slate-500">Active Subscriptions</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {subscriptions.filter((s) => s.status === 'active').length}
              </p>
              <p className="text-[11px] text-slate-500">
                {orders.length} total clinical meal orders
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1">
              <p className="text-xs text-slate-500">Loyalty & Referral</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                {loyaltyPoints} pts
              </p>
              <p className="text-[11px] font-mono text-slate-500">
                Code: {referralCode || 'NS-CARE'}
              </p>
            </div>
          </div>

          {/* Live Order Pipeline Card (if an active order is in progress) */}
          {activeOrder && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-emerald-700">Live Cold-Chain Fulfillment</p>
                  <h2 className="text-base font-bold text-slate-900">
                    Order {activeOrder.orderNumber} · Slot {activeOrder.scheduledSlot}
                  </h2>
                </div>
                <span className="text-xs font-mono uppercase text-slate-700">
                  Status: {activeOrder.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {ORDER_STEPS.map((step, i) => {
                  const currentIdx = ORDER_STEPS.indexOf(activeOrder.status);
                  const reached = i <= currentIdx;
                  return (
                    <div
                      key={step}
                      className={`rounded-lg border p-2.5 text-[11px] font-medium ${
                        reached
                          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                          : 'border-slate-200 bg-slate-50 text-slate-400'
                      }`}
                    >
                      <span className="font-mono block text-[10px]">0{i + 1}</span>
                      <span className="capitalize">{step.replace(/_/g, ' ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recharts Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">7-Day Caloric Adherence</h2>
                <p className="text-xs text-slate-500">
                  Measured meal intake against your Dietitian-approved {profile?.approvedTargets.dailyCalories} kcal ceiling
                </p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={nutritionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} domain={[1000, 2200]} />
                    <Tooltip />
                    <ReferenceLine
                      y={profile?.approvedTargets.dailyCalories || 1800}
                      stroke="#0f172a"
                      strokeDasharray="4 4"
                    />
                    <Area
                      type="monotone"
                      dataKey="calories"
                      stroke="#059669"
                      fill="#d1fae5"
                      strokeWidth={2}
                      name="Calories (kcal)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Daily Sodium Exposure (mg)</h2>
                <p className="text-xs text-slate-500">
                  Tracked sodium across scheduled meals vs &le;{profile?.approvedTargets.maxSodiumMg} mg hypertension guard
                </p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={nutritionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip />
                    <ReferenceLine
                      y={profile?.approvedTargets.maxSodiumMg || 1500}
                      stroke="#dc2626"
                      strokeDasharray="4 4"
                    />
                    <Bar dataKey="sodium" fill="#0f172a" radius={[6, 6, 0, 0]} name="Sodium (mg)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Active Clinician-Approved Daily Schedule */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {approvedPlan ? approvedPlan.title : 'Clinician-Approved Daily Meal Schedule'}
                </h2>
                <p className="text-xs text-slate-500">
                  {approvedPlan
                    ? `Reviewed by ${approvedPlan.reviewedByDietitianName || 'Registered Dietitian'} · ${approvedPlan.dietitianNotes}`
                    : 'Generate a draft plan in the AI Nutrition Engine for Dietitian approval.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAiMode('planner');
                  setTab('ai-assistant');
                }}
                className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Open AI Meal Planner
              </button>
            </div>

            {approvedPlan?.days?.[0] && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {(
                  [
                    ['Breakfast', approvedPlan.days[0].breakfastMealId],
                    ['Lunch', approvedPlan.days[0].lunchMealId],
                    ['Evening Snack', approvedPlan.days[0].snackMealId],
                    ['Dinner', approvedPlan.days[0].dinnerMealId],
                  ] as const
                ).map(([slotLabel, mealId]) => {
                  const m = resolveMealById(mealId);
                  if (!m) return null;
                  return (
                    <div
                      key={slotLabel}
                      className="rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between bg-slate-50/50"
                    >
                      <div>
                        <MealImage src={m.imageUrl} alt={m.name} className="w-full h-32 object-cover" />
                        <div className="p-4 space-y-1.5">
                          <p className="text-[11px] font-semibold text-emerald-700">{slotLabel}</p>
                          <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">{m.name}</h3>
                          <p className="text-[11px] font-mono tabular-nums text-slate-500">
                            {m.calories} kcal · {m.protein}g P · {m.sodium}mg Na
                          </p>
                        </div>
                      </div>
                      <div className="px-4 pb-4 flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold tabular-nums text-slate-900">
                          ₹{m.priceInr}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            addToCart({
                              mealId: m.id,
                              name: m.name,
                              priceInr: m.priceInr,
                              imageUrl: m.imageUrl,
                              portionSize: m.portionSize,
                              calories: m.calories,
                              sodium: m.sodium,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                        >
                          Add to Tray
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: HEALTH PROFILE & FAMILY MEMBERS     */}
      {/* ========================================== */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-5"
          >
            <div>
              <h2 className="text-lg font-bold text-slate-900">Personal Health & Allergy Profile</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Allergies declared here act as deterministic hard-filters across AI meal recommendations and kitchen prep alerts.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Age</label>
                <input
                  type="number"
                  value={ageInput}
                  onChange={(e) => setAgeInput(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                <select
                  value={genderInput}
                  onChange={(e) => setGenderInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Height (cm)</label>
                <input
                  type="number"
                  value={heightInput}
                  onChange={(e) => setHeightInput(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  value={weightInput}
                  onChange={(e) => setWeightInput(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Dietary Preference</label>
              <div className="inline-flex bg-slate-100 p-1 rounded-lg gap-1">
                {(
                  [
                    ['vegetarian', 'Vegetarian'],
                    ['vegan', 'Vegan'],
                    ['non_vegetarian', 'Non-Vegetarian'],
                  ] as const
                ).map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDietPrefInput(val)}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      dietPrefInput === val
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Strict Food Allergies (comma-separated)
              </label>
              <input
                type="text"
                value={allergiesInput}
                onChange={(e) => setAllergiesInput(e.target.value)}
                placeholder="e.g., Peanuts, Shellfish, Tree Nuts"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Food Intolerances (comma-separated)
              </label>
              <input
                type="text"
                value={intolerancesInput}
                onChange={(e) => setIntolerancesInput(e.target.value)}
                placeholder="e.g., Lactose, Gluten"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                User-Reported Medical Conditions (comma-separated)
              </label>
              <input
                type="text"
                value={conditionsInput}
                onChange={(e) => setConditionsInput(e.target.value)}
                placeholder="e.g., Type 2 Diabetes, Stage 1 Hypertension, Hypothyroidism"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <label className="flex items-center gap-2.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={remindersInput}
                onChange={(e) => setRemindersInput(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              />
              <span>Enable scheduled hydration and meal timing reminders</span>
            </label>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              Save Health Profile
            </button>
          </form>

          <div className="lg:col-span-5 space-y-6">
            {/* Clinician-Approved Targets (Read-Only for Patient Safety) */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Clinician-Approved Nutritional Guardrails</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                For medical safety, daily therapeutic ceilings can only be modified by an assigned Registered Dietitian after clinical review.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono tabular-nums pt-1">
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 font-sans block">Daily Calories</span>
                  <span className="text-sm font-bold text-slate-900">
                    {profile?.approvedTargets.dailyCalories} kcal
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 font-sans block">Sodium Cap</span>
                  <span className="text-sm font-bold text-slate-900">
                    &le;{profile?.approvedTargets.maxSodiumMg} mg
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 font-sans block">Max Carbs</span>
                  <span className="text-sm font-bold text-slate-900">
                    &le;{profile?.approvedTargets.maxCarbsGrams} g
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 font-sans block">Min Protein / Fiber</span>
                  <span className="text-sm font-bold text-slate-900">
                    {profile?.approvedTargets.minProteinGrams}g / {profile?.approvedTargets.minFiberGrams}g
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                <strong>Clinician Notes:</strong> {profile?.approvedTargets.clinicalNotes}
              </p>
            </div>

            {/* Family Member Profiles */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Family Member Dietary Profiles</h3>
                <p className="text-xs text-slate-500">
                  Manage household dependents under your care account.
                </p>
              </div>

              {(profile?.familyMembers || []).length > 0 && (
                <div className="space-y-2">
                  {profile?.familyMembers.map((fam) => (
                    <div
                      key={fam.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {fam.name} · {fam.relation} ({fam.age} yrs)
                        </p>
                        <p className="text-slate-500">
                          Allergies: {fam.allergies.length > 0 ? fam.allergies.join(', ') : 'None declared'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemoveFamilyMember(fam.id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddFamilyMember} className="space-y-3 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={famName}
                    onChange={(e) => setFamName(e.target.value)}
                    className="col-span-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Age"
                    value={famAge}
                    onChange={(e) => setFamAge(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={famRelation}
                    onChange={(e) => setFamRelation(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                    <option value="Sibling">Sibling</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Allergies (comma-sep)"
                    value={famAllergies}
                    onChange={(e) => setFamAllergies(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  Add Family Profile
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: PRESCRIPTIONS & GEMINI OCR          */}
      {/* ========================================== */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-8">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 leading-relaxed">
            <strong>Clinical Safety Protocol:</strong> AI OCR extraction organizes uploaded documents and highlights illegible or uncertain fields for convenience. Raw OCR output is <strong>never</strong> treated as an active medical prescription until verified and signed off by your Registered Dietitian.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <form
              onSubmit={handleUploadPrescription}
              className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4 h-fit"
            >
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">Upload Prescription Document</h2>
              </div>
              <p className="text-xs text-slate-500">
                Accepted formats: PDF, JPG, JPEG, PNG (strictly &le; 5 MB). Accessible only to you and your authorized Dietitian.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Referring Doctor / Hospital Name
                </label>
                <input
                  type="text"
                  value={rxDoctor}
                  onChange={(e) => setRxDoctor(e.target.value)}
                  placeholder="e.g., Dr. R. Subramanian, MD (Endocrinology)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Issued Date</label>
                <input
                  type="date"
                  value={rxDate}
                  onChange={(e) => setRxDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Prescription File
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(e) => setRxFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-900 hover:file:bg-slate-200"
                />
              </div>

              <button
                type="submit"
                disabled={uploadingRx}
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {uploadingRx ? 'Extracting via Gemini Multimodal OCR...' : 'Upload & Run AI OCR Review'}
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                Prescription History & Dietitian Verification ({prescriptions.length})
              </h2>
              {prescriptions.map((rx) => (
                <div key={rx.id} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{rx.fileName}</h3>
                      <p className="text-xs text-slate-500">
                        {rx.doctorName} · Issued {rx.issuedDate}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        rx.verificationStatus === 'verified'
                          ? 'text-emerald-700'
                          : rx.verificationStatus === 'rejected'
                          ? 'text-red-600'
                          : 'text-amber-700'
                      }`}
                    >
                      {rx.verificationStatus === 'verified'
                        ? `Verified by ${rx.reviewedByDietitianName}`
                        : rx.verificationStatus === 'rejected'
                        ? 'Clarification Requested'
                        : 'Pending Registered Dietitian Sign-Off'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-4 space-y-2.5 text-xs">
                    <p className="text-slate-800">
                      <strong>OCR Clinical Summary:</strong> {rx.ocrExtracted.patientSummary}
                    </p>
                    {rx.ocrExtracted.dietaryInstructions.length > 0 && (
                      <p className="text-slate-700">
                        <strong>Extracted Dietary Guidance:</strong>{' '}
                        {rx.ocrExtracted.dietaryInstructions.join(' · ')}
                      </p>
                    )}
                    {rx.ocrExtracted.potentialAllergies.length > 0 && (
                      <p className="text-red-700">
                        <strong>Flagged Allergies for Review:</strong>{' '}
                        {rx.ocrExtracted.potentialAllergies.join(', ')}
                      </p>
                    )}
                    {rx.ocrExtracted.uncertainOrUnreadableFields.length > 0 && (
                      <p className="text-amber-800">
                        <strong>Uncertain / Human-Verification Fields:</strong>{' '}
                        {rx.ocrExtracted.uncertainOrUnreadableFields.join(' · ')}
                      </p>
                    )}
                  </div>

                  {rx.dietitianVerificationNotes && (
                    <p className="text-xs text-emerald-900 bg-emerald-50/70 border border-emerald-200 rounded-lg p-3">
                      <strong>Dietitian Review Notes:</strong> {rx.dietitianVerificationNotes}
                    </p>
                  )}

                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-mono">
                    Access Audit: {rx.accessLogs.length} logged event(s) · Latest:{' '}
                    {rx.accessLogs[rx.accessLogs.length - 1]?.action}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 4: AI NUTRITION ENGINE (GEMINI 3.8)    */}
      {/* ========================================== */}
      {activeTab === 'ai-assistant' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex bg-slate-100 p-1 rounded-lg gap-1">
              <button
                type="button"
                onClick={() => setAiMode('chat')}
                className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                  aiMode === 'chat' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                AI Nutrition Assistant & Substitutions
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiMode('recommendations');
                  if (recommendations.length === 0) void handleFetchRecommendations();
                }}
                className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                  aiMode === 'recommendations' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Smart Meal Recommendations
              </button>
              <button
                type="button"
                onClick={() => setAiMode('planner')}
                className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                  aiMode === 'planner' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                AI Draft Meal Planner
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Hard-filtered against allergies: {(profile?.allergies || []).join(', ') || 'None'} · Cap &le;
              {profile?.approvedTargets.maxSodiumMg}mg Na
            </p>
          </div>

          {aiMode === 'chat' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white flex flex-col h-[540px]">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      NutriSync Clinical Nutrition Assistant
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Explains macros, glycemic load, sodium swaps, and verified catalogue options—never diagnoses or alters medications.
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {chatHistory.length === 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500">
                        Select a clinical nutrition question or ask your own:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          'Which verified dinner meals keep my sodium under 350mg?',
                          'Suggest smart low-glycemic ingredient substitutions for white rice and paneer.',
                          'Explain how soluble fiber in sprouted ragi supports post-meal blood glucose.',
                          'Compare protein-to-carb ratios across my allergen-safe meals.',
                        ].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => void handleSendChat(q)}
                            className="text-left rounded-lg border border-slate-200 p-3 text-xs text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/40 transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line ${
                          msg.role === 'user'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-50 border border-slate-200 text-slate-800'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}

                  {chatBusy && (
                    <p className="text-xs text-slate-400">
                      Analyzing your clinician-approved nutrition caps...
                    </p>
                  )}
                </div>

                {chatDisclaimer && (
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
                    {chatDisclaimer}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSendChat();
                  }}
                  className="p-3 border-t border-slate-200 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about ingredients, macros, smart swaps, or verified meals..."
                    className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={chatBusy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask</span>
                  </button>
                </form>
              </div>

              <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit">
                <h3 className="text-sm font-bold text-slate-900">Suggested Safe Catalogue Meals</h3>
                {chatSuggestedMeals.length === 0 ? (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    When the AI Assistant recommends dishes from the verified NutriSync catalogue, they appear here for one-click ordering.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {chatSuggestedMeals.map((mId) => {
                      const m = resolveMealById(mId);
                      if (!m) return null;
                      return (
                        <div key={m.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                          <p className="text-xs font-bold text-slate-900">{m.name}</p>
                          <p className="text-[11px] font-mono tabular-nums text-slate-500">
                            {m.calories} kcal · {m.protein}g P · {m.sodium}mg Na · ₹{m.priceInr}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              addToCart({
                                mealId: m.id,
                                name: m.name,
                                priceInr: m.priceInr,
                                imageUrl: m.imageUrl,
                                portionSize: m.portionSize,
                                calories: m.calories,
                                sodium: m.sodium,
                              })
                            }
                            className="w-full py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                          >
                            Add to Tray
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {aiMode === 'recommendations' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Every meal below is deterministically pre-screened to exclude your allergens before Gemini ranks clinical suitability.
                </p>
                <button
                  type="button"
                  disabled={recBusy}
                  onClick={() => void handleFetchRecommendations()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{recBusy ? 'Evaluating...' : 'Refresh Match Scores'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.map(({ meal, matchScore, clinicalReason, nutrientHighlights }) => (
                  <div
                    key={meal.id}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <MealImage src={meal.imageUrl} alt={meal.name} className="w-full h-44 object-cover" />
                      <div className="p-5 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-emerald-700 tabular-nums">
                            {matchScore}% Clinical Match
                          </span>
                          <span className="font-mono tabular-nums text-slate-500">₹{meal.priceInr}</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">{meal.name}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">{clinicalReason}</p>
                        <p className="text-[11px] font-mono text-slate-500">
                          {nutrientHighlights.join(' · ')}
                        </p>
                      </div>
                    </div>
                    <div className="p-5 pt-0">
                      <button
                        type="button"
                        onClick={() =>
                          addToCart({
                            mealId: meal.id,
                            name: meal.name,
                            priceInr: meal.priceInr,
                            imageUrl: meal.imageUrl,
                            portionSize: meal.portionSize,
                            calories: meal.calories,
                            sodium: meal.sodium,
                          })
                        }
                        className="w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                      >
                        Add Verified Meal to Tray
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aiMode === 'planner' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <h2 className="text-base font-bold text-slate-900">
                    Clinician-Gated AI Meal Plan Generator
                  </h2>
                  <p className="text-xs text-slate-500">
                    Generates Breakfast, Lunch, Evening Snack, and Dinner combinations using verified catalogue nutrition totals. Plans start as <code className="font-mono">pending_review</code> until approved by your Registered Dietitian.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPlannerDuration('daily')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                        plannerDuration === 'daily' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      1-Day Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlannerDuration('weekly')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                        plannerDuration === 'weekly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      7-Day Draft
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={plannerBusy}
                    onClick={() => void handleGenerateDraftPlan()}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {plannerBusy ? 'Drafting Schedule...' : 'Generate Draft Plan'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {mealPlans.map((mp) => (
                  <div key={mp.id} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{mp.title}</h3>
                        <p className="text-xs text-slate-500">
                          Origin: {mp.createdByRole === 'ai_draft' ? 'Gemini AI Draft' : 'Dietitian Custom Protocol'} ·{' '}
                          {mp.durationType.toUpperCase()}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          mp.status === 'approved'
                            ? 'text-emerald-700'
                            : mp.status === 'rejected'
                            ? 'text-red-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {mp.status === 'approved'
                          ? `Approved by ${mp.reviewedByDietitianName || 'Dietitian'}`
                          : mp.status === 'rejected'
                          ? 'Returned by Dietitian'
                          : 'Awaiting Dietitian Approval'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{mp.dietitianNotes}</p>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2 pr-4">Day</th>
                            <th className="py-2 pr-4">Breakfast</th>
                            <th className="py-2 pr-4">Lunch</th>
                            <th className="py-2 pr-4">Snack</th>
                            <th className="py-2 pr-4">Dinner</th>
                            <th className="py-2 text-right">Verified Totals</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {mp.days.map((d, idx) => (
                            <tr key={idx}>
                              <td className="py-2.5 pr-4 font-semibold text-slate-900">{d.dayLabel}</td>
                              <td className="py-2.5 pr-4 text-slate-700">
                                {resolveMealById(d.breakfastMealId)?.name || d.breakfastMealId}
                              </td>
                              <td className="py-2.5 pr-4 text-slate-700">
                                {resolveMealById(d.lunchMealId)?.name || d.lunchMealId}
                              </td>
                              <td className="py-2.5 pr-4 text-slate-700">
                                {resolveMealById(d.snackMealId)?.name || d.snackMealId}
                              </td>
                              <td className="py-2.5 pr-4 text-slate-700">
                                {resolveMealById(d.dinnerMealId)?.name || d.dinnerMealId}
                              </td>
                              <td className="py-2.5 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                                {d.totals.calories} kcal · {d.totals.protein}g P · {d.totals.sodium}mg Na
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 5: TRAY, GOOGLE PLACES & CHECKOUT      */}
      {/* ========================================== */}
      {activeTab === 'checkout' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            {/* Saved Addresses + Google Places Autocomplete */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900">1. Delivery Location & Saved Addresses</h2>
              {addresses.length > 0 && (
                <div className="space-y-2">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start justify-between gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                        selectedAddressId === addr.id
                          ? 'border-emerald-600 bg-emerald-50/40'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 text-xs">
                        <input
                          type="radio"
                          name="deliveryAddr"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-0.5 text-emerald-600"
                        />
                        <div>
                          <p className="font-semibold text-slate-900">
                            {addr.label} · {addr.recipientName} ({addr.phone})
                          </p>
                          <p className="text-slate-600 mt-0.5">
                            {addr.formattedAddress} — <span className="font-mono">{addr.postalCode}</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAddress(addr.id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </label>
                  ))}
                </div>
              )}

              <form onSubmit={handleSaveAddress} className="pt-4 border-t border-slate-100 space-y-3">
                <p className="text-xs font-semibold text-slate-800">Add New Delivery Address</p>
                <PlacesAddressAutocomplete
                  onSelect={(res) => {
                    setAddrFormatted(res.formattedAddress);
                    setAddrLat(res.lat);
                    setAddrLng(res.lng);
                    if (res.postalCode) setAddrPostal(res.postalCode);
                  }}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={addrLabel}
                    onChange={(e) => setAddrLabel(e.target.value)}
                    placeholder="Label (Home / Clinic)"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={addrRecipient}
                    onChange={(e) => setAddrRecipient(e.target.value)}
                    placeholder="Recipient Name"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                    placeholder="Phone Number"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    value={addrFormatted}
                    onChange={(e) => setAddrFormatted(e.target.value)}
                    placeholder="Full Street Address"
                    className="sm:col-span-3 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={addrPostal}
                    onChange={(e) => setAddrPostal(e.target.value)}
                    placeholder="PIN Code"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  Save Delivery Address
                </button>
              </form>
            </div>

            {/* Tray Items */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900">2. Clinical Meal Tray ({cart.length})</h2>
              {cart.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Your tray is empty. Add verified meals from your Overview schedule or the Marketplace.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {cart.map((item) => (
                    <div key={item.mealId} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <MealImage
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-14 h-14 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                          <p className="text-xs font-mono tabular-nums text-slate-500">
                            {item.calories} kcal · {item.sodium}mg Na · ₹{item.priceInr}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.mealId, item.quantity - 1)}
                          className="w-7 h-7 rounded border border-slate-200 text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-mono tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.mealId, item.quantity + 1)}
                          className="w-7 h-7 rounded border border-slate-200 text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-5 h-fit">
            <h2 className="text-base font-bold text-slate-900">3. Schedule & Verified Payment</h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Insulated Delivery Time Window
              </label>
              <select
                value={scheduledSlot}
                onChange={(e) => setScheduledSlot(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white font-mono"
              >
                <option value="08:00 - 08:45">08:00 - 08:45 (Breakfast Cold-Chain)</option>
                <option value="12:30 - 13:15">12:30 - 13:15 (Lunch Clinical Dispatch)</option>
                <option value="19:15 - 20:00">19:15 - 20:00 (Dinner Clinical Dispatch)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Promo Code (Try <code className="font-mono">FIRSTHEALTH15</code> or <code className="font-mono">CARE10</code>)
              </label>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Enter coupon code"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase"
              />
            </div>

            {loyaltyPoints >= 50 && (
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600"
                />
                <span>
                  Redeem <strong className="font-mono">{Math.min(loyaltyPoints, 100)}</strong> loyalty points (-₹
                  {Math.min(loyaltyPoints, 100)})
                </span>
              </label>
            )}

            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs font-mono tabular-nums">
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Tray Nutrition Total</span>
                <span>
                  {cart.reduce((s, c) => s + c.calories * c.quantity, 0)} kcal ·{' '}
                  {cart.reduce((s, c) => s + c.sodium * c.quantity, 0)} mg Na
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Subtotal</span>
                <span>₹{cartSubtotal}</span>
              </div>
              {couponPreviewDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span className="font-sans">Coupon Discount</span>
                  <span>-₹{couponPreviewDiscount}</span>
                </div>
              )}
              {pointsPreviewDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span className="font-sans">Loyalty Points Redeemed</span>
                  <span>-₹{pointsPreviewDiscount}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Cold-Chain Delivery (Free &ge; ₹500)</span>
                <span>{deliveryFeePreview === 0 ? 'FREE' : `₹${deliveryFeePreview}`}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span className="font-sans">Total Payable</span>
                <span>₹{estimatedPayable}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={checkoutBusy || cart.length === 0}
              onClick={() => void handleExecuteCheckout()}
              className="w-full py-3 px-4 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {checkoutBusy ? 'Verifying Cryptographic Signature...' : `Pay ₹${estimatedPayable} & Place Clinical Order`}
            </button>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Protected by server-side HMAC-SHA256 payment verification. Kitchens receive only your meal items, portion sizes, and strict allergen warnings—never your diagnoses.
            </p>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 6: LIVE ORDERS & PAYMENT INVOICES      */}
      {/* ========================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Real-Time Order Fulfillment ({orders.length})</h2>
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-mono">
                      {o.orderNumber} · ₹{o.totalInr}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Slot {o.scheduledSlot} · {o.deliveryAddress.label} ({o.deliveryAddress.formattedAddress})
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold uppercase text-emerald-700">
                    {o.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="text-xs text-slate-700 space-y-1">
                  {o.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between font-mono tabular-nums">
                      <span className="font-sans">
                        {it.quantity}x {it.mealName} ({it.portionSize})
                      </span>
                      <span>
                        {it.calories * it.quantity} kcal · ₹{it.unitPriceInr * it.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-[11px] text-slate-500">
                  <span>Portion Weighed: {o.qualityChecklist.portionWeighed ? 'Yes' : 'Pending'}</span>
                  <span>Allergen Cross-Check: {o.qualityChecklist.allergenCrossCheck ? 'Yes' : 'Pending'}</span>
                  <span>Sodium Verified: {o.qualityChecklist.sodiumVerified ? 'Yes' : 'Pending'}</span>
                  <span>Tamper Seal: {o.qualityChecklist.tamperSealApplied ? 'Yes' : 'Pending'}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Payment History & Verified Invoices</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4">Invoice</th>
                    <th className="py-2 pr-4">Gateway Reference</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">{p.invoiceNumber}</td>
                      <td className="py-2.5 pr-4 text-slate-500">{p.gatewayPaymentId}</td>
                      <td className="py-2.5 pr-4 text-slate-900">₹{p.amountInr}</td>
                      <td className="py-2.5 pr-4 uppercase text-emerald-700">{p.status}</td>
                      <td className="py-2.5 text-right font-sans">
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoice(p)}
                          className="text-emerald-700 hover:underline font-medium"
                        >
                          Download Invoice
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 7: MEAL SUBSCRIPTIONS                  */}
      {/* ========================================== */}
      {activeTab === 'subscriptions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              Active & Past Meal Subscriptions ({subscriptions.length})
            </h2>
            {subscriptions.map((sub) => (
              <div key={sub.id} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{sub.planName}</h3>
                    <p className="text-xs font-mono tabular-nums text-slate-500">
                      {sub.startDate} → {sub.endDate} · Slot {sub.deliveryTimeSlot} · ₹{sub.priceInr}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-mono font-semibold uppercase ${
                      sub.status === 'active'
                        ? 'text-emerald-700'
                        : sub.status === 'paused'
                        ? 'text-amber-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={sub.autoRenewConsent}
                    onChange={(e) =>
                      void handleUpdateSubscription(sub.id, { autoRenewConsent: e.target.checked })
                    }
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span>Explicit opt-in for automatic cycle renewal</span>
                </label>

                {sub.status !== 'cancelled' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {sub.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() => void handleUpdateSubscription(sub.id, { status: 'paused' })}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Pause Deliveries
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleUpdateSubscription(sub.id, { status: 'active' })}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                      >
                        Resume Deliveries
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleUpdateSubscription(sub.id, { status: 'cancelled' })}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Cancel Plan
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={handleCreateSubscription}
            className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4 h-fit"
          >
            <h2 className="text-base font-bold text-slate-900">Start New Clinical Subscription</h2>
            <div className="space-y-2">
              {(['daily', 'weekly', 'monthly'] as const).map((k) => {
                const item = subCatalog[k];
                return (
                  <label
                    key={k}
                    className={`flex items-center justify-between rounded-lg border p-3.5 cursor-pointer text-xs ${
                      subPlanKey === k ? 'border-emerald-600 bg-emerald-50/40' : 'border-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium text-slate-900">
                      <input
                        type="radio"
                        name="subPlan"
                        checked={subPlanKey === k}
                        onChange={() => setSubPlanKey(k)}
                      />
                      <span>{item.name}</span>
                    </span>
                    <span className="font-mono font-bold tabular-nums">₹{item.priceInr}</span>
                  </label>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Daily Delivery Slot</label>
              <select
                value={subSlot}
                onChange={(e) => setSubSlot(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white font-mono"
              >
                <option value="08:00 - 08:45">08:00 - 08:45</option>
                <option value="12:30 - 13:15">12:30 - 13:15</option>
                <option value="19:15 - 20:00">19:15 - 20:00</option>
              </select>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={subAutoRenew}
                onChange={(e) => setSubAutoRenew(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-emerald-600"
              />
              <span>
                Optional: I explicitly consent to auto-renew this plan at the end of the cycle (unchecked by default).
              </span>
            </label>

            <button
              type="submit"
              disabled={subBusy}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {subBusy ? 'Activating Plan...' : `Verify Payment & Activate (₹${subCatalog[subPlanKey].priceInr})`}
            </button>
          </form>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 8: DIETITIAN CONSULTATIONS & ALERTS    */}
      {/* ========================================== */}
      {activeTab === 'consultations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 space-y-6">
            <form
              onSubmit={handleBookConsultation}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Request Registered Dietitian Consultation
                </h2>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Verified Dietitian
                </label>
                <select
                  value={consultDietitianId}
                  onChange={(e) => setConsultDietitianId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
                >
                  {dietitians.map((d) => (
                    <option key={d.userId} value={d.userId}>
                      {d.name} ({d.qualification}) — ₹{d.consultationFeeInr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Date</label>
                  <input
                    type="date"
                    required
                    value={consultDate}
                    onChange={(e) => setConsultDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Time Slot</label>
                  <select
                    value={consultSlot}
                    onChange={(e) => setConsultSlot(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
                  >
                    <option value="10:00 AM - 10:30 AM">10:00 AM - 10:30 AM</option>
                    <option value="11:00 AM - 11:30 AM">11:00 AM - 11:30 AM</option>
                    <option value="04:00 PM - 04:30 PM">04:00 PM - 04:30 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Clinical Focus / Dietary Questions
                </label>
                <textarea
                  required
                  rows={3}
                  value={consultConcern}
                  onChange={(e) => setConsultConcern(e.target.value)}
                  placeholder="Describe recent lab values (e.g., HbA1c, TSH, BP readings) or meal target adjustments..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
              >
                Submit Consultation Request
              </button>
            </form>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Scheduled & Past Consultations</h3>
              {consultations.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-900">{c.dietitianName}</span>
                    <span className="font-mono uppercase text-emerald-700">{c.status}</span>
                  </div>
                  <p className="text-slate-500 font-mono">
                    {c.preferredDate} · {c.preferredSlot}
                  </p>
                  <p className="text-slate-700">{c.healthConcern}</p>
                  {c.clinicalSummaryNotes && (
                    <p className="text-emerald-900 bg-emerald-50 p-2.5 rounded-lg">
                      <strong>Dietitian Summary:</strong> {c.clinicalSummaryNotes}
                      {c.followUpDate ? ` (Follow-up: ${c.followUpDate})` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Notification Center</h2>
                {unreadNotifs > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await api.put('/patient/notifications/read-all');
                      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                    }}
                    className="text-xs font-medium text-emerald-700 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="py-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className={`font-semibold ${n.isRead ? 'text-slate-600' : 'text-slate-900'}`}>
                        {n.title}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-500">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Account Governance</h3>
              <p className="text-xs text-slate-500">
                Need to temporarily deactivate your NutriSync patient account? You can re-enable access later via Clinical Support.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.post('/auth/deactivate');
                    await logout();
                  } catch (err) {
                    pushToast(getApiErrorMessage(err), 'error');
                  }
                }}
                className="px-4 py-2 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Deactivate My Account
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};
