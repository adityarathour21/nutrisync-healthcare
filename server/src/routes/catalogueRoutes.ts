import { Router, Response } from 'express';
import { dbStore } from '../config/store.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.js';

export const catalogueRouter = Router();

catalogueRouter.get('/categories', (_req, res) => {
  res.json({ categories: dbStore.data.categories });
});

catalogueRouter.get('/meals', (req, res) => {
  const {
    search = '',
    category = '',
    dietaryType = '',
    maxPrice,
    maxSodium,
    maxCarbs,
    minProtein,
    excludeAllergen = '',
    sort = 'featured',
  } = req.query as Record<string, string>;

  let results = dbStore.data.meals.filter((m) => m.isAvailable);

  if (search.trim()) {
    const q = search.toLowerCase().trim();
    results = results.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.ingredients.some((i) => i.toLowerCase().includes(q)) ||
        m.suitableLabels.some((l) => l.toLowerCase().includes(q))
    );
  }

  if (category && category !== 'all') {
    results = results.filter((m) => m.categorySlug === category);
  }

  if (dietaryType && dietaryType !== 'all') {
    results = results.filter((m) => m.dietaryType === dietaryType);
  }

  if (maxPrice && !Number.isNaN(Number(maxPrice))) {
    results = results.filter((m) => m.priceInr <= Number(maxPrice));
  }

  if (maxSodium && !Number.isNaN(Number(maxSodium))) {
    results = results.filter((m) => m.sodium <= Number(maxSodium));
  }

  if (maxCarbs && !Number.isNaN(Number(maxCarbs))) {
    results = results.filter((m) => m.carbs <= Number(maxCarbs));
  }

  if (minProtein && !Number.isNaN(Number(minProtein))) {
    results = results.filter((m) => m.protein >= Number(minProtein));
  }

  if (excludeAllergen.trim()) {
    const excluded = excludeAllergen
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    results = results.filter(
      (m) => !excluded.some((alg) => m.allergens.some((ma) => ma.toLowerCase().includes(alg)))
    );
  }

  if (sort === 'price_asc') results.sort((a, b) => a.priceInr - b.priceInr);
  else if (sort === 'price_desc') results.sort((a, b) => b.priceInr - a.priceInr);
  else if (sort === 'calories_asc') results.sort((a, b) => a.calories - b.calories);
  else if (sort === 'protein_desc') results.sort((a, b) => b.protein - a.protein);
  else if (sort === 'sodium_asc') results.sort((a, b) => a.sodium - b.sodium);

  res.json({ meals: results });
});

catalogueRouter.get('/meals/:id', (req, res) => {
  const meal = dbStore.data.meals.find((m) => m.id === req.params.id || m.slug === req.params.id);
  if (!meal) {
    res.status(404).json({ error: 'Meal not found.' });
    return;
  }
  const reviews = dbStore.data.reviews.filter(
    (r) => r.mealId === meal.id && r.moderationStatus === 'approved'
  );
  res.json({ meal, reviews });
});

catalogueRouter.get('/dietitians', (_req, res) => {
  const verified = dbStore.data.dietitianProfiles.filter((d) => d.verificationStatus === 'verified');
  res.json({ dietitians: verified });
});

catalogueRouter.get('/coupons', (_req, res) => {
  res.json({
    coupons: dbStore.data.coupons,
    settings: dbStore.data.platformSettings,
  });
});

catalogueRouter.post(
  '/reviews',
  requireAuth,
  requireRole('patient'),
  (req: AuthenticatedRequest, res: Response) => {
    const { mealId, rating, comment, isComplaint = false } = req.body as {
      mealId?: string;
      rating?: number;
      comment?: string;
      isComplaint?: boolean;
    };

    if (!mealId || !rating || !comment?.trim()) {
      res.status(400).json({ error: 'Meal, rating (1-5), and comment are required.' });
      return;
    }

    const meal = dbStore.data.meals.find((m) => m.id === mealId);
    if (!meal) {
      res.status(404).json({ error: 'Meal not found.' });
      return;
    }

    const newReview = {
      id: `rev_${Date.now()}`,
      patientId: req.user!.id,
      patientName: req.user!.name,
      mealId: meal.id,
      mealName: meal.name,
      rating: Math.min(5, Math.max(1, Number(rating))),
      comment: comment.trim(),
      moderationStatus: 'approved' as const,
      isComplaint: Boolean(isComplaint),
      adminResolution: '',
      createdAt: new Date().toISOString(),
    };

    dbStore.data.reviews.unshift(newReview);
    dbStore.persist();

    res.status(201).json({ review: newReview });
  }
);
