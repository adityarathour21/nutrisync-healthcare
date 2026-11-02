import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

export type UserRole = 'patient' | 'dietitian' | 'chef' | 'delivery' | 'admin';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone: string;
  isEmailVerified: boolean;
  isActive: boolean;
  isVerifiedByAdmin: boolean;
  preferredLanguage: 'en' | 'hi';
  referralCode: string;
  loyaltyPoints: number;
  createdAt: string;
}

export interface ApprovedNutritionTargets {
  dailyCalories: number;
  maxCarbsGrams: number;
  minProteinGrams: number;
  maxFatGrams: number;
  minFiberGrams: number;
  maxSodiumMg: number;
  restrictedIngredients: string[];
  approvedByDietitianId: string | null;
  approvedByDietitianName: string | null;
  approvedAt: string | null;
  clinicalNotes: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age: number;
  dietaryPreference: 'vegetarian' | 'vegan' | 'non_vegetarian' | 'eggetarian';
  allergies: string[];
  medicalConditions: string[];
  authorized: boolean;
}

export interface PatientProfileRecord {
  userId: string;
  age: number;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  heightCm: number;
  weightKg: number;
  dietaryPreference: 'vegetarian' | 'vegan' | 'non_vegetarian' | 'eggetarian';
  allergies: string[];
  intolerances: string[];
  medicalConditions: string[];
  assignedDietitianId: string | null;
  approvedTargets: ApprovedNutritionTargets;
  favoriteMealIds: string[];
  familyMembers: FamilyMember[];
  mealRemindersEnabled: boolean;
  dailyIntakeLog: {
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sodium: number;
  }[];
}

export interface DietitianProfileRecord {
  userId: string;
  name: string;
  qualification: string;
  licenseNumber: string;
  specializations: string[];
  experienceYears: number;
  hospitalAffiliation: string;
  consultationFeeInr: number;
  bio: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  rating: number;
}

export interface PrescriptionRecord {
  id: string;
  patientId: string;
  patientName: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  doctorName: string;
  issuedDate: string;
  ocrExtracted: {
    rawSummary: string;
    identifiedConditions: string[];
    dietaryInstructions: string[];
    potentialAllergies: string[];
    medicationsNotedForContext: string[];
    uncertainOrUnreadableFields: string[];
    confidenceNote: string;
  };
  verificationStatus: 'pending_dietitian_review' | 'verified' | 'rejected';
  reviewedByDietitianId: string | null;
  reviewedByDietitianName: string | null;
  dietitianVerificationNotes: string;
  approvedRestrictionUpdates?: {
    maxSodiumMg?: number;
    maxCarbsGrams?: number;
    dailyCalories?: number;
    addedAllergies?: string[];
  };
  accessLogs: {
    actorId: string;
    actorRole: string;
    action: string;
    timestamp: string;
  }[];
  createdAt: string;
}

export interface MealRecord {
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
  nutritionalVerificationStatus: 'verified' | 'pending_review';
  verifiedByDietitianName: string;
  ratingAvg: number;
  ratingCount: number;
  recipeSteps: string[];
}

export interface MealPlanRecord {
  id: string;
  patientId: string;
  patientName: string;
  createdByRole: 'ai_draft' | 'dietitian';
  reviewedByDietitianId: string | null;
  reviewedByDietitianName: string | null;
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
      fat: number;
      fiber: number;
      sodium: number;
    };
  }[];
  createdAt: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  patientId: string;
  patientName: string;
  items: {
    mealId: string;
    mealName: string;
    quantity: number;
    unitPriceInr: number;
    portionSize: string;
    calories: number;
    sodium: number;
    allergens: string[];
  }[];
  patientAllergenWarnings: string[];
  subtotalInr: number;
  discountInr: number;
  deliveryFeeInr: number;
  totalInr: number;
  couponCode: string;
  status:
    | 'placed'
    | 'confirmed'
    | 'preparing'
    | 'quality_checked'
    | 'ready_for_dispatch'
    | 'picked_up'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  deliveryAddress: {
    label: string;
    recipientName: string;
    phone: string;
    formattedAddress: string;
    postalCode: string;
    lat: number;
    lng: number;
  };
  assignedDeliveryPartnerId: string | null;
  assignedDeliveryPartnerName: string | null;
  qualityChecklist: {
    portionWeighed: boolean;
    allergenCrossCheck: boolean;
    sodiumVerified: boolean;
    tamperSealApplied: boolean;
  };
  scheduledSlot: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRecord {
  id: string;
  patientId: string;
  patientName: string;
  planType: 'daily' | 'weekly' | 'monthly' | 'breakfast_only' | 'lunch_dinner' | 'full_day' | 'custom_approved';
  planName: string;
  selectedMealIds: string[];
  deliveryAddressId: string;
  deliveryTimeSlot: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  priceInr: number;
  autoRenewConsent: boolean;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  patientId: string;
  patientName: string;
  orderId: string | null;
  subscriptionId: string | null;
  gateway: 'razorpay' | 'razorpay_test_sandbox';
  gatewayOrderId: string;
  gatewayPaymentId: string;
  signatureVerified: boolean;
  amountInr: number;
  status: 'created' | 'captured' | 'failed' | 'refunded';
  invoiceNumber: string;
  refundReason: string;
  createdAt: string;
}

