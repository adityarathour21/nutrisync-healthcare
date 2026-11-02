import mongoose, { Schema } from 'mongoose';

// 1. Users
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['patient', 'dietitian', 'chef', 'delivery', 'admin'],
      default: 'patient',
      index: true,
    },
    phone: { type: String, trim: true, default: '' },
    isEmailVerified: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isVerifiedByAdmin: { type: Boolean, default: false },
    preferredLanguage: { type: String, enum: ['en', 'hi'], default: 'en' },
    referralCode: { type: String, index: true },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

// 2. PatientProfiles
const PatientProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    age: { type: Number, min: 1, max: 120 },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'], default: 'prefer_not_to_say' },
    heightCm: { type: Number, min: 50, max: 260 },
    weightKg: { type: Number, min: 10, max: 350 },
    dietaryPreference: { type: String, enum: ['vegetarian', 'vegan', 'non_vegetarian', 'eggetarian'], default: 'vegetarian' },
    allergies: [{ type: String, trim: true }],
    intolerances: [{ type: String, trim: true }],
    medicalConditions: [{ type: String, trim: true }],
    assignedDietitianId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    approvedTargets: {
      dailyCalories: { type: Number, default: 1800 },
      maxCarbsGrams: { type: Number, default: 180 },
      minProteinGrams: { type: Number, default: 75 },
      maxFatGrams: { type: Number, default: 60 },
      minFiberGrams: { type: Number, default: 30 },
      maxSodiumMg: { type: Number, default: 1500 },
      restrictedIngredients: [{ type: String }],
      approvedByDietitianId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      approvedAt: { type: Date, default: null },
      clinicalNotes: { type: String, default: '' },
    },
    favoriteMealIds: [{ type: String }],
    familyMembers: [
      {
        id: { type: String },
        name: { type: String },
        relation: { type: String },
        age: { type: Number },
        dietaryPreference: { type: String },
        allergies: [{ type: String }],
        medicalConditions: [{ type: String }],
        authorized: { type: Boolean, default: true },
      },
    ],
    mealRemindersEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// 3. DietitianProfiles
const DietitianProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    qualification: { type: String, required: true },
    licenseNumber: { type: String, required: true, unique: true },
    specializations: [{ type: String }],
    experienceYears: { type: Number, default: 1, min: 0 },
    hospitalAffiliation: { type: String, default: '' },
    consultationFeeInr: { type: Number, default: 600, min: 0 },
    bio: { type: String, default: '' },
    verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
    rating: { type: Number, default: 4.8, min: 0, max: 5 },
  },
  { timestamps: true }
);

// 4. ChefProfiles
const ChefProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    kitchenStation: { type: String, default: 'Clinical Metabolic Station A' },
    culinaryCertification: { type: String, required: true },
    foodSafetyLicense: { type: String, required: true },
    shiftTiming: { type: String, default: '06:00 - 15:00' },
  },
  { timestamps: true }
);

// 5. DeliveryProfiles
const DeliveryProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    vehicleType: { type: String, enum: ['electric_scooter', 'motorcycle', 'bicycle', 'insulated_van'], default: 'electric_scooter' },
    vehiclePlate: { type: String, required: true },
    coldChainBagId: { type: String, required: true },
    isAvailable: { type: Boolean, default: true, index: true },
    verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    totalDeliveries: { type: Number, default: 0 },
    totalEarningsInr: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// 6. Prescriptions
const PrescriptionSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
    doctorName: { type: String, default: '' },
    issuedDate: { type: String, default: '' },
    ocrExtracted: {
      rawSummary: { type: String, default: '' },
      identifiedConditions: [{ type: String }],
      dietaryInstructions: [{ type: String }],
      potentialAllergies: [{ type: String }],
      medicationsNotedForContext: [{ type: String }],
      uncertainOrUnreadableFields: [{ type: String }],
      confidenceNote: { type: String, default: '' },
    },
    verificationStatus: {
      type: String,
      enum: ['pending_dietitian_review', 'verified', 'rejected'],
      default: 'pending_dietitian_review',
      index: true,
    },
    reviewedByDietitianId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dietitianVerificationNotes: { type: String, default: '' },
    accessLogs: [
      {
        actorId: { type: String },
        actorRole: { type: String },
        action: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// 7. DietaryAssessments
const DietaryAssessmentSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dietitianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bmi: { type: Number },
    clinicalSummary: { type: String, required: true },
    approvedCalories: { type: Number, required: true },
    approvedMaxSodiumMg: { type: Number, required: true },
    approvedMaxCarbsGrams: { type: Number, required: true },
    approvedMinProteinGrams: { type: Number, required: true },
    followUpDate: { type: String, default: '' },
  },
  { timestamps: true }
);

