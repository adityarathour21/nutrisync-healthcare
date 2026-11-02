import { Router, Response } from 'express';
import { dbStore, MealPlanRecord } from '../config/store.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { emitToUser } from '../sockets/socketHub.js';

export const clinicalRouter = Router();

clinicalRouter.use(requireAuth, requireRole('dietitian', 'admin'));

function getAuthorizedPatientIds(dietitianId: string, role: string): Set<string> {
  if (role === 'admin') {
    return new Set(dbStore.data.patientProfiles.map((p) => p.userId));
  }
  const ids = new Set<string>();
  dbStore.data.patientProfiles.forEach((p) => {
    if (p.assignedDietitianId === dietitianId || !p.assignedDietitianId) {
      ids.add(p.userId);
    }
  });
  dbStore.data.consultations.forEach((c) => {
    if (c.dietitianId === dietitianId) {
      ids.add(c.patientId);
    }
  });
  return ids;
}

clinicalRouter.get('/dashboard', (req: AuthenticatedRequest, res: Response) => {
  const authorizedIds = getAuthorizedPatientIds(req.user!.id, req.user!.role);

  const patients = dbStore.data.patientProfiles
    .filter((p) => authorizedIds.has(p.userId))
    .map((profile) => {
      const user = dbStore.data.users.find((u) => u.id === profile.userId);
      return {
        ...profile,
        patientName: user?.name || 'Patient',
        patientEmail: user?.email || '',
        patientPhone: user?.phone || '',
      };
    });

  const prescriptions = dbStore.data.prescriptions.filter((rx) => authorizedIds.has(rx.patientId));
  const mealPlans = dbStore.data.mealPlans.filter((mp) => authorizedIds.has(mp.patientId));
  const consultations = dbStore.data.consultations.filter(
    (c) => req.user!.role === 'admin' || c.dietitianId === req.user!.id
  );
  const dietitianProfile = dbStore.data.dietitianProfiles.find((d) => d.userId === req.user!.id);

  res.json({
    dietitianProfile,
    patients,
    prescriptions,
    mealPlans,
    consultations,
    verifiedMeals: dbStore.data.meals.filter((m) => m.isAvailable),
  });
});

clinicalRouter.put('/patients/:patientId/targets', (req: AuthenticatedRequest, res: Response) => {
  const patientId = String(req.params.patientId);
  const authorizedIds = getAuthorizedPatientIds(req.user!.id, req.user!.role);
  if (!authorizedIds.has(patientId)) {
    res.status(403).json({ error: 'Not authorized to manage this patient record.' });
    return;
  }

  const profile = dbStore.data.patientProfiles.find((p) => p.userId === patientId);
  if (!profile) {
    res.status(404).json({ error: 'Patient profile not found.' });
    return;
  }

  const {
    dailyCalories,
    maxCarbsGrams,
    minProteinGrams,
    maxFatGrams,
    minFiberGrams,
    maxSodiumMg,
    restrictedIngredients,
    allergies,
    clinicalNotes,
  } = req.body;

  profile.assignedDietitianId = req.user!.id;
  profile.approvedTargets = {
    dailyCalories: Number(dailyCalories ?? profile.approvedTargets.dailyCalories),
    maxCarbsGrams: Number(maxCarbsGrams ?? profile.approvedTargets.maxCarbsGrams),
    minProteinGrams: Number(minProteinGrams ?? profile.approvedTargets.minProteinGrams),
    maxFatGrams: Number(maxFatGrams ?? profile.approvedTargets.maxFatGrams),
    minFiberGrams: Number(minFiberGrams ?? profile.approvedTargets.minFiberGrams),
    maxSodiumMg: Number(maxSodiumMg ?? profile.approvedTargets.maxSodiumMg),
    restrictedIngredients: Array.isArray(restrictedIngredients)
      ? restrictedIngredients.map(String).filter(Boolean)
      : profile.approvedTargets.restrictedIngredients,
    approvedByDietitianId: req.user!.id,
    approvedByDietitianName: req.user!.name,
    approvedAt: new Date().toISOString(),
    clinicalNotes: String(clinicalNotes ?? profile.approvedTargets.clinicalNotes),
  };

  if (Array.isArray(allergies)) {
    profile.allergies = allergies.map(String).filter(Boolean);
  }

  dbStore.addAuditLog({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    action: 'NUTRITION_TARGETS_APPROVED',
    resourceType: 'PatientProfile',
    resourceId: patientId,
    details: `Approved ${profile.approvedTargets.dailyCalories} kcal / <=${profile.approvedTargets.maxSodiumMg}mg Na targets`,
  });

  const notif = dbStore.addNotification(
    patientId,
    'Clinical Nutrition Targets Updated',
    `${req.user!.name} reviewed and approved your daily macro and sodium limits.`,
    'clinical'
  );
  emitToUser(patientId, 'notification:new', notif);
  dbStore.persist();

  res.json({ profile });
});