export interface AddressRecord {
  id: string;
  userId: string;
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

export interface ConsultationRecord {
  id: string;
  patientId: string;
  patientName: string;
  dietitianId: string;
  dietitianName: string;
  preferredDate: string;
  preferredSlot: string;
  healthConcern: string;
  status: 'requested' | 'scheduled' | 'completed' | 'cancelled';
  clinicalSummaryNotes: string;
  followUpDate: string;
  createdAt: string;
}

export interface InventoryItemRecord {
  id: string;
  ingredientName: string;
  category: string;
  stockQty: number;
  unit: string;
  reorderThreshold: number;
  allergenWarning: string;
  lastUpdatedBy: string;
  updatedAt: string;
}

export interface ReviewRecord {
  id: string;
  patientId: string;
  patientName: string;
  mealId: string;
  mealName: string;
  rating: number;
  comment: string;
  moderationStatus: 'approved' | 'flagged' | 'hidden';
  isComplaint: boolean;
  adminResolution: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'order' | 'clinical' | 'subscription' | 'kitchen' | 'delivery' | 'system';
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
  createdAt: string;
}

export interface DatabaseState {
  isDemoSeeded: boolean;
  users: UserRecord[];
  patientProfiles: PatientProfileRecord[];
  dietitianProfiles: DietitianProfileRecord[];
  deliveryProfiles: {
    userId: string;
    name: string;
    vehicleType: string;
    vehiclePlate: string;
    coldChainBagId: string;
    isAvailable: boolean;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    totalDeliveries: number;
    totalEarningsInr: number;
  }[];
  categories: { slug: string; name: string; description: string }[];
  meals: MealRecord[];
  prescriptions: PrescriptionRecord[];
  mealPlans: MealPlanRecord[];
  orders: OrderRecord[];
  subscriptions: SubscriptionRecord[];
  payments: PaymentRecord[];
  addresses: AddressRecord[];
  consultations: ConsultationRecord[];
  inventory: InventoryItemRecord[];
  reviews: ReviewRecord[];
  notifications: NotificationRecord[];
  coupons: { code: string; discountPercent: number; maxDiscountInr: number; description: string }[];
  platformSettings: {
    kitchenDispatchHubName: string;
    kitchenDispatchAddress: string;
    kitchenLat: number;
    kitchenLng: number;
    freeDeliveryThresholdInr: number;
    standardDeliveryFeeInr: number;
    prescriptionRetentionDays: number;
  };
  auditLogs: AuditLogRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const DATA_FILE = path.join(DATA_DIR, 'nutrisync_store.json');

export function createInitialSeedState(): DatabaseState {
  const demoPasswordHash = bcrypt.hashSync('Demo@1234', 10);
  const now = new Date().toISOString();

  const users: UserRecord[] = [
    {
      id: 'usr_patient_1',
      name: 'Aarav Sharma (Demo Patient)',
      email: 'patient@nutrisync.demo',
      passwordHash: demoPasswordHash,
      role: 'patient',
      phone: '+91 98765 43210',
      isEmailVerified: true,
      isActive: true,
      isVerifiedByAdmin: true,
      preferredLanguage: 'en',
      referralCode: 'AARAV50',
      loyaltyPoints: 420,
      createdAt: now,
    },
    {
      id: 'usr_dietitian_1',
      name: 'Dr. Meera Nair, RD',
      email: 'dietitian@nutrisync.demo',
      passwordHash: demoPasswordHash,
      role: 'dietitian',
      phone: '+91 98111 22334',
      isEmailVerified: true,
      isActive: true,
      isVerifiedByAdmin: true,
      preferredLanguage: 'en',
      referralCode: 'DRMEERA',
      loyaltyPoints: 0,
      createdAt: now,
    },
    {
      id: 'usr_dietitian_2',
      name: 'Dt. Kabir Menon, MSc',
      email: 'kabir.rd@nutrisync.demo',
      passwordHash: demoPasswordHash,
      role: 'dietitian',
      phone: '+91 98222 33445',
      isEmailVerified: true,
      isActive: true,
      isVerifiedByAdmin: true,
      preferredLanguage: 'en',
      referralCode: 'KABIRRD',
      loyaltyPoints: 0,
      createdAt: now,
    },
    {
      id: 'usr_chef_1',
      name: 'Chef Vikramjit Singh',
      email: 'chef@nutrisync.demo',
      passwordHash: demoPasswordHash,
      role: 'chef',
      phone: '+91 98333 44556',
      isEmailVerified: true,
      isActive: true,
      isVerifiedByAdmin: true,
      preferredLanguage: 'en',
      referralCode: 'CHEFVIK',
      loyaltyPoints: 0,
      createdAt: now,
    },
    {
      id: 'usr_delivery_1',
      name: 'Rohan Deshmukh',
      email: 'delivery@nutrisync.demo',
      passwordHash: demoPasswordHash,
      role: 'delivery',
      phone: '+91 98444 55667',
      isEmailVerified: true,
      isActive: true,
      isVerifiedByAdmin: true,
      preferredLanguage: 'en',
      referralCode: 'ROHANDEL',
      loyaltyPoints: 0,
      createdAt: now,
    },
    {
      id: 'usr_admin_1',
      name: 'Ananya Verma (Platform Admin)',
      email: 'admin@nutrisync.demo',
      passwordHash: demoPasswordHash,
      role: 'admin',
      phone: '+91 98000 11223',
      isEmailVerified: true,
      isActive: true,
      isVerifiedByAdmin: true,
      preferredLanguage: 'en',
      referralCode: 'ADMINNS',
      loyaltyPoints: 0,
      createdAt: now,
    },
  ];

  const categories = [
    { slug: 'diabetes-conscious', name: 'Diabetes-Conscious', description: 'Low-glycemic complex carbohydrates and high soluble fiber.' },
    { slug: 'heart-conscious', name: 'Heart-Conscious', description: 'Omega-3 rich, saturated-fat controlled clinical recipes.' },
    { slug: 'low-sodium', name: 'Low-Sodium Options', description: 'Strictly <380mg sodium per serving for blood pressure management.' },
    { slug: 'balanced-nutrition', name: 'Balanced Nutrition', description: 'Macro-calibrated everyday clinical meals.' },
    { slug: 'high-protein', name: 'High-Protein', description: 'Lean bioavailable protein for metabolic and muscle support.' },
    { slug: 'weight-management', name: 'Weight-Management', description: 'High-satiety, calorie-measured nutrient-dense plates.' },
    { slug: 'vegan', name: 'Vegan & Plant-Forward', description: '100% dairy-free, plant-protein rich meals.' },
    { slug: 'gluten-free', name: 'Gluten-Free', description: 'Prepared with certified gluten-free whole grains and pseudo-cereals.' },
  ];

  const meals: MealRecord[] = [
    {
      id: 'meal_1',
      name: 'Mediterranean Low-GI Quinoa & Herb Chicken Bowl',
      slug: 'mediterranean-quinoa-herb-chicken',
      imageUrl: '/images/meal_diabetes_quinoa_bowl.jpg',
      description: 'Slow-digested tri-color quinoa paired with herb-marinated grilled chicken breast, roasted broccoli florets, cherry tomatoes, pumpkin seeds, and cold-pressed extra-virgin olive oil.',
      categorySlug: 'diabetes-conscious',
      categoryName: 'Diabetes-Conscious',
      dietaryType: 'non_vegetarian',
      ingredients: ['Tri-color quinoa', 'Chicken breast', 'Broccoli', 'Cherry tomatoes', 'Pumpkin seeds', 'Extra-virgin olive oil', 'Lemon herb dressing'],
      allergens: ['seeds'],
      calories: 440,
      protein: 38,
      carbs: 36,
      fat: 14,
      fiber: 9,
      sodium: 310,
      portionSize: '410g',
      priceInr: 349,
      prepTimeMins: 22,
      isAvailable: true,
      suitableLabels: ['Diabetes-Conscious', 'Low-Sodium', 'Gluten-Free', 'High-Protein'],
      nutritionalVerificationStatus: 'verified',
      verifiedByDietitianName: 'Dr. Meera Nair, RD',
      ratingAvg: 4.9,
      ratingCount: 64,
      recipeSteps: [
        'Rinse and steam 110g cooked tri-color quinoa without added salt.',
        'Grill 130g rosemary-lemon chicken breast to 74°C internal temperature.',
        'Steam-roast 90g broccoli florets and blister 50g cherry tomatoes.',
        'Finish with 10g toasted pumpkin seeds and 1 tsp cold-pressed olive oil.',
      ],
    },
    {
      id: 'meal_2',
      name: 'Omega-3 Dill Baked Salmon & Asparagus Plate',
      slug: 'omega-salmon-asparagus-sweet-potato',
      imageUrl: '/images/meal_heart_salmon_plate.jpg',
      description: 'Wild-caught Atlantic salmon baked with fresh dill and lemon zest, served alongside tender steamed green asparagus and slow-roasted sweet potato mash.',
      categorySlug: 'heart-conscious',
      categoryName: 'Heart-Conscious',
      dietaryType: 'non_vegetarian',
      ingredients: ['Atlantic salmon fillet', 'Green asparagus', 'Sweet potato', 'Fresh dill', 'Lemon zest', 'Cold-pressed olive oil', 'Black pepper'],
      allergens: ['fish'],
      calories: 475,
      protein: 36,
      carbs: 34,
      fat: 20,
      fiber: 7,
      sodium: 280,
      portionSize: '390g',
      priceInr: 489,
      prepTimeMins: 25,
      isAvailable: true,
      suitableLabels: ['Heart-Conscious', 'Low-Sodium', 'Gluten-Free'],
      nutritionalVerificationStatus: 'verified',
      verifiedByDietitianName: 'Dr. Meera Nair, RD',
      ratingAvg: 4.9,
      ratingCount: 51,
      recipeSteps: [
        'Season 140g salmon fillet with lemon zest, cracked pepper, and fresh dill (zero added table salt).',
        'Bake at 190°C for 13 minutes until flaky.',
        'Blanch 110g green asparagus spears for 3 minutes.',
        'Serve with 120g steamed skin-on sweet potato mash.',
      ],
    },
    {
      id: 'meal_3',
      name: 'Plant-Forward Edamame, Spiced Chickpea & Brown Rice Bowl',
      slug: 'vegan-edamame-chickpea-power-bowl',
      imageUrl: '/images/meal_vegan_protein_bowl.jpg',
      description: 'Complete plant amino-acid bowl combining steamed edamame, cumin-roasted chickpeas, red cabbage slaw, baby spinach, sprouted brown rice, and turmeric-lemon tahini.',
      categorySlug: 'vegan',
      categoryName: 'Vegan & Plant-Forward',
      dietaryType: 'vegan',
      ingredients: ['Shelled edamame', 'Roasted chickpeas', 'Sprouted brown rice', 'Purple cabbage', 'Baby spinach', 'Sesame tahini', 'Turmeric', 'Lime'],
      allergens: ['soy', 'sesame'],
      calories: 430,
      protein: 24,
      carbs: 48,
      fat: 14,
      fiber: 13,
      sodium: 295,
      portionSize: '420g',
      priceInr: 299,
      prepTimeMins: 18,
      isAvailable: true,
      suitableLabels: ['Vegan', 'Diabetes-Conscious', 'Low-Sodium', 'High-Fiber'],
      nutritionalVerificationStatus: 'verified',
      verifiedByDietitianName: 'Dt. Kabir Menon, MSc',
      ratingAvg: 4.8,
      ratingCount: 47,
      recipeSteps: [
        'Toss 80g cooked chickpeas with roasted cumin and smoked paprika; air-roast 10 mins.',
        'Steam 75g shelled edamame and 110g sprouted brown rice.',
        'Arrange over 60g baby spinach and 50g finely shredded purple cabbage.',
        'Drizzle 20g house-whisked lemon turmeric tahini.',
      ],
    },
    {
      id: 'meal_4',
      name: 'Clinical Low-Sodium Palak Paneer & Sprouted Moong Thali',
      slug: 'clinical-palak-paneer-moong-thali',
      imageUrl: '/images/meal_low_sodium_indian_thali.jpg',
      description: 'Low-fat artisanal cottage cheese simmered in blanched iron-rich spinach puree, accompanied by sprouted green moong koshimbir, unpolished brown basmati, and two flaxseed multigrain rotis.',
      categorySlug: 'low-sodium',
      categoryName: 'Low-Sodium Options',
      dietaryType: 'vegetarian',
      ingredients: ['Low-fat paneer', 'Fresh spinach', 'Sprouted green moong', 'Brown basmati rice', 'Whole wheat & jowar flour', 'Flaxseeds', 'Cumin', 'Garlic'],
      allergens: ['dairy', 'gluten'],
      calories: 460,
      protein: 28,
      carbs: 52,
      fat: 13,
      fiber: 11,
      sodium: 265,
      portionSize: '450g',
      priceInr: 319,
      prepTimeMins: 24,
      isAvailable: true,
      suitableLabels: ['Low-Sodium', 'Balanced Nutrition', 'Diabetes-Conscious', 'Vegetarian'],
      nutritionalVerificationStatus: 'verified',
      verifiedByDietitianName: 'Dr. Meera Nair, RD',
      ratingAvg: 4.9,
      ratingCount: 83,
      recipeSteps: [
        'Blanch 150g spinach leaves and blend smooth with ginger, garlic, and roasted cumin.',
        'Fold in 90g low-fat paneer cubes and simmer 4 minutes with measured rock salt (<265mg total Na).',
        'Prepare fresh sprouted moong salad with cucumber and pomegranate.',
        'Serve alongside 80g brown basmati rice and 2 multigrain flaxseed phulkas.',
      ],
    },
    {
      id: 'meal_5',
      name: 'Thyroid-Support Brazil Nut, Millet & Tofu Warm Salad',
      slug: 'foxtail-millet-tofu-selenium-bowl',
      imageUrl: '/images/hero_nutrisync_plate.jpg',
      description: 'Selenium-calibrated foxtail millet pilaf with herb-seared organic silken-firm tofu, cooked tenderstem greens, roasted pumpkin cubes, and citrus-ginger reduction.',
      categorySlug: 'weight-management',
      categoryName: 'Weight-Management',
      dietaryType: 'vegan',
      ingredients: ['Foxtail millet', 'Organic firm tofu', 'Cooked broccoli', 'Roasted sweet potato', 'Avocado', 'Ginger citrus dressing', 'Crushed Brazil nut'],
      allergens: ['soy', 'tree_nuts'],
      calories: 395,
      protein: 25,
      carbs: 38,
      fat: 15,
      fiber: 10,
      sodium: 250,
      portionSize: '380g',
      priceInr: 329,
      prepTimeMins: 20,
      isAvailable: true,
      suitableLabels: ['Weight-Management', 'Gluten-Free', 'Vegan', 'Low-Sodium'],
      nutritionalVerificationStatus: 'verified',
      verifiedByDietitianName: 'Dt. Kabir Menon, MSc',
      ratingAvg: 4.7,
      ratingCount: 38,
      recipeSteps: [
        'Cook 100g soaked foxtail millet until fluffy.',
        'Sear 110g herb-pressed tofu on cast iron.',
        'Cook cruciferous greens thoroughly (goitrogen-conscious thermal preparation).',
        'Top with roasted pumpkin/sweet potato cubes and 1 finely grated Brazil nut for natural selenium.',
      ],
    },
    {
      id: 'meal_6',
      name: 'Sprouted Ragi & Oats Savory Protein Breakfast Chilla',
      slug: 'sprouted-ragi-oats-paneer-chilla',
      imageUrl: '/images/meal_low_sodium_indian_thali.jpg',
      description: 'Two stone-ground sprouted finger-millet and rolled-oat crepes stuffed with grated cottage cheese, dill leaves, and bell peppers, served with mint-coriander probiotic curd dip.',
      categorySlug: 'high-protein',
      categoryName: 'High-Protein',
      dietaryType: 'vegetarian',
      ingredients: ['Sprouted ragi flour', 'Rolled oats', 'Low-fat grated paneer', 'Fresh dill', 'Bell peppers', 'Probiotic curd', 'Mint & coriander'],
      allergens: ['dairy'],
      calories: 360,
      protein: 24,
      carbs: 41,
      fat: 9,
      fiber: 8,
      sodium: 240,
      portionSize: '320g',
      priceInr: 239,
      prepTimeMins: 15,
      isAvailable: true,
      suitableLabels: ['Diabetes-Conscious', 'High-Protein', 'Gluten-Free', 'Vegetarian'],
      nutritionalVerificationStatus: 'verified',
      verifiedByDietitianName: 'Dr. Meera Nair, RD',
      ratingAvg: 4.8,
      ratingCount: 59,
      recipeSteps: [
        'Whisk sprouted ragi and powdered rolled oats batter with grated carrot and dill.',
        'Cook two thin crepes with minimal cold-pressed groundnut-free sunflower oil.',
        'Fold with 75g spiced low-fat paneer filling and serve with mint yogurt dip.',
      ],
    },
  ];

  const past7Days = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    return {
      date: d.toLocaleDateString('en-US', { weekday: 'short' }),
      calories: 1680 + ((idx * 45) % 160),
      protein: 78 + ((idx * 5) % 18),
      carbs: 155 + ((idx * 8) % 24),
      fat: 51 + ((idx * 3) % 10),
      fiber: 31 + (idx % 6),
      sodium: 1240 + ((idx * 60) % 210),
    };
  });