// 8. MealPlans
const MealPlanSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdByRole: { type: String, enum: ['ai_draft', 'dietitian'], required: true },
    reviewedByDietitianId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    title: { type: String, required: true },
    durationType: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
    status: {
      type: String,
      enum: ['pending_review', 'approved', 'rejected'],
      default: 'pending_review',
      index: true,
    },
    dietitianNotes: { type: String, default: '' },
    days: [
      {
        dayLabel: { type: String },
        breakfastMealId: { type: String },
        lunchMealId: { type: String },
        snackMealId: { type: String },
        dinnerMealId: { type: String },
        totals: {
          calories: { type: Number },
          protein: { type: Number },
          carbs: { type: Number },
          fat: { type: Number },
          fiber: { type: Number },
          sodium: { type: Number },
        },
      },
    ],
  },
  { timestamps: true }
);

// 9. Categories
const CategorySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

// 10. Allergens
const AllergenSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    severityGuidance: { type: String, default: '' },
  },
  { timestamps: true }
);

// 11. Ingredients
const IngredientSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    unit: { type: String, required: true },
    allergenTags: [{ type: String }],
    glycemicCategory: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  },
  { timestamps: true }
);

// 12. Meals
const MealSchema = new Schema(
  {
    name: { type: String, required: true, index: true },
    slug: { type: String, required: true, unique: true },
    imageUrl: { type: String, required: true },
    description: { type: String, required: true },
    categorySlug: { type: String, required: true, index: true },
    dietaryType: { type: String, enum: ['vegetarian', 'vegan', 'non_vegetarian'], required: true, index: true },
    ingredients: [{ type: String }],
    allergens: [{ type: String }],
    calories: { type: Number, required: true, min: 0 },
    protein: { type: Number, required: true, min: 0 },
    carbs: { type: Number, required: true, min: 0 },
    fat: { type: Number, required: true, min: 0 },
    fiber: { type: Number, required: true, min: 0 },
    sodium: { type: Number, required: true, min: 0 },
    portionSize: { type: String, required: true },
    priceInr: { type: Number, required: true, min: 0 },
    prepTimeMins: { type: Number, required: true, min: 1 },
    isAvailable: { type: Boolean, default: true, index: true },
    suitableLabels: [{ type: String }],
    nutritionalVerificationStatus: { type: String, enum: ['verified', 'pending_review'], default: 'verified' },
    verifiedByDietitianName: { type: String, default: 'Dr. Meera Nair, RD' },
    ratingAvg: { type: Number, default: 4.8 },
    ratingCount: { type: Number, default: 24 },
  },
  { timestamps: true }
);

// 13. OrderItems
const OrderItemSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    mealId: { type: String, required: true },
    mealName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceInr: { type: Number, required: true },
    portionSize: { type: String, default: '380g' },
    allergenAlerts: [{ type: String }],
  },
  { timestamps: true }
);

// 14. Orders
const OrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [
      {
        mealId: { type: String },
        mealName: { type: String },
        quantity: { type: Number },
        unitPriceInr: { type: Number },
        portionSize: { type: String },
        calories: { type: Number },
        sodium: { type: Number },
      },
    ],
    patientAllergenWarnings: [{ type: String }],
    subtotalInr: { type: Number, required: true },
    discountInr: { type: Number, default: 0 },
    deliveryFeeInr: { type: Number, default: 0 },
    totalInr: { type: Number, required: true },
    couponCode: { type: String, default: '' },
    status: {
      type: String,
      enum: [
        'placed',
        'confirmed',
        'preparing',
        'quality_checked',
        'ready_for_dispatch',
        'picked_up',
        'out_for_delivery',
        'delivered',
        'cancelled',
      ],
      default: 'confirmed',
      index: true,
    },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    deliveryAddress: {
      label: { type: String },
      formattedAddress: { type: String },
      lat: { type: Number },
      lng: { type: Number },
    },
    assignedDeliveryPartnerId: { type: String, default: null },
    qualityChecklist: {
      portionWeighed: { type: Boolean, default: false },
      allergenCrossCheck: { type: Boolean, default: false },
      sodiumVerified: { type: Boolean, default: false },
      tamperSealApplied: { type: Boolean, default: false },
    },
    scheduledSlot: { type: String, default: '12:30 - 13:15' },
  },
  { timestamps: true }
);

// 15. Subscriptions
const SubscriptionSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planType: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'breakfast_only', 'lunch_dinner', 'full_day', 'custom_approved'],
      required: true,
    },
    planName: { type: String, required: true },
    selectedMealIds: [{ type: String }],
    deliveryAddressId: { type: String, required: true },
    deliveryTimeSlot: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: { type: String, enum: ['active', 'paused', 'cancelled', 'expired'], default: 'active', index: true },
    priceInr: { type: Number, required: true },
    autoRenewConsent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 16. Payments
const PaymentSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: String, default: null },
    subscriptionId: { type: String, default: null },
    gateway: { type: String, enum: ['razorpay', 'razorpay_test_sandbox'], default: 'razorpay_test_sandbox' },
    gatewayOrderId: { type: String, required: true, index: true },
    gatewayPaymentId: { type: String, default: '' },
    signatureVerified: { type: Boolean, default: false },
    amountInr: { type: Number, required: true },
    status: { type: String, enum: ['created', 'captured', 'failed', 'refunded'], default: 'created', index: true },
    invoiceNumber: { type: String, required: true },
    refundReason: { type: String, default: '' },
  },
  { timestamps: true }
);

