import { Router, Response } from 'express';
import { dbStore, MealRecord } from '../config/store.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { emitToRole, emitToUser } from '../sockets/socketHub.js';

export const operationsRouter = Router();

// ==========================================
// 1. CHEF & CLINICAL KITCHEN ROUTES (PHI-MINIMIZED)
// ==========================================
operationsRouter.get(
  '/kitchen/dashboard',
  requireAuth,
  requireRole('chef', 'admin'),
  (_req: AuthenticatedRequest, res: Response) => {
    // PRIVACY REQUIREMENT: Strip patient medical diagnoses, prescriptions, phone, email, and dropoff address!
    // Kitchen ONLY receives order number, scheduled slot, meal items, portion sizes, and critical allergen alerts.
    const sanitizedOrders = dbStore.data.orders
      .filter((o) => ['confirmed', 'preparing', 'quality_checked', 'ready_for_dispatch'].includes(o.status))
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        scheduledSlot: o.scheduledSlot,
        status: o.status,
        items: o.items,
        patientAllergenWarnings: o.patientAllergenWarnings,
        qualityChecklist: o.qualityChecklist,
        createdAt: o.createdAt,
      }));

    const approvedPlansCount = dbStore.data.mealPlans.filter((mp) => mp.status === 'approved').length;
    const lowStockItems = dbStore.data.inventory.filter((i) => i.stockQty <= i.reorderThreshold);

    res.json({
      orders: sanitizedOrders,
      approvedPlansCount,
      recipes: dbStore.data.meals.map((m) => ({
        id: m.id,
        name: m.name,
        portionSize: m.portionSize,
        prepTimeMins: m.prepTimeMins,
        ingredients: m.ingredients,
        allergens: m.allergens,
        sodium: m.sodium,
        calories: m.calories,
        recipeSteps: m.recipeSteps,
        isAvailable: m.isAvailable,
      })),
      inventory: dbStore.data.inventory,
      lowStockCount: lowStockItems.length,
    });
  }
);

operationsRouter.put(
  '/kitchen/orders/:id/status',
  requireAuth,
  requireRole('chef', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const order = dbStore.data.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const { status, qualityChecklist } = req.body as {
      status?: 'preparing' | 'quality_checked' | 'ready_for_dispatch';
      qualityChecklist?: Partial<typeof order.qualityChecklist>;
    };

    if (qualityChecklist) {
      order.qualityChecklist = { ...order.qualityChecklist, ...qualityChecklist };
    }

    if (status && ['preparing', 'quality_checked', 'ready_for_dispatch'].includes(status)) {
      if (
        status === 'ready_for_dispatch' &&
        (!order.qualityChecklist.portionWeighed ||
          !order.qualityChecklist.allergenCrossCheck ||
          !order.qualityChecklist.sodiumVerified ||
          !order.qualityChecklist.tamperSealApplied)
      ) {
        res.status(400).json({
          error: 'All 4 clinical quality-control checks (Portion, Allergen, Sodium, Tamper Seal) must be completed before dispatch.',
        });
        return;
      }
      order.status = status;
      order.updatedAt = new Date().toISOString();
    }

    dbStore.persist();

    const notif = dbStore.addNotification(
      order.patientId,
      `Order ${order.orderNumber} Update`,
      `Kitchen updated your clinical meal status to: ${order.status.replace(/_/g, ' ')}.`,
      'order'
    );
    emitToUser(order.patientId, 'order:updated', order);
    emitToUser(order.patientId, 'notification:new', notif);
    if (order.status === 'ready_for_dispatch') {
      emitToRole('delivery', 'delivery:ready', { orderNumber: order.orderNumber, orderId: order.id });
    }

    res.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        qualityChecklist: order.qualityChecklist,
      },
    });
  }
);

operationsRouter.put(
  '/kitchen/inventory/:id',
  requireAuth,
  requireRole('chef', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const item = dbStore.data.inventory.find((i) => i.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Inventory item not found.' });
      return;
    }
    const { stockQty, reorderThreshold } = req.body;
    if (stockQty !== undefined) item.stockQty = Math.max(0, Number(stockQty));
    if (reorderThreshold !== undefined) item.reorderThreshold = Math.max(0, Number(reorderThreshold));
    item.lastUpdatedBy = req.user!.name;
    item.updatedAt = new Date().toISOString();
    dbStore.persist();

    res.json({ item });
  }
);