  const patientProfiles: PatientProfileRecord[] = [
    {
      userId: 'usr_patient_1',
      age: 42,
      gender: 'male',
      heightCm: 175,
      weightKg: 81,
      dietaryPreference: 'non_vegetarian',
      allergies: ['peanuts'],
      intolerances: ['refined_sugar'],
      medicalConditions: ['Type 2 Diabetes (Controlled)', 'Stage 1 Hypertension'],
      assignedDietitianId: 'usr_dietitian_1',
      approvedTargets: {
        dailyCalories: 1800,
        maxCarbsGrams: 175,
        minProteinGrams: 80,
        maxFatGrams: 58,
        minFiberGrams: 32,
        maxSodiumMg: 1500,
        restrictedIngredients: ['peanuts', 'peanut oil', 'refined sugar', 'white bread'],
        approvedByDietitianId: 'usr_dietitian_1',
        approvedByDietitianName: 'Dr. Meera Nair, RD',
        approvedAt: now,
        clinicalNotes: 'Maintain low glycemic load (<45g net carbs per main meal) and strict <1,500mg daily sodium ceiling. Strictly exclude all peanut derivatives.',
      },
      favoriteMealIds: ['meal_1', 'meal_4'],
      familyMembers: [
        {
          id: 'fam_1',
          name: 'kavita Sharma (Mother)',
          relation: 'Mother',
          age: 67,
          dietaryPreference: 'vegetarian',
          allergies: ['tree_nuts'],
          medicalConditions: ['Hypothyroidism', 'Low-Sodium Requirement'],
          authorized: true,
        },
      ],
      mealRemindersEnabled: true,
      dailyIntakeLog: past7Days,
    },
  ];

