import { Router, Response } from 'express';
import { dbStore, MealPlanRecord } from '../config/store.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import {
  askNutritionAssistant,
  filterSafeMealsForPatient,
  generateDraftMealPlan,
  generateSmartRecommendations,
} from '../services/aiService.js';
import { emitToRole, emitToUser } from '../sockets/socketHub.js';

export const aiRouter = Router();

aiRouter.post('/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { question, history } = req.body as {
      question?: string;
      history?: { role: 'user' | 'assistant'; text: string }[];
    };

    if (!question?.trim()) {
      res.status(400).json({ error: 'Please enter a nutrition question.' });
      return;
    }

    const profile = dbStore.data.patientProfiles.find((p) => p.userId === req.user!.id);
    const safeMeals = filterSafeMealsForPatient(dbStore.data.meals, profile);

    const result = await askNutritionAssistant({
      question: question.trim(),
      history,
      profile,
      safeMeals,
    });

    res.json(result);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'AI Nutrition Assistant is temporarily unavailable.',
    });
  }
});

aiRouter.post('/recommendations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = dbStore.data.patientProfiles.find((p) => p.userId === req.user!.id);
    if (!profile) {
      res.status(404).json({ error: 'Patient health profile required for personalized recommendations.' });
      return;
    }

    const safeMeals = filterSafeMealsForPatient(dbStore.data.meals, profile);
    const aiExplanations = await generateSmartRecommendations({ profile, safeMeals });

    const enriched = safeMeals.map((meal) => {
      const match = aiExplanations.find((e) => e.mealId === meal.id);
      return {
        meal,
        matchScore: match?.matchScore ?? 88,
        clinicalReason:
          match?.clinicalReason ??
          `Verified under your ${profile.approvedTargets.maxSodiumMg}mg daily sodium and ${profile.approvedTargets.maxCarbsGrams}g carbohydrate caps while excluding all documented allergens.`,
        nutrientHighlights: match?.nutrientHighlights ?? [
          `${meal.protein}g Protein`,
          `${meal.fiber}g Fiber`,
          `${meal.sodium}mg Sodium`,
        ],
      };
    });

    enriched.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      approvedTargets: profile.approvedTargets,
      excludedAllergies: profile.allergies,
      recommendations: enriched,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to generate AI meal recommendations.',
    });
  }
});

aiRouter.post('/meal-planner', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { durationType = 'daily' } = req.body as { durationType?: 'daily' | 'weekly' };
    const profile = dbStore.data.patientProfiles.find((p) => p.userId === req.user!.id);
    if (!profile) {
      res.status(404).json({ error: 'Patient profile not found.' });
      return;
    }

    const safeMeals = filterSafeMealsForPatient(dbStore.data.meals, profile);
    if (safeMeals.length === 0) {
      res.status(400).json({
        error: 'No verified catalogue meals currently match all your strict allergy and dietary filters. Please request a custom Dietitian plan.',
      });
      return;
    }

    const draft = await generateDraftMealPlan({
      profile,
      safeMeals,
      durationType: durationType === 'weekly' ? 'weekly' : 'daily',
    });

    const fallbackMeal = safeMeals[0];
    const resolveMeal = (id: string) => safeMeals.find((m) => m.id === id) || fallbackMeal;

    const computedDays = (draft.days || []).map((day, idx) => {
      const b = resolveMeal(day.breakfastMealId);
      const l = resolveMeal(day.lunchMealId);
      const s = resolveMeal(day.snackMealId);
      const d = resolveMeal(day.dinnerMealId);

      return {
        dayLabel: day.dayLabel || `Day ${idx + 1}`,
        breakfastMealId: b.id,
        lunchMealId: l.id,
        snackMealId: s.id,
        dinnerMealId: d.id,
        totals: {
          calories: b.calories + l.calories + s.calories + d.calories,
          protein: b.protein + l.protein + s.protein + d.protein,
          carbs: b.carbs + l.carbs + s.carbs + d.carbs,
          fat: b.fat + l.fat + s.fat + d.fat,
          fiber: b.fiber + l.fiber + s.fiber + d.fiber,
          sodium: b.sodium + l.sodium + s.sodium + d.sodium,
        },
      };
    });

    const planRecord: MealPlanRecord = {
      id: `mp_${Date.now()}`,
      patientId: req.user!.id,
      patientName: req.user!.name,
      createdByRole: 'ai_draft',
      reviewedByDietitianId: null,
      reviewedByDietitianName: null,
      title: draft.title || `AI Draft ${durationType === 'weekly' ? '7-Day' : 'Daily'} Nutrition Plan`,
      durationType: durationType === 'weekly' ? 'weekly' : 'daily',
      status: 'pending_review',
      dietitianNotes: `AI Draft Rationale: ${draft.clinicalRationale || 'Awaiting Certified Dietitian verification before activation.'}`,
      days: computedDays,
      createdAt: new Date().toISOString(),
    };

    dbStore.data.mealPlans.unshift(planRecord);
    dbStore.persist();

    if (profile.assignedDietitianId) {
      const notif = dbStore.addNotification(
        profile.assignedDietitianId,
        'AI Draft Meal Plan Pending Approval',
        `${req.user!.name} generated "${planRecord.title}" for clinical review.`,
        'clinical'
      );
      emitToUser(profile.assignedDietitianId, 'notification:new', notif);
    }
    emitToRole('dietitian', 'mealplan:draft_created', { id: planRecord.id });

    res.status(201).json({ mealPlan: planRecord });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to generate AI draft meal plan.',
    });
  }
});