// ==========================================
// 2. DELIVERY PARTNER ROUTES
// ==========================================
operationsRouter.get(
  '/delivery/dashboard',
  requireAuth,
  requireRole('delivery', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const partnerProfile =
      dbStore.data.deliveryProfiles.find((d) => d.userId === req.user!.id) ||
      dbStore.data.deliveryProfiles[0];

    // Partner sees dispatchable/assigned orders with customer dropoff address & coordinates, ZERO medical info
    const relevantOrders = dbStore.data.orders
      .filter(
        (o) =>
          (req.user!.role === 'admin' ||
            !o.assignedDeliveryPartnerId ||
            o.assignedDeliveryPartnerId === req.user!.id) &&
          ['ready_for_dispatch', 'picked_up', 'out_for_delivery', 'delivered', 'preparing'].includes(o.status)
      )
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        scheduledSlot: o.scheduledSlot,
        itemCount: o.items.reduce((acc, it) => acc + it.quantity, 0),
        deliveryAddress: o.deliveryAddress,
        pickupHub: {
          name: dbStore.data.platformSettings.kitchenDispatchHubName,
          address: dbStore.data.platformSettings.kitchenDispatchAddress,
          lat: dbStore.data.platformSettings.kitchenLat,
          lng: dbStore.data.platformSettings.kitchenLng,
        },
        payoutInr: 75,
        updatedAt: o.updatedAt,
      }));

    res.json({
      partnerProfile,
      deliveries: relevantOrders,
    });
  }
);

operationsRouter.put(
  '/delivery/availability',
  requireAuth,
  requireRole('delivery'),
  (req: AuthenticatedRequest, res: Response) => {
    const profile = dbStore.data.deliveryProfiles.find((d) => d.userId === req.user!.id);
    if (!profile) {
      res.status(404).json({ error: 'Delivery profile not found.' });
      return;
    }
    profile.isAvailable = Boolean(req.body.isAvailable);
    dbStore.persist();
    res.json({ partnerProfile: profile });
  }
);

operationsRouter.put(
  '/delivery/orders/:id/status',
  requireAuth,
  requireRole('delivery', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const order = dbStore.data.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const { status } = req.body as { status?: 'picked_up' | 'out_for_delivery' | 'delivered' };
    if (!status || !['picked_up', 'out_for_delivery', 'delivered'].includes(status)) {
      res.status(400).json({ error: 'Invalid delivery status transition.' });
      return;
    }

    order.assignedDeliveryPartnerId = req.user!.id;
    order.assignedDeliveryPartnerName = req.user!.name;
    order.status = status;
    order.updatedAt = new Date().toISOString();

    if (status === 'delivered') {
      const partner = dbStore.data.deliveryProfiles.find((d) => d.userId === req.user!.id);
      if (partner) {
        partner.totalDeliveries += 1;
        partner.totalEarningsInr += 75;
      }
    }

    dbStore.persist();

    const notif = dbStore.addNotification(
      order.patientId,
      `Delivery Update: ${order.orderNumber}`,
      `Your clinical meal order is now ${status.replace(/_/g, ' ')}.`,
      'delivery'
    );
    emitToUser(order.patientId, 'order:updated', order);
    emitToUser(order.patientId, 'notification:new', notif);
    emitToRole('admin', 'order:updated', { id: order.id, status: order.status });

    res.json({ orderId: order.id, status: order.status });
  }
);