  const dietitianProfiles: DietitianProfileRecord[] = [
    {
      userId: 'usr_dietitian_1',
      name: 'Dr. Meera Nair, RD',
      qualification: 'PhD Clinical Nutrition, Registered Dietitian (IDA)',
      licenseNumber: 'IDA-RD-2018-4491',
      specializations: ['Endocrine & Diabetes Nutrition', 'DASH Hypertension Therapy', 'Renal & Cardiac Diets'],
      experienceYears: 11,
      hospitalAffiliation: 'Manipal Metabolic & Endocrine Care Center',
      consultationFeeInr: 700,
      bio: 'Clinical dietitian specializing in glycemic variability management and DASH-compliant therapeutic Indian & Mediterranean meal planning.',
      verificationStatus: 'verified',
      rating: 4.9,
    },
    {
      userId: 'usr_dietitian_2',
      name: 'Dt. Kabir Menon, MSc',
      qualification: 'MSc Dietetics & Applied Nutrition, CDE',
      licenseNumber: 'IDA-RD-2021-8832',
      specializations: ['Thyroid & Metabolic Health', 'Plant-Based Clinical Nutrition', 'Sustainable Weight Management'],
      experienceYears: 7,
      hospitalAffiliation: 'Aster Preventive Health Clinic',
      consultationFeeInr: 550,
      bio: 'Certified Diabetes Educator focused on plant-forward metabolic nutrition and thyroid micronutrient optimization.',
      verificationStatus: 'verified',
      rating: 4.8,
    },
  ];