clinicalRouter.put('/prescriptions/:id/verify', (req: AuthenticatedRequest, res: Response) => {
  const rx = dbStore.data.prescriptions.find((p) => p.id === req.params.id);
  if (!rx) {
    res.status(404).json({ error: 'Prescription not found.' });
    return;
  }

  const authorizedIds = getAuthorizedPatientIds(req.user!.id, req.user!.role);
  if (!authorizedIds.has(rx.patientId)) {
    res.status(403).json({ error: 'Not authorized to verify this prescription.' });
    return;
  }

  const { status, notes, maxSodiumMg, maxCarbsGrams, dailyCalories, addedAllergies } = req.body as {
    status?: 'verified' | 'rejected';
    notes?: string;
    maxSodiumMg?: number;
    maxCarbsGrams?: number;
    dailyCalories?: number;
    addedAllergies?: string[];
  };

  if (status !== 'verified' && status !== 'rejected') {
    res.status(400).json({ error: 'Verification status must be verified or rejected.' });
    return;
  }

  rx.verificationStatus = status;
  rx.reviewedByDietitianId = req.user!.id;
  rx.reviewedByDietitianName = req.user!.name;
  rx.dietitianVerificationNotes = String(notes || '');
  rx.accessLogs.push({
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: `prescription_${status}`,
    timestamp: new Date().toISOString(),
  });

  if (status === 'verified') {
    const profile = dbStore.data.patientProfiles.find((p) => p.userId === rx.patientId);
    if (profile) {
      if (maxSodiumMg) profile.approvedTargets.maxSodiumMg = Number(maxSodiumMg);
      if (maxCarbsGrams) profile.approvedTargets.maxCarbsGrams = Number(maxCarbsGrams);
      if (dailyCalories) profile.approvedTargets.dailyCalories = Number(dailyCalories);
      if (Array.isArray(addedAllergies) && addedAllergies.length > 0) {
        const merged = new Set([...profile.allergies, ...addedAllergies.map((a) => a.trim()).filter(Boolean)]);
        profile.allergies = Array.from(merged);
      }
      profile.approvedTargets.approvedByDietitianId = req.user!.id;
      profile.approvedTargets.approvedByDietitianName = req.user!.name;
      profile.approvedTargets.approvedAt = new Date().toISOString();
    }
  }

  dbStore.addAuditLog({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    action: `PRESCRIPTION_${status.toUpperCase()}`,
    resourceType: 'Prescription',
    resourceId: rx.id,
    details: rx.dietitianVerificationNotes || `Prescription marked ${status}`,
  });

  const notif = dbStore.addNotification(
    rx.patientId,
    `Prescription ${status === 'verified' ? 'Verified' : 'Requires Clarification'}`,
    `${req.user!.name} marked ${rx.fileName} as ${status}.`,
    'clinical'
  );
  emitToUser(rx.patientId, 'notification:new', notif);
  dbStore.persist();

  res.json({ prescription: rx });
});