// ==========================================
// 3. SUPER ADMIN GOVERNANCE & ANALYTICS ROUTES
// ==========================================
operationsRouter.get(
  '/admin/dashboard',
  requireAuth,
  requireRole('admin'),
  (_req: AuthenticatedRequest, res: Response) => {
    const users = dbStore.data.users.map(({ passwordHash: _pw, ...safe }) => safe);
    const capturedPayments = dbStore.data.payments.filter((p) => p.status === 'captured');
    const totalRevenueInr = capturedPayments.reduce((sum, p) => sum + p.amountInr, 0);
    const pendingPaymentsCount = dbStore.data.payments.filter((p) => p.status === 'created').length;
    const cancelledOrdersCount = dbStore.data.orders.filter((o) => o.status === 'cancelled').length;

    // Demand forecasting & popularity computed dynamically from real orders & subscriptions
    const mealOrderCounts = new Map<string, number>();
    dbStore.data.orders.forEach((o) => {
      o.items.forEach((item) => {
        mealOrderCounts.set(item.mealId, (mealOrderCounts.get(item.mealId) || 0) + item.quantity);
      });
    });
    dbStore.data.subscriptions
      .filter((s) => s.status === 'active')
      .forEach((s) => {
        s.selectedMealIds.forEach((mId) => {
          mealOrderCounts.set(mId, (mealOrderCounts.get(mId) || 0) + 3);
        });
      });

    const demandForecast = dbStore.data.meals.map((m) => {
      const historicalUnits = mealOrderCounts.get(m.id) || 1;
      return {
        mealId: m.id,
        mealName: m.name.slice(0, 28),
        historicalUnits,
        projectedNext7Days: Math.ceil(historicalUnits * 2.4),
        revenueContributionInr: historicalUnits * m.priceInr,
      };
    });

    const integrationStatus = {
      mongodbAtlas: Boolean(process.env.MONGODB_URI?.trim()),
      mongoConnected: dbStore.mongoConnected,
      geminiApiConfigured: Boolean(
        process.env.GEMINI_API_KEY?.trim() && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
      razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()),
      smtpConfigured: Boolean(process.env.EMAIL_HOST?.trim() && process.env.EMAIL_USER?.trim()),
      cloudinaryConfigured: Boolean(process.env.CLOUDINARY_CLOUD_NAME?.trim()),
    };

    res.json({
      isDemoSeeded: dbStore.data.isDemoSeeded,
      kpis: {
        totalUsers: users.length,
        totalPatients: users.filter((u) => u.role === 'patient').length,
        verifiedDietitians: dbStore.data.dietitianProfiles.filter((d) => d.verificationStatus === 'verified').length,
        totalChefs: users.filter((u) => u.role === 'chef').length,
        deliveryPartners: dbStore.data.deliveryProfiles.length,
        totalOrders: dbStore.data.orders.length,
        activeSubscriptions: dbStore.data.subscriptions.filter((s) => s.status === 'active').length,
        totalRevenueInr,
        pendingPaymentsCount,
        cancelledOrdersCount,
      },
      demandForecast,
      users,
      dietitianProfiles: dbStore.data.dietitianProfiles,
      deliveryProfiles: dbStore.data.deliveryProfiles,
      meals: dbStore.data.meals,
      categories: dbStore.data.categories,
      orders: dbStore.data.orders,
      subscriptions: dbStore.data.subscriptions,
      payments: dbStore.data.payments,
      reviews: dbStore.data.reviews,
      auditLogs: dbStore.data.auditLogs.slice(0, 100),
      platformSettings: dbStore.data.platformSettings,
      integrationStatus,
    });
  }
);

operationsRouter.put(
  '/admin/users/:id/status',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const user = dbStore.data.users.find((u) => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const { isActive, verificationStatus } = req.body as {
      isActive?: boolean;
      verificationStatus?: 'pending' | 'verified' | 'rejected';
    };

    if (typeof isActive === 'boolean') {
      user.isActive = isActive;
    }

    if (verificationStatus) {
      user.isVerifiedByAdmin = verificationStatus === 'verified';
      const dietitian = dbStore.data.dietitianProfiles.find((d) => d.userId === user.id);
      if (dietitian) dietitian.verificationStatus = verificationStatus;
      const partner = dbStore.data.deliveryProfiles.find((d) => d.userId === user.id);
      if (partner) partner.verificationStatus = verificationStatus;
    }

    dbStore.addAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: 'admin',
      action: 'ADMIN_USER_STATUS_CHANGE',
      resourceType: 'User',
      resourceId: user.id,
      details: `Updated user ${user.email}: active=${user.isActive}, verified=${user.isVerifiedByAdmin}`,
    });
    dbStore.persist();

    const { passwordHash: _pw, ...safeUser } = user;
    res.json({ user: safeUser });
  }
);