  const deliveryProfiles = [
    {
      userId: 'usr_delivery_1',
      name: 'Rohan Deshmukh',
      vehicleType: 'electric_scooter',
      vehiclePlate: 'KA-01-EV-4829',
      coldChainBagId: 'NS-COLD-108',
      isAvailable: true,
      verificationStatus: 'verified' as const,
      totalDeliveries: 142,
      totalEarningsInr: 11840,
    },
  ];

  const addresses: AddressRecord[] = [
    {
      id: 'addr_1',
      userId: 'usr_patient_1',
      label: 'Home (Demo)',
      recipientName: 'Aarav Sharma',
      phone: '+91 98765 43210',
      formattedAddress: '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038, India',
      landmark: 'Near Indiranagar Metro Station',
      postalCode: '560038',
      lat: 12.9784,
      lng: 77.6408,
      isDefault: true,
    },
    {
      id: 'addr_2',
      userId: 'usr_patient_1',
      label: 'Work Office (Demo)',
      recipientName: 'Aarav Sharma',
      phone: '+91 98765 43210',
      formattedAddress: '80 Feet Road, Koramangala 4th Block, Bengaluru, Karnataka 560034, India',
      landmark: 'Opposite Sony World Signal',
      postalCode: '560034',
      lat: 12.9352,
      lng: 77.6245,
      isDefault: false,
    },
  ];