clinicalRouter.post('/meal-plans', (req: AuthenticatedRequest, res: Response) => {
  const { patientId, title, durationType = 'daily', dietitianNotes = '', days } = req.body;
  const authorizedIds = getAuthorizedPatientIds(req.user!.id, req.user!.role);
  if (!authorizedIds.has(String(patientId))) {
    res.status(403).json({ error: 'Not authorized to create meal plans for this patient.' });
    return;
  }

  const patientUser = dbStore.data.users.find((u) => u.id === patientId);
  if (!patientUser || !Array.isArray(days) || days.length === 0) {
    res.status(400).json({ error: 'Valid patient and meal schedule days are required.' });
    return;
  }

  const resolveMeal = (id: string) =>
    dbStore.data.meals.find((m) => m.id === id) || dbStore.data.meals[0];

  const computedDays = days.map((d: Record<string, string>, idx: number) => {
    const b = resolveMeal(d.breakfastMealId);
    const l = resolveMeal(d.lunchMealId);
    const s = resolveMeal(d.snackMealId);
    const dn = resolveMeal(d.dinnerMealId);
    return {
      dayLabel: d.dayLabel || `Day ${idx + 1}`,
      breakfastMealId: b.id,
      lunchMealId: l.id,
      snackMealId: s.id,
      dinnerMealId: dn.id,
      totals: {
        calories: b.calories + l.calories + s.calories + dn.calories,
        protein: b.protein + l.protein + s.protein + dn.protein,
        carbs: b.carbs + l.carbs + s.carbs + dn.carbs,
        fat: b.fat + l.fat + s.fat + dn.fat,
        fiber: b.fiber + l.fiber + s.fiber + dn.fiber,
        sodium: b.sodium + l.sodium + s.sodium + dn.sodium,
      },
    };
  });

  const plan: MealPlanRecord = {
    id: `mp_${Date.now()}`,
    patientId: patientUser.id,
    patientName: patientUser.name,
    createdByRole: 'dietitian',
    reviewedByDietitianId: req.user!.id,
    reviewedByDietitianName: req.user!.name,
    title: String(title || 'Custom Clinician-Approved Meal Protocol'),
    durationType: durationType === 'weekly' ? 'weekly' : 'daily',
    status: 'approved',
    dietitianNotes: String(dietitianNotes),
    days: computedDays,
    createdAt: new Date().toISOString(),
  };

  dbStore.data.mealPlans.unshift(plan);
  const notif = dbStore.addNotification(
    patientUser.id,
    'New Clinician-Approved Meal Plan',
    `${req.user!.name} assigned "${plan.title}" to your dashboard.`,
    'clinical'
  );
  emitToUser(patientUser.id, 'notification:new', notif);
  dbStore.persist();

  res.status(201).json({ mealPlan: plan });
});

clinicalRouter.put('/meal-plans/:id/review', (req: AuthenticatedRequest, res: Response) => {
  const plan = dbStore.data.mealPlans.find((m) => m.id === req.params.id);
  if (!plan) {
    res.status(404).json({ error: 'Meal plan not found.' });
    return;
  }

  const authorizedIds = getAuthorizedPatientIds(req.user!.id, req.user!.role);
  if (!authorizedIds.has(plan.patientId)) {
    res.status(403).json({ error: 'Not authorized to review this meal plan.' });
    return;
  }

  const { status, dietitianNotes } = req.body as {
    status?: 'approved' | 'rejected';
    dietitianNotes?: string;
  };
  if (status !== 'approved' && status !== 'rejected') {
    res.status(400).json({ error: 'Status must be approved or rejected.' });
    return;
  }

  plan.status = status;
  plan.reviewedByDietitianId = req.user!.id;
  plan.reviewedByDietitianName = req.user!.name;
  if (dietitianNotes !== undefined) {
    plan.dietitianNotes = String(dietitianNotes);
  }

  dbStore.addAuditLog({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    action: `MEAL_PLAN_${status.toUpperCase()}`,
    resourceType: 'MealPlan',
    resourceId: plan.id,
    details: `Dietitian ${status} meal plan "${plan.title}"`,
  });

  const notif = dbStore.addNotification(
    plan.patientId,
    `Meal Plan ${status === 'approved' ? 'Approved' : 'Returned'}`,
    `${req.user!.name} ${status} "${plan.title}".`,
    'clinical'
  );
  emitToUser(plan.patientId, 'notification:new', notif);
  dbStore.persist();

  res.json({ mealPlan: plan });
});

clinicalRouter.put('/consultations/:id', (req: AuthenticatedRequest, res: Response) => {
  const consult = dbStore.data.consultations.find((c) => c.id === req.params.id);
  if (!consult) {
    res.status(404).json({ error: 'Consultation not found.' });
    return;
  }
  if (req.user!.role !== 'admin' && consult.dietitianId !== req.user!.id) {
    res.status(403).json({ error: 'Not authorized to update this consultation.' });
    return;
  }

  const { status, clinicalSummaryNotes, followUpDate } = req.body;
  if (status) consult.status = status;
  if (clinicalSummaryNotes !== undefined) consult.clinicalSummaryNotes = String(clinicalSummaryNotes);
  if (followUpDate !== undefined) consult.followUpDate = String(followUpDate);

  const notif = dbStore.addNotification(
    consult.patientId,
    `Consultation ${consult.status}`,
    `${req.user!.name} updated your consultation for ${consult.preferredDate}.`,
    'clinical'
  );
  emitToUser(consult.patientId, 'notification:new', notif);
  dbStore.persist();

  res.json({ consultation: consult });
});