operationsRouter.post(
  '/admin/meals',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const body = req.body;
    if (!body.name || !body.categorySlug || body.priceInr === undefined) {
      res.status(400).json({ error: 'Meal name, category, and price are required.' });
      return;
    }

    const cat = dbStore.data.categories.find((c) => c.slug === body.categorySlug);
    const meal: MealRecord = {
      id: `meal_${Date.now()}`,
      name: String(body.name),
      slug: String(body.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
      imageUrl: String(body.imageUrl || '/images/hero_nutrisync_plate.jpg'),
      description: String(body.description || 'Clinically balanced therapeutic meal.'),
      categorySlug: String(body.categorySlug),
      categoryName: cat?.name || 'Balanced Nutrition',
      dietaryType: body.dietaryType || 'vegetarian',
      ingredients: Array.isArray(body.ingredients) ? body.ingredients.map(String) : ['Whole grains', 'Fresh greens'],
      allergens: Array.isArray(body.allergens) ? body.allergens.map(String) : [],
      calories: Number(body.calories || 420),
      protein: Number(body.protein || 26),
      carbs: Number(body.carbs || 42),
      fat: Number(body.fat || 13),
      fiber: Number(body.fiber || 9),
      sodium: Number(body.sodium || 290),
      portionSize: String(body.portionSize || '400g'),
      priceInr: Number(body.priceInr),
      prepTimeMins: Number(body.prepTimeMins || 20),
      isAvailable: true,
      suitableLabels: Array.isArray(body.suitableLabels) ? body.suitableLabels.map(String) : ['Balanced Nutrition'],
      nutritionalVerificationStatus: 'verified',
      verifiedByDietitianName: 'NutriSync Clinical Board',
      ratingAvg: 4.8,
      ratingCount: 1,
      recipeSteps: Array.isArray(body.recipeSteps)
        ? body.recipeSteps.map(String)
        : ['Prepare ingredients per low-sodium clinical SOP.'],
    };

    dbStore.data.meals.unshift(meal);
    dbStore.addAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: 'admin',
      action: 'MEAL_CREATED',
      resourceType: 'Meal',
      resourceId: meal.id,
      details: `Added verified meal "${meal.name}"`,
    });
    dbStore.persist();

    res.status(201).json({ meal });
  }
);

operationsRouter.put(
  '/admin/meals/:id',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const meal = dbStore.data.meals.find((m) => m.id === req.params.id);
    if (!meal) {
      res.status(404).json({ error: 'Meal not found.' });
      return;
    }
    if (typeof req.body.isAvailable === 'boolean') meal.isAvailable = req.body.isAvailable;
    if (req.body.priceInr !== undefined) meal.priceInr = Number(req.body.priceInr);
    if (req.body.name) meal.name = String(req.body.name);
    dbStore.persist();
    res.json({ meal });
  }
);

operationsRouter.put(
  '/admin/payments/:id/refund',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const payment = dbStore.data.payments.find((p) => p.id === req.params.id);
    if (!payment) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }
    payment.status = 'refunded';
    payment.refundReason = String(req.body.reason || 'Admin-authorized customer refund');

    if (payment.orderId) {
      const order = dbStore.data.orders.find((o) => o.id === payment.orderId);
      if (order) {
        order.paymentStatus = 'refunded';
        order.status = 'cancelled';
      }
    }

    dbStore.addAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: 'admin',
      action: 'PAYMENT_REFUNDED',
      resourceType: 'Payment',
      resourceId: payment.id,
      details: `Refunded ₹${payment.amountInr} (${payment.invoiceNumber}): ${payment.refundReason}`,
    });
    dbStore.persist();

    res.json({ payment });
  }
);

operationsRouter.put(
  '/admin/reviews/:id/moderate',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const review = dbStore.data.reviews.find((r) => r.id === req.params.id);
    if (!review) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }
    if (req.body.moderationStatus) review.moderationStatus = req.body.moderationStatus;
    if (req.body.adminResolution !== undefined) review.adminResolution = String(req.body.adminResolution);
    dbStore.persist();
    res.json({ review });
  }
);

operationsRouter.put(
  '/admin/settings',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const { freeDeliveryThresholdInr, standardDeliveryFeeInr, prescriptionRetentionDays } = req.body;
    if (freeDeliveryThresholdInr !== undefined) {
      dbStore.data.platformSettings.freeDeliveryThresholdInr = Number(freeDeliveryThresholdInr);
    }
    if (standardDeliveryFeeInr !== undefined) {
      dbStore.data.platformSettings.standardDeliveryFeeInr = Number(standardDeliveryFeeInr);
    }
    if (prescriptionRetentionDays !== undefined) {
      dbStore.data.platformSettings.prescriptionRetentionDays = Number(prescriptionRetentionDays);
    }
    dbStore.persist();
    res.json({ settings: dbStore.data.platformSettings });
  }
);