  const prescriptions: PrescriptionRecord[] = [
    {
      id: 'rx_demo_1',
      patientId: 'usr_patient_1',
      patientName: 'Aarav Sharma (Demo Patient)',
      fileName: 'Dr_Rao_Metabolic_Consult_Oct2026.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 284120,
      doctorName: 'Dr. S. Raghavan, MD (Endocrinology)',
      issuedDate: '2026-10-18',
      ocrExtracted: {
        rawSummary: 'Outpatient Endocrine Summary: HbA1c 6.9%, BP 134/86 mmHg. Advised low-glycemic complex carbohydrate diet, sodium <1500mg/day, strict peanut avoidance.',
        identifiedConditions: ['Type 2 Diabetes Mellitus', 'Stage 1 Essential Hypertension'],
        dietaryInstructions: ['Daily calories ~1800 kcal', 'Restrict sodium below 1500 mg/day', 'Include >=30g dietary fiber daily', 'Avoid refined sugars and white flour'],
        potentialAllergies: ['Peanuts (documented IgE history)'],
        medicationsNotedForContext: ['Metformin SR 500mg (context only — AI never modifies medication)'],
        uncertainOrUnreadableFields: ['Handwritten margin note near evening snack timing — verify with patient'],
        confidenceNote: 'Demo OCR Extraction — Verified by Dr. Meera Nair, RD.',
      },
      verificationStatus: 'verified',
      reviewedByDietitianId: 'usr_dietitian_1',
      reviewedByDietitianName: 'Dr. Meera Nair, RD',
      dietitianVerificationNotes: 'Confirmed HbA1c and DASH sodium cap (<1500mg/day). Activated low-GI & peanut-free clinical meal profile.',
      accessLogs: [
        { actorId: 'usr_patient_1', actorRole: 'patient', action: 'uploaded_document', timestamp: now },
        { actorId: 'usr_dietitian_1', actorRole: 'dietitian', action: 'verified_prescription', timestamp: now },
      ],
      createdAt: now,
    },
  ];

  const mealPlans: MealPlanRecord[] = [
    {
      id: 'mp_demo_1',
      patientId: 'usr_patient_1',
      patientName: 'Aarav Sharma (Demo Patient)',
      createdByRole: 'dietitian',
      reviewedByDietitianId: 'usr_dietitian_1',
      reviewedByDietitianName: 'Dr. Meera Nair, RD',
      title: 'Glycemic & DASH Balanced Daily Protocol (Demo)',
      durationType: 'daily',
      status: 'approved',
      dietitianNotes: 'Clinically balanced under 1,500mg sodium and 175g carbohydrates with 96g bioavailable protein.',
      days: [
        {
          dayLabel: 'Day 1 Protocol',
          breakfastMealId: 'meal_6',
          lunchMealId: 'meal_1',
          snackMealId: 'meal_3',
          dinnerMealId: 'meal_4',
          totals: {
            calories: 1690,
            protein: 114,
            carbs: 177,
            fat: 50,
            fiber: 41,
            sodium: 1110,
          },
        },
      ],
      createdAt: now,
    },
  ];