// 17. Addresses
const AddressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, default: 'Home' },
    recipientName: { type: String, required: true },
    phone: { type: String, required: true },
    formattedAddress: { type: String, required: true },
    landmark: { type: String, default: '' },
    postalCode: { type: String, required: true },
    lat: { type: Number, default: 12.9716 },
    lng: { type: Number, default: 77.5946 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 18. Reviews
const ReviewSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    patientName: { type: String, required: true },
    mealId: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, maxlength: 800 },
    moderationStatus: { type: String, enum: ['approved', 'flagged', 'hidden'], default: 'approved' },
    isComplaint: { type: Boolean, default: false },
    adminResolution: { type: String, default: '' },
  },
  { timestamps: true }
);

// 19. Notifications
const NotificationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    category: { type: String, enum: ['order', 'clinical', 'subscription', 'kitchen', 'delivery', 'system'], default: 'system' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 20. Consultations
const ConsultationSchema = new Schema(
  {
    patientId: { type: String, required: true, index: true },
    patientName: { type: String, required: true },
    dietitianId: { type: String, required: true, index: true },
    dietitianName: { type: String, required: true },
    preferredDate: { type: String, required: true },
    preferredSlot: { type: String, required: true },
    healthConcern: { type: String, required: true },
    status: { type: String, enum: ['requested', 'scheduled', 'completed', 'cancelled'], default: 'requested' },
    clinicalSummaryNotes: { type: String, default: '' },
    followUpDate: { type: String, default: '' },
  },
  { timestamps: true }
);

// 21. Inventory
const InventorySchema = new Schema(
  {
    ingredientName: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    stockQty: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    reorderThreshold: { type: Number, required: true, min: 0 },
    allergenWarning: { type: String, default: '' },
    lastUpdatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

// 22. DeliveryAssignments
const DeliveryAssignmentSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    deliveryPartnerId: { type: String, required: true, index: true },
    pickupHubAddress: { type: String, required: true },
    pickupLat: { type: Number, default: 12.9784 },
    pickupLng: { type: Number, default: 77.6408 },
    dropoffAddress: { type: String, required: true },
    dropoffLat: { type: Number, default: 12.9352 },
    dropoffLng: { type: Number, default: 77.6245 },
    payoutInr: { type: Number, default: 65 },
    status: { type: String, enum: ['assigned', 'picked_up', 'out_for_delivery', 'delivered'], default: 'assigned' },
    pickedUpAt: { type: String, default: null },
    deliveredAt: { type: String, default: null },
  },
  { timestamps: true }
);

// 23. AuditLogs
const AuditLogSchema = new Schema(
  {
    actorId: { type: String, required: true, index: true },
    actorEmail: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, default: '' },
    details: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Models = {
  User: mongoose.models.User || mongoose.model('User', UserSchema),
  PatientProfile: mongoose.models.PatientProfile || mongoose.model('PatientProfile', PatientProfileSchema),
  DietitianProfile: mongoose.models.DietitianProfile || mongoose.model('DietitianProfile', DietitianProfileSchema),
  ChefProfile: mongoose.models.ChefProfile || mongoose.model('ChefProfile', ChefProfileSchema),
  DeliveryProfile: mongoose.models.DeliveryProfile || mongoose.model('DeliveryProfile', DeliveryProfileSchema),
  Prescription: mongoose.models.Prescription || mongoose.model('Prescription', PrescriptionSchema),
  DietaryAssessment: mongoose.models.DietaryAssessment || mongoose.model('DietaryAssessment', DietaryAssessmentSchema),
  MealPlan: mongoose.models.MealPlan || mongoose.model('MealPlan', MealPlanSchema),
  Category: mongoose.models.Category || mongoose.model('Category', CategorySchema),
  Allergen: mongoose.models.Allergen || mongoose.model('Allergen', AllergenSchema),
  Ingredient: mongoose.models.Ingredient || mongoose.model('Ingredient', IngredientSchema),
  Meal: mongoose.models.Meal || mongoose.model('Meal', MealSchema),
  OrderItem: mongoose.models.OrderItem || mongoose.model('OrderItem', OrderItemSchema),
  Order: mongoose.models.Order || mongoose.model('Order', OrderSchema),
  Subscription: mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema),
  Payment: mongoose.models.Payment || mongoose.model('Payment', PaymentSchema),
  Address: mongoose.models.Address || mongoose.model('Address', AddressSchema),
  Review: mongoose.models.Review || mongoose.model('Review', ReviewSchema),
  Notification: mongoose.models.Notification || mongoose.model('Notification', NotificationSchema),
  Consultation: mongoose.models.Consultation || mongoose.model('Consultation', ConsultationSchema),
  Inventory: mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema),
  DeliveryAssignment: mongoose.models.DeliveryAssignment || mongoose.model('DeliveryAssignment', DeliveryAssignmentSchema),
  AuditLog: mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema),
};
