import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Heart, Search, ShieldCheck, Star } from 'lucide-react';
import { api, getApiErrorMessage } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { MealImage } from '../../components/MealImage';

export interface MealDto {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  dietaryType: 'vegetarian' | 'vegan' | 'non_vegetarian';
  ingredients: string[];
  allergens: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  portionSize: string;
  priceInr: number;
  prepTimeMins: number;
  isAvailable: boolean;
  suitableLabels: string[];
  nutritionalVerificationStatus: string;
  verifiedByDietitianName: string;
  ratingAvg: number;
  ratingCount: number;
}

// ==========================================
// 1. HOME PAGE (4 Focused Sections: Hero -> Capabilities Bento -> Featured Meals -> Clinical Proof)
// ==========================================
export const HomePage: React.FC = () => {
  const { t, addToCart } = useApp();
  const [featuredMeals, setFeaturedMeals] = useState<MealDto[]>([]);

  useEffect(() => {
    api.get('/meals').then(({ data }) => {
      setFeaturedMeals((data.meals || []).slice(0, 3));
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-20 pb-12">
      {/* Section 1: Split Hero */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <p className="text-xs font-medium text-emerald-700">
              Clinician-Reviewed Therapeutic Nutrition · Allergen-Segregated Kitchens
            </p>
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-[1.12] max-w-xl">
              Precision meals verified by dietitians for your health profile.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              NutriSync connects patients managing diabetes, hypertension, thyroid conditions, and weight goals with Registered Dietitians, AI-assisted prescription structuring, and fresh macro-measured meals delivered home.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/marketplace"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
              >
                <span>{t('exploreMeals')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="px-5 py-3 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                Try Role Portals (Demo)
              </Link>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:col-span-6"
          >
            <div className="h-full min-h-[320px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
              <MealImage
                src="/images/hero_nutrisync_plate.jpg"
                alt="NutriSync balanced clinical plate with herb salmon, quinoa, broccoli, and avocado"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </div>

        {/* Full-Width Clinical Proof Strip below Hero */}
        <div className="border-t border-slate-100 bg-slate-50/70">
          <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">&lt;380 mg</p>
              <p className="text-xs text-slate-500 mt-1">Measured sodium ceiling on DASH low-sodium plates</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">100%</p>
              <p className="text-xs text-slate-500 mt-1">Medical meal plans reviewed by Registered Dietitians</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">5 Roles</p>
              <p className="text-xs text-slate-500 mt-1">Integrated Patient, Dietitian, Chef, Delivery & Admin workflows</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">Zero PHI Leak</p>
              <p className="text-xs text-slate-500 mt-1">Kitchens receive portion & allergen alerts without medical records</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Asymmetric Clinical Workflow Bento */}
      <section className="max-w-7xl mx-auto px-6 space-y-8">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">
            Clinical governance meets everyday meal convenience
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every recommendation respects human-approved nutritional boundaries. AI assists with document structuring and meal matching—never autonomous medical diagnosis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-7 space-y-3">
            <p className="text-xs font-mono text-emerald-700">01. Prescription OCR & Dietitian Sign-Off</p>
            <h3 className="text-lg font-semibold text-slate-900">
              Upload your doctor’s dietary notes; a Registered Dietitian verifies every limit
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Our Gemini-powered document assistant extracts dietary instructions, potential food allergies, and uncertain handwritten notes into a structured draft. Nothing activates until your assigned Registered Dietitian verifies and signs off on your daily calorie, carbohydrate, protein, and sodium targets.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-7 space-y-3">
            <p className="text-xs font-mono text-emerald-700">02. Hard Allergen Gate</p>
            <h3 className="text-lg font-semibold text-slate-900">
              Deterministic safety filtering
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Meals containing documented allergens or exceeding per-meal sodium and carbohydrate thresholds are excluded before AI ranking runs.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-7 space-y-3">
            <p className="text-xs font-mono text-emerald-700">03. Privacy-Safe Kitchens</p>
            <h3 className="text-lg font-semibold text-slate-900">
              4-step culinary quality checklist
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Chefs weigh portions, cross-check nut/allergen utensils, verify rock-salt limits, and apply tamper seals without ever viewing private diagnoses.
            </p>
          </div>

          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-7 space-y-3">
            <p className="text-xs font-mono text-emerald-700">04. Flexible Subscriptions & Real-Time Dispatch</p>
            <h3 className="text-lg font-semibold text-slate-900">
              Daily, weekly, or monthly plans with pause/resume freedom and live Socket.IO updates
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Subscribe to breakfast-only, lunch-and-dinner, or full-day clinician-approved plans. Track kitchen preparation, quality sign-off, cold-chain pickup, and doorstep delivery in real time.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Featured Verified Meals */}
      <section className="max-w-7xl mx-auto px-6 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">
              Dietitian-verified meals ready today
            </h2>
            <p className="text-sm text-slate-600">
              Macro-calibrated recipes with verified calorie, fiber, and sodium disclosures.
            </p>
          </div>
          <Link
            to="/marketplace"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
          >
            View full marketplace →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredMeals.map((meal) => (
            <div
              key={meal.id}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col hover:-translate-y-0.5 transition-transform duration-150"
            >
              <Link to={`/marketplace/${meal.id}`} className="block aspect-[4/3] overflow-hidden bg-slate-100">
                <MealImage
                  src={meal.imageUrl}
                  alt={meal.name}
                  className="w-full h-full object-cover"
                />
              </Link>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-500">
                    {meal.categoryName} · {meal.dietaryType.replace('_', '-')} · Verified by {meal.verifiedByDietitianName}
                  </p>
                  <Link
                    to={`/marketplace/${meal.id}`}
                    className="text-base font-semibold text-slate-900 hover:text-emerald-700 block"
                  >
                    {meal.name}
                  </Link>
                  <p className="text-xs font-mono tabular-nums text-slate-600">
                    {meal.calories} kcal · {meal.protein}g protein · {meal.carbs}g carbs · {meal.sodium}mg Na
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                    ₹{meal.priceInr}
                  </span>
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
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    Add to Tray
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Attributable Patient & Clinician Outcomes */}
      <section className="max-w-7xl mx-auto px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-3">
            <p className="text-xs text-emerald-700 font-medium">Clinical Review Standard</p>
            <p className="text-base text-slate-800 leading-relaxed">
              “Patients discharged with diabetes or DASH hypertension guidelines struggle most with daily ingredient weighing and hidden restaurant sodium. Having AI pre-structure prescriptions while keeping final macro caps strictly in the Registered Dietitian’s hands makes home adherence realistic.”
            </p>
            <p className="text-xs text-slate-500">
              Dr. Meera Nair, PhD, RD · Lead Clinical Dietitian, Manipal Metabolic & Endocrine Care Center
            </p>
          </div>
          <div className="space-y-3 lg:border-l lg:border-slate-200 lg:pl-8">
            <p className="text-xs text-emerald-700 font-medium">Verified Patient Experience</p>
            <p className="text-base text-slate-800 leading-relaxed">
              “Before NutriSync, ordering lunch meant guessing salt and oil levels. After uploading my endocrinologist’s summary, my dietitian locked a 1,500mg daily sodium ceiling and peanut exclusion—every meal arrives weighed and steady on my post-meal glucose.”
            </p>
            <p className="text-xs text-slate-500">
              Aarav Sharma · Software Architect, Bengaluru · Managing Type 2 Diabetes & Stage 1 Hypertension
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

// ==========================================
// 2. SMART MEAL MARKETPLACE PAGE
// ==========================================
export const MarketplacePage: React.FC = () => {
  const { user, addToCart, pushToast } = useApp();
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [dietaryType, setDietaryType] = useState('all');
  const [maxSodium, setMaxSodium] = useState<number>(600);
  const [maxPrice, setMaxPrice] = useState<number>(600);
  const [sort, setSort] = useState('featured');
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.categories || [])).catch(() => {});
    if (user?.role === 'patient') {
      api.get('/patient/dashboard').then(({ data }) => {
        setFavorites(data.profile?.favoriteMealIds || []);
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    api
      .get('/meals', {
        params: {
          search,
          category,
          dietaryType,
          maxSodium,
          maxPrice,
          sort,
        },
      })
      .then(({ data }) => setMeals(data.meals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, category, dietaryType, maxSodium, maxPrice, sort]);

  const toggleFav = async (mealId: string) => {
    if (!user || user.role !== 'patient') {
      pushToast('Sign in as a Patient to save favorite meals', 'info');
      return;
    }
    try {
      const { data } = await api.post(`/patient/favorites/${mealId}`);
      setFavorites(data.favoriteMealIds || []);
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Smart Clinical Meal Marketplace</h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          Every dish displays laboratory-calculated macronutrients, fiber, and sodium verified by a Registered Dietitian. Suitability labels indicate general nutritional alignment and do not replace individualized medical advice.
        </p>
      </div>

      {/* Interactive Search & Filter Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search meals, ingredients (quinoa, paneer, salmon)..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={dietaryType}
              onChange={(e) => setDietaryType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="all">All Dietary Preferences</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan (Plant-Based)</option>
              <option value="non_vegetarian">Non-Vegetarian</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="featured">Sort: Dietitian Featured</option>
              <option value="sodium_asc">Sodium: Lowest First</option>
              <option value="protein_desc">Protein: Highest First</option>
              <option value="calories_asc">Calories: Lowest First</option>
              <option value="price_asc">Price: Low to High</option>
            </select>
          </div>
        </div>

        {/* Interactive Segmented Category Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              category === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setCategory(cat.slug)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                category === cat.slug ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1 text-xs text-slate-600">
          <label className="flex items-center justify-between gap-4">
            <span className="whitespace-nowrap">Max Sodium per Meal: <strong className="font-mono tabular-nums text-slate-900">{maxSodium} mg</strong></span>
            <input
              type="range"
              min={200}
              max={600}
              step={20}
              value={maxSodium}
              onChange={(e) => setMaxSodium(Number(e.target.value))}
              className="w-44 accent-emerald-600"
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span className="whitespace-nowrap">Max Price: <strong className="font-mono tabular-nums text-slate-900">₹{maxPrice}</strong></span>
            <input
              type="range"
              min={200}
              max={600}
              step={25}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-44 accent-emerald-600"
            />
          </label>
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-96 rounded-xl border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : meals.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <p className="text-base font-semibold text-slate-900">No meals match your current nutrient filters</p>
          <p className="text-xs text-slate-500">Try widening the sodium or price slider, or switch category tabs.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategory('all');
              setDietaryType('all');
              setMaxSodium(600);
              setMaxPrice(600);
            }}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {meals.map((meal) => {
            const isFav = favorites.includes(meal.id);
            return (
              <div
                key={meal.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col hover:-translate-y-0.5 transition-transform duration-150"
              >
                <div className="relative aspect-[4/3] bg-slate-100">
                  <Link to={`/marketplace/${meal.id}`} className="block w-full h-full">
                    <MealImage src={meal.imageUrl} alt={meal.name} className="w-full h-full object-cover" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => void toggleFav(meal.id)}
                    aria-label="Save favorite meal"
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/90 text-slate-700 hover:text-red-600 shadow-xs"
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : ''}`} />
                  </button>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs text-slate-500">
                      {meal.categoryName} · {meal.portionSize} · {meal.prepTimeMins} min prep
                    </p>
                    <Link
                      to={`/marketplace/${meal.id}`}
                      className="text-base font-semibold text-slate-900 hover:text-emerald-700 block"
                    >
                      {meal.name}
                    </Link>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {meal.description}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-slate-700 pt-1">
                      {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g · Fiber {meal.fiber}g · Na {meal.sodium}mg
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Allergens: {meal.allergens.length > 0 ? meal.allergens.join(', ') : 'None declared'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                        ₹{meal.priceInr}
                      </span>
                      <span className="text-xs text-slate-500 ml-2 font-mono tabular-nums">
                        ★ {meal.ratingAvg} ({meal.ratingCount})
                      </span>
                    </div>
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
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
                    >
                      Add to Tray
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. CONTIGUOUS MEAL DETAIL PAGE (PDP)
// ==========================================
export const MealDetailPage: React.FC = () => {
  const { id } = useParams();
  const { user, addToCart, pushToast } = useApp();
  const [meal, setMeal] = useState<MealDto | null>(null);
  const [reviews, setReviews] = useState<
    { id: string; patientName: string; rating: number; comment: string; createdAt: string }[]
  >([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/meals/${id}`)
      .then(({ data }) => {
        setMeal(data.meal);
        setReviews(data.reviews || []);
      })
      .catch(() => setMeal(null))
      .finally(() => setLoading(false));
  }, [id]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meal) return;
    try {
      const { data } = await api.post('/reviews', { mealId: meal.id, rating, comment });
      setReviews((prev) => [data.review, ...prev]);
      setComment('');
      pushToast('Review submitted', 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto px-6 py-12"><div className="h-96 bg-white rounded-xl border border-slate-200 animate-pulse" /></div>;
  }

  if (!meal) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Meal Not Found</h1>
        <Link to="/marketplace" className="text-sm font-semibold text-emerald-700">← Return to Marketplace</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
      <Link to="/marketplace" className="text-xs font-medium text-slate-500 hover:text-slate-900">
        ← Back to Smart Meal Marketplace
      </Link>

      {/* Contiguous Purchase Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-slate-200 bg-white">
          <MealImage src={meal.imageUrl} alt={meal.name} className="w-full aspect-[4/3] object-cover" />
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-7 space-y-6">
          <div className="space-y-2">
            <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Nutritionally Verified by {meal.verifiedByDietitianName}</span>
            </p>
            <h1 className="text-2xl font-bold text-slate-900">{meal.name}</h1>
            <p className="text-xs text-slate-500">
              {meal.categoryName} · Portion {meal.portionSize} · Ready in {meal.prepTimeMins} mins
            </p>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">{meal.description}</p>

          {/* Tabular Nutritional Disclosure */}
          <div className="grid grid-cols-3 gap-3 py-4 border-y border-slate-100 text-center font-mono tabular-nums">
            <div>
              <p className="text-lg font-bold text-slate-900">{meal.calories}</p>
              <p className="text-[11px] font-sans text-slate-500">Calories (kcal)</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{meal.protein}g</p>
              <p className="text-[11px] font-sans text-slate-500">Protein</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{meal.carbs}g</p>
              <p className="text-[11px] font-sans text-slate-500">Carbohydrates</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{meal.fat}g</p>
              <p className="text-[11px] font-sans text-slate-500">Total Fat</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{meal.fiber}g</p>
              <p className="text-[11px] font-sans text-slate-500">Dietary Fiber</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-700">{meal.sodium}mg</p>
              <p className="text-[11px] font-sans text-slate-500">Sodium</p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <p><strong className="text-slate-900">Ingredients:</strong> {meal.ingredients.join(', ')}</p>
            <p><strong className="text-slate-900">Declared Allergens:</strong> {meal.allergens.join(', ') || 'None'}</p>
            <p><strong className="text-slate-900">Suitability Alignment:</strong> {meal.suitableLabels.join(' · ')}</p>
            <p className="text-[11px] text-slate-400">
              Medical safety note: Suitability tags reflect macro/sodium verification and do not guarantee suitability for every individual patient without dietitian approval.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">₹{meal.priceInr}</p>
              <p className="text-xs text-slate-500">Includes allergen-segregated clinical packaging</p>
            </div>
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
              className="px-6 py-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              Add to Tray
            </button>
          </div>
        </div>
      </div>

      {/* Patient Reviews */}
      <div className="rounded-2xl border border-slate-200 bg-white p-7 space-y-6">
        <h2 className="text-lg font-semibold text-slate-900">Verified Patient Feedback</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-500">No patient reviews yet for this dish.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((r) => (
              <div key={r.id} className="py-4 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-900">{r.patientName}</span>
                  <span>·</span>
                  <span className="font-mono tabular-nums text-amber-600 flex items-center gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-amber-500" /> {r.rating}/5
                  </span>
                </div>
                <p className="text-sm text-slate-700">{r.comment}</p>
              </div>
            ))}
          </div>
        )}

        {user?.role === 'patient' && (
          <form onSubmit={submitReview} className="pt-4 border-t border-slate-100 space-y-3 max-w-xl">
            <p className="text-xs font-semibold text-slate-900">Share your post-meal experience</p>
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-600">Rating:</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="rounded border border-slate-300 px-2.5 py-1 text-xs"
              >
                {[5, 4, 3, 2, 1].map((v) => (
                  <option key={v} value={v}>{v} Stars</option>
                ))}
              </select>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              required
              placeholder="How did this meal fit your dietary preferences and satiety?"
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
            >
              Submit Feedback
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 4. DIETITIAN DIRECTORY, PRICING, HOW IT WORKS, ABOUT, FAQ, CONTACT, LEGAL
// ==========================================
export const DietitianDirectoryPage: React.FC = () => {
  const { user } = useApp();
  const navigate = useNavigate();
  const [dietitians, setDietitians] = useState<
    {
      userId: string;
      name: string;
      qualification: string;
      licenseNumber: string;
      specializations: string[];
      experienceYears: number;
      hospitalAffiliation: string;
      consultationFeeInr: number;
      bio: string;
      rating: number;
    }[]
  >([]);

  useEffect(() => {
    api.get('/dietitians').then(({ data }) => setDietitians(data.dietitians || [])).catch(() => {});
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Certified Clinical Dietitians</h1>
        <p className="text-sm text-slate-600">
          Every practitioner on NutriSync holds verified dietetics credentials and reviews prescription OCR extractions and personalized macro targets before meal plan activation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dietitians.map((d) => (
          <div key={d.userId} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-emerald-700 font-mono">
                License {d.licenseNumber} · {d.experienceYears} yrs clinical practice · ★ {d.rating}
              </p>
              <h2 className="text-lg font-bold text-slate-900">{d.name}</h2>
              <p className="text-xs text-slate-500">{d.qualification} · {d.hospitalAffiliation}</p>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{d.bio}</p>
            <p className="text-xs text-slate-500">
              Specializations: {d.specializations.join(' · ')}
            </p>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm font-mono font-semibold tabular-nums text-slate-900">
                Consultation: ₹{d.consultationFeeInr}
              </span>
              <button
                type="button"
                onClick={() =>
                  navigate(user ? '/portal/patient?tab=consultations' : '/login')
                }
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
              >
                Request Consultation
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PricingPage: React.FC = () => {
  const { user } = useApp();
  const navigate = useNavigate();

  const plans = [
    {
      audience: 'For daily glycemic or low-sodium trial',
      name: 'Daily Full-Day Clinical Plan',
      type: 'daily',
      price: 749,
      cadence: 'per day',
      limits: '3 verified meals + 1 high-fiber snack · <=1,500mg Na ceiling · Dietitian target sync',
    },
    {
      audience: 'For consistent 7-day metabolic adherence',
      name: 'Weekly Lunch & Dinner Protocol',
      type: 'weekly',
      price: 3899,
      cadence: 'per week (14 meals)',
      limits: '14 chef-prepared clinical meals · Free cold-chain delivery · Pause/resume anytime',
    },
    {
      audience: 'For comprehensive chronic care transformation',
      name: 'Monthly Dietitian-Supervised Full Plan',
      type: 'monthly',
      price: 14499,
      cadence: 'per 28 days (56+ meals)',
      limits: '2 Registered Dietitian consultations included · Prescription OCR updates · Family profile support',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Transparent Clinical Meal Subscriptions</h1>
        <p className="text-sm text-slate-600">
          Pause, resume, or cancel at any time from your Patient Portal. Automatic renewal never activates without your explicit opt-in consent.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <div key={p.type} className="rounded-xl border border-slate-200 bg-white p-7 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <p className="text-xs text-emerald-700 font-medium">{p.audience}</p>
              <h2 className="text-lg font-bold text-slate-900">{p.name}</h2>
              <div>
                <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">₹{p.price}</span>
                <span className="text-xs text-slate-500 ml-1.5">{p.cadence}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
                {p.limits}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(user ? '/portal/patient?tab=subscriptions' : '/login')}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Configure Plan in Portal
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const InfoStaticPage: React.FC<{ variant: 'how' | 'about' | 'approach' | 'faq' | 'contact' | 'privacy' | 'terms' }> = ({ variant }) => {
  const { pushToast } = useApp();
  const [contactSent, setContactSent] = useState(false);

  if (variant === 'contact') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">Contact NutriSync Clinical Support</h1>
        <p className="text-sm text-slate-600">
          Reach our dietetics coordination desk, kitchen quality assurance team, or institutional partnership leads.
        </p>
        {contactSent ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
            Thank you. Your inquiry has been logged with our Clinical Care Desk—we respond within 4 business hours.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setContactSent(true);
              pushToast('Clinical support message sent', 'success');
            }}
            className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input required type="text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input required type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Message</label>
              <textarea required rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
              Send Inquiry
            </button>
          </form>
        )}
      </div>
    );
  }

  const contentMap = {
    how: {
      title: 'How NutriSync Works',
      items: [
        { h: '01. Health Profile & Prescription Upload', p: 'Create your dietary profile, declare food allergies, and optionally upload your doctor’s prescription (PDF/JPG/PNG).' },
        { h: '02. AI OCR Structuring & Dietitian Sign-Off', p: 'Gemini 3.8 Flash organizes readable instructions and flags uncertain fields. Your Registered Dietitian reviews and approves exact daily calorie, carb, protein, fiber, and sodium targets.' },
        { h: '03. Allergen-Gated Meal Recommendations', p: 'Browse or subscribe to meals pre-filtered against your allergens and clinician-approved nutrient caps.' },
        { h: '04. Privacy-Minimized Kitchen & Cold-Chain Delivery', p: 'Chefs prepare weighed portions with zero access to your private diagnoses, followed by insulated delivery tracked in real time.' },
      ],
    },
    about: {
      title: 'About NutriSync',
      items: [
        { h: 'Bridging Clinical Dietetics and Daily Eating', p: 'NutriSync was built to solve the gap between hospital dietary discharge sheets and everyday home meals for individuals managing diabetes, hypertension, thyroid disorders, and weight care.' },
        { h: 'Clinician-First AI Governance', p: 'We use AI strictly as a clinical decision-support and nutritional transparency engine—never to diagnose conditions, alter medications, or bypass Registered Dietitians.' },
      ],
    },
    approach: {
      title: 'Our Clinical Nutrition Approach',
      items: [
        { h: 'Glycemic Load & Soluble Fiber Calibration', p: 'Meals emphasize whole pseudo-cereals (quinoa, sprouted ragi, foxtail millet, unpolished brown rice) paired with lean proteins to moderate postprandial glucose excursions.' },
        { h: 'Measured Sodium & Cold-Pressed Fats', p: 'Every low-sodium recipe is formulated below 380mg sodium per serving using natural herbs, citrus zest, and measured mineral salt.' },
      ],
    },
    faq: {
      title: 'Frequently Asked Questions',
      items: [
        { h: 'Does NutriSync AI prescribe medical diets on its own?', p: 'No. AI drafts meal schedules and structures prescription OCR text, but every medical dietary requirement and plan requires Registered Dietitian verification.' },
        { h: 'Can the kitchen see my medical prescription?', p: 'Never. Kitchens only receive your order number, meal items, portion weights, and critical allergen alerts.' },
        { h: 'Will my subscription auto-renew without permission?', p: 'No. Auto-renewal is off by default and only activates if you explicitly check the auto-renew consent box.' },
      ],
    },
    privacy: {
      title: 'Privacy & Health Data Protection Policy',
      items: [
        { h: 'Role-Scoped Access & Data Minimization', p: 'Prescriptions and medical profiles are restricted to the patient and their authorized Registered Dietitian, with immutable document access logs.' },
        { h: 'Location & Google Maps Privacy Notice', p: 'Address autocomplete and delivery routing integrate Google Maps features and content. Location features require explicit user input/consent and are subject to the Google Privacy Policy (https://policies.google.com/privacy?utm_campaign=gmp_mcp_codeassist_v1_aistudio).' },
      ],
    },
    terms: {
      title: 'Terms of Service & Medical Disclaimer',
      items: [
        { h: 'Medical Safety Disclaimer', p: 'NutriSync is a nutrition coordination and healthy meal delivery platform—not an emergency medical provider. Never change medications based on nutritional information.' },
        { h: 'Google Maps End User Terms', p: 'Address search and route visualization features use Google Maps Platform services and are governed by the Google Maps/Google Earth Additional Terms of Service (https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio).' },
      ],
    },
  }[variant];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-3xl font-bold text-slate-900">{contentMap.title}</h1>
      <div className="space-y-4">
        {contentMap.items.map((it, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-6 space-y-2">
            <h2 className="text-base font-semibold text-slate-900">{it.h}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{it.p}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