  const orders: OrderRecord[] = [
    {
      id: 'ord_demo_1',
      orderNumber: 'NS-2026-1042',
      patientId: 'usr_patient_1',
      patientName: 'Aarav Sharma (Demo Patient)',
      items: [
        {
          mealId: 'meal_1',
          mealName: 'Mediterranean Low-GI Quinoa & Herb Chicken Bowl',
          quantity: 1,
          unitPriceInr: 349,
          portionSize: '410g',
          calories: 440,
          sodium: 310,
          allergens: ['seeds'],
        },
        {
          mealId: 'meal_4',
          mealName: 'Clinical Low-Sodium Palak Paneer & Sprouted Moong Thali',
          quantity: 1,
          unitPriceInr: 319,
          portionSize: '450g',
          calories: 460,
          sodium: 265,
          allergens: ['dairy', 'gluten'],
        },
      ],
      patientAllergenWarnings: ['STRICT ALLERGY: PEANUTS — Use Nut-Free Station Utensils'],
      subtotalInr: 668,
      discountInr: 0,
      deliveryFeeInr: 0,
      totalInr: 668,
      couponCode: '',
      status: 'preparing',
      paymentStatus: 'paid',
      deliveryAddress: {
        label: 'Home (Demo)',
        recipientName: 'Aarav Sharma',
        phone: '+91 98765 43210',
        formattedAddress: '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038, India',
        postalCode: '560038',
        lat: 12.9784,
        lng: 77.6408,
      },
      assignedDeliveryPartnerId: 'usr_delivery_1',
      assignedDeliveryPartnerName: 'Rohan Deshmukh',
      qualityChecklist: {
        portionWeighed: true,
        allergenCrossCheck: true,
        sodiumVerified: false,
        tamperSealApplied: false,
      },
      scheduledSlot: '12:30 - 13:15',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const subscriptions: SubscriptionRecord[] = [
    {
      id: 'sub_demo_1',
      patientId: 'usr_patient_1',
      patientName: 'Aarav Sharma (Demo Patient)',
      planType: 'weekly',
      planName: 'Weekly Lunch & Dinner Clinical Protocol (Demo)',
      selectedMealIds: ['meal_1', 'meal_4', 'meal_2', 'meal_6'],
      deliveryAddressId: 'addr_1',
      deliveryTimeSlot: '12:30 - 13:15',
      startDate: '2026-11-01',
      endDate: '2026-11-08',
      status: 'active',
      priceInr: 3899,
      autoRenewConsent: false,
      createdAt: now,
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'pay_demo_1',
      patientId: 'usr_patient_1',
      patientName: 'Aarav Sharma (Demo Patient)',
      orderId: 'ord_demo_1',
      subscriptionId: null,
      gateway: 'razorpay_test_sandbox',
      gatewayOrderId: 'order_demo_NS1042',
      gatewayPaymentId: 'pay_demo_NS1042',
      signatureVerified: true,
      amountInr: 668,
      status: 'captured',
      invoiceNumber: 'INV-NS-2026-001',
      refundReason: '',
      createdAt: now,
    },
  ];

  const consultations: ConsultationRecord[] = [
    {
      id: 'con_demo_1',
      patientId: 'usr_patient_1',
      patientName: 'Aarav Sharma (Demo Patient)',
      dietitianId: 'usr_dietitian_1',
      dietitianName: 'Dr. Meera Nair, RD',
      preferredDate: '2026-11-05',
      preferredSlot: '17:00 - 17:30',
      healthConcern: 'Post-lunch glucose spike review and evening high-fiber snack adjustment.',
      status: 'scheduled',
      clinicalSummaryNotes: 'Reviewing 7-day continuous meal adherence log.',
      followUpDate: '2026-11-19',
      createdAt: now,
    },
  ];

  const inventory: InventoryItemRecord[] = [
    { id: 'inv_1', ingredientName: 'Tri-color Quinoa (Organic)', category: 'Whole Grains', stockQty: 28, unit: 'kg', reorderThreshold: 10, allergenWarning: 'None', lastUpdatedBy: 'Chef Vikramjit Singh', updatedAt: now },
    { id: 'inv_2', ingredientName: 'Atlantic Salmon Fillet (Cold-Chain)', category: 'Lean Proteins', stockQty: 6, unit: 'kg', reorderThreshold: 8, allergenWarning: 'Fish', lastUpdatedBy: 'Chef Vikramjit Singh', updatedAt: now },
    { id: 'inv_3', ingredientName: 'Low-Fat Artisanal Paneer', category: 'Dairy Proteins', stockQty: 14, unit: 'kg', reorderThreshold: 8, allergenWarning: 'Dairy', lastUpdatedBy: 'Chef Vikramjit Singh', updatedAt: now },
    { id: 'inv_4', ingredientName: 'Fresh Spinach (Hydroponic)', category: 'Leafy Greens', stockQty: 5, unit: 'kg', reorderThreshold: 7, allergenWarning: 'None', lastUpdatedBy: 'Chef Vikramjit Singh', updatedAt: now },
    { id: 'inv_5', ingredientName: 'Sprouted Ragi Flour', category: 'Millets', stockQty: 22, unit: 'kg', reorderThreshold: 6, allergenWarning: 'None', lastUpdatedBy: 'Chef Vikramjit Singh', updatedAt: now },
    { id: 'inv_6', ingredientName: 'Shelled Edamame Beans', category: 'Plant Proteins', stockQty: 12, unit: 'kg', reorderThreshold: 5, allergenWarning: 'Soy', lastUpdatedBy: 'Chef Vikramjit Singh', updatedAt: now },
  ];

  const reviews: ReviewRecord[] = [
    {
      id: 'rev_demo_1',
      patientId: 'usr_patient_1',
      patientName: 'Aarav Sharma',
      mealId: 'meal_1',
      mealName: 'Mediterranean Low-GI Quinoa & Herb Chicken Bowl',
      rating: 5,
      comment: 'Kept my 2-hour post-meal glucose steady at 128 mg/dL while tasting genuinely fresh and herb-forward.',
      moderationStatus: 'approved',
      isComplaint: false,
      adminResolution: '',
      createdAt: now,
    },
  ];

  const notifications: NotificationRecord[] = [
    {
      id: 'notif_1',
      userId: 'usr_patient_1',
      title: 'Dietitian Approved Your Nutrition Targets',
      message: 'Dr. Meera Nair, RD verified your prescription and activated your <1,500mg low-sodium & low-GI profile.',
      category: 'clinical',
      isRead: false,
      createdAt: now,
    },
    {
      id: 'notif_2',
      userId: 'usr_chef_1',
      title: 'Low Stock Alert: Atlantic Salmon & Spinach',
      message: '2 clinical ingredients have fallen below reorder threshold in Station A.',
      category: 'kitchen',
      isRead: false,
      createdAt: now,
    },
  ];

  return {
    isDemoSeeded: true,
    users,
    patientProfiles,
    dietitianProfiles,
    deliveryProfiles,
    categories,
    meals,
    prescriptions,
    mealPlans,
    orders,
    subscriptions,
    payments,
    addresses,
    consultations,
    inventory,
    reviews,
    notifications,
    coupons: [
      { code: 'FIRSTHEALTH15', discountPercent: 15, maxDiscountInr: 150, description: '15% off up to ₹150 on clinical meal orders' },
      { code: 'CARE10', discountPercent: 10, maxDiscountInr: 100, description: '10% off verified therapeutic meals' },
    ],
    platformSettings: {
      kitchenDispatchHubName: 'NutriSync Clinical Kitchen Hub — Domlur',
      kitchenDispatchAddress: 'Domlur Intermediate Ring Road, Bengaluru, Karnataka 560071, India',
      kitchenLat: 12.9610,
      kitchenLng: 77.6387,
      freeDeliveryThresholdInr: 499,
      standardDeliveryFeeInr: 45,
      prescriptionRetentionDays: 365,
    },
    auditLogs: [
      {
        id: 'aud_1',
        actorId: 'usr_dietitian_1',
        actorEmail: 'dietitian@nutrisync.demo',
        actorRole: 'dietitian',
        action: 'PRESCRIPTION_VERIFIED',
        resourceType: 'Prescription',
        resourceId: 'rx_demo_1',
        details: 'Verified endocrine prescription and updated approved nutritional caps for patient usr_patient_1',
        createdAt: now,
      },
    ],
  };
}

class NutriSyncStore {
  private state: DatabaseState;
  public mongoConnected = false;

  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.state = JSON.parse(raw) as DatabaseState;
      } catch {
        this.state = createInitialSeedState();
        this.persist();
      }
    } else {
      this.state = createInitialSeedState();
      this.persist();
    }
  }

  public async connectMongoIfConfigured(): Promise<void> {
    const uri = process.env.MONGODB_URI?.trim();
    if (!uri) {
      this.mongoConnected = false;
      return;
    }
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      this.mongoConnected = true;
      console.log('[NutriSync DB] Connected to MongoDB Atlas via Mongoose.');
    } catch (err) {
      this.mongoConnected = false;
      console.warn('[NutriSync DB] MongoDB URI unreachable; operating safely with persistent local store.', err instanceof Error ? err.message : err);
    }
  }

  public get data(): DatabaseState {
    return this.state;
  }

  public persist(): void {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  public resetToDemoSeed(): void {
    this.state = createInitialSeedState();
    this.persist();
  }

  public addAuditLog(entry: Omit<AuditLogRecord, 'id' | 'createdAt'>): void {
    this.state.auditLogs.unshift({
      ...entry,
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    });
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 500);
    }
    this.persist();
  }

  public addNotification(userId: string, title: string, message: string, category: NotificationRecord['category']): NotificationRecord {
    const notif: NotificationRecord = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      title,
      message,
      category,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.state.notifications.unshift(notif);
    this.persist();
    return notif;
  }
}

export const dbStore = new NutriSyncStore();
