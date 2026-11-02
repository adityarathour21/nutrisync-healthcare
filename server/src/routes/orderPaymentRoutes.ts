import { Router, Response } from 'express';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { dbStore, OrderRecord, PaymentRecord, SubscriptionRecord } from '../config/store.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { emitToRole, emitToUser } from '../sockets/socketHub.js';

export const orderPaymentRouter = Router();

function getSandboxSecret(): string {
  return process.env.RAZORPAY_KEY_SECRET?.trim() || 'nutrisync_test_hmac_secret_2026';
}

function getRazorpayInstance(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// Step 1: Create Payment Session (Razorpay Live/Test API or Verified Sandbox Test Gateway)
orderPaymentRouter.post(
  '/payments/create-session',
  requireAuth,
  requireRole('patient'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { amountInr, purpose = 'meal_order' } = req.body as {
        amountInr?: number;
        purpose?: string;
      };

      const totalAmount = Math.max(1, Math.round(Number(amountInr || 0)));
      if (!totalAmount || Number.isNaN(totalAmount)) {
        res.status(400).json({ error: 'Valid payment amount in INR is required.' });
        return;
      }

      const rzp = getRazorpayInstance();
      if (rzp) {
        const order = await rzp.orders.create({
          amount: totalAmount * 100,
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`,
          notes: { patientId: req.user!.id, purpose },
        });
        res.json({
          mode: 'razorpay',
          keyId: process.env.RAZORPAY_KEY_ID,
          gatewayOrderId: order.id,
          amountInr: totalAmount,
          currency: 'INR',
        });
        return;
      }

      // Safe Sandbox Test Mode when RAZORPAY_KEY_ID/SECRET are not set in .env:
      // Issues a server-generated gatewayOrderId and server-verifiable test signature token
      const gatewayOrderId = `order_test_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const testPaymentId = `pay_test_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const expectedSignature = crypto
        .createHmac('sha256', getSandboxSecret())
        .update(`${gatewayOrderId}|${testPaymentId}`)
        .digest('hex');

      res.json({
        mode: 'razorpay_test_sandbox',
        notice:
          'Razorpay API credentials are not set in environment variables — running in NutriSync Server-Verified Test Sandbox mode.',
        gatewayOrderId,
        sandboxTestPayload: {
          razorpay_order_id: gatewayOrderId,
          razorpay_payment_id: testPaymentId,
          razorpay_signature: expectedSignature,
        },
        amountInr: totalAmount,
        currency: 'INR',
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to initialize payment.' });
    }
  }
);

// Step 2: Verify Payment Signature on Server & Commit Order
orderPaymentRouter.post(
  '/orders/checkout',
  requireAuth,
  requireRole('patient'),
  (req: AuthenticatedRequest, res: Response) => {
    const {
      items,
      addressId,
      scheduledSlot = '12:30 - 13:15',
      couponCode = '',
      redeemLoyaltyPoints = false,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Cart items are required.' });
      return;
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: 'Payment verification parameters are missing.' });
      return;
    }

    // CRITICAL SECURITY: Cryptographically verify HMAC-SHA256 payment signature on server
    const expectedSig = crypto
      .createHmac('sha256', getSandboxSecret())
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      res.status(400).json({ error: 'Cryptographic payment signature verification failed.' });
      return;
    }

    const address = dbStore.data.addresses.find(
      (a) => a.id === addressId && a.userId === req.user!.id
    );
    if (!address) {
      res.status(400).json({ error: 'Please select a valid saved delivery address.' });
      return;
    }

    const orderItems = [];
    let subtotalInr = 0;

    for (const rawItem of items) {
      const meal = dbStore.data.meals.find((m) => m.id === rawItem.mealId && m.isAvailable);
      if (!meal) {
        res.status(400).json({ error: `Meal ${rawItem.mealId} is unavailable.` });
        return;
      }
      const qty = Math.max(1, Number(rawItem.quantity || 1));
      subtotalInr += meal.priceInr * qty;
      orderItems.push({
        mealId: meal.id,
        mealName: meal.name,
        quantity: qty,
        unitPriceInr: meal.priceInr,
        portionSize: meal.portionSize,
        calories: meal.calories,
        sodium: meal.sodium,
        allergens: meal.allergens,
      });
    }

    let discountInr = 0;
    if (couponCode) {
      const foundCoupon = dbStore.data.coupons.find(
        (c) => c.code.toUpperCase() === String(couponCode).toUpperCase().trim()
      );
      if (foundCoupon) {
        discountInr += Math.min(
          foundCoupon.maxDiscountInr,
          Math.round((subtotalInr * foundCoupon.discountPercent) / 100)
        );
      }
    }

    const userRecord = dbStore.data.users.find((u) => u.id === req.user!.id)!;
    if (redeemLoyaltyPoints && userRecord.loyaltyPoints >= 50) {
      const ptsToRedeem = Math.min(userRecord.loyaltyPoints, 100);
      discountInr += ptsToRedeem;
      userRecord.loyaltyPoints -= ptsToRedeem;
    }

    const deliveryFeeInr =
      subtotalInr >= dbStore.data.platformSettings.freeDeliveryThresholdInr
        ? 0
        : dbStore.data.platformSettings.standardDeliveryFeeInr;

    const totalInr = Math.max(1, subtotalInr - discountInr + deliveryFeeInr);

    const profile = dbStore.data.patientProfiles.find((p) => p.userId === req.user!.id);
    const allergenWarnings = (profile?.allergies || []).map(
      (alg) => `STRICT ALLERGY: ${alg.toUpperCase()} — Separate Prep Utensils Required`
    );

    const availablePartner = dbStore.data.deliveryProfiles.find(
      (d) => d.isAvailable && d.verificationStatus === 'verified'
    );

    const now = new Date().toISOString();
    const orderNumber = `NS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: OrderRecord = {
      id: `ord_${Date.now()}`,
      orderNumber,
      patientId: req.user!.id,
      patientName: req.user!.name,
      items: orderItems,
      patientAllergenWarnings: allergenWarnings,
      subtotalInr,
      discountInr,
      deliveryFeeInr,
      totalInr,
      couponCode: String(couponCode || ''),
      status: 'confirmed',
      paymentStatus: 'paid',
      deliveryAddress: {
        label: address.label,
        recipientName: address.recipientName,
        phone: address.phone,
        formattedAddress: address.formattedAddress,
        postalCode: address.postalCode,
        lat: address.lat,
        lng: address.lng,
      },
      assignedDeliveryPartnerId: availablePartner?.userId || null,
      assignedDeliveryPartnerName: availablePartner?.name || null,
      qualityChecklist: {
        portionWeighed: false,
        allergenCrossCheck: false,
        sodiumVerified: false,
        tamperSealApplied: false,
      },
      scheduledSlot: String(scheduledSlot),
      createdAt: now,
      updatedAt: now,
    };

    const payment: PaymentRecord = {
      id: `pay_${Date.now()}`,
      patientId: req.user!.id,
      patientName: req.user!.name,
      orderId: newOrder.id,
      subscriptionId: null,
      gateway: getRazorpayInstance() ? 'razorpay' : 'razorpay_test_sandbox',
      gatewayOrderId: String(razorpay_order_id),
      gatewayPaymentId: String(razorpay_payment_id),
      signatureVerified: true,
      amountInr: totalInr,
      status: 'captured',
      invoiceNumber: `INV-${orderNumber}`,
      refundReason: '',
      createdAt: now,
    };

    // Award loyalty points (5% of order total)
    userRecord.loyaltyPoints += Math.max(5, Math.round(totalInr * 0.05));

    dbStore.data.orders.unshift(newOrder);
    dbStore.data.payments.unshift(payment);
    dbStore.addAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: 'patient',
      action: 'ORDER_PAID_AND_CONFIRMED',
      resourceType: 'Order',
      resourceId: newOrder.id,
      details: `Order ${orderNumber} placed for ₹${totalInr} (HMAC signature verified)`,
    });
    dbStore.persist();

    emitToRole('chef', 'order:incoming', { orderNumber, status: newOrder.status });
    emitToRole('admin', 'order:incoming', { orderNumber, totalInr });
    emitToUser(req.user!.id, 'order:updated', newOrder);

    res.status(201).json({ order: newOrder, payment });
  }
);

orderPaymentRouter.get('/orders/my', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const orders = dbStore.data.orders.filter((o) => o.patientId === req.user!.id);
  res.json({ orders });
});

orderPaymentRouter.get('/payments/my', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const payments = dbStore.data.payments.filter((p) => p.patientId === req.user!.id);
  res.json({ payments });
});

orderPaymentRouter.get('/subscriptions/my', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const subscriptions = dbStore.data.subscriptions.filter((s) => s.patientId === req.user!.id);
  res.json({ subscriptions });
});

orderPaymentRouter.post(
  '/subscriptions',
  requireAuth,
  requireRole('patient'),
  (req: AuthenticatedRequest, res: Response) => {
    const {
      planType,
      planName,
      selectedMealIds = [],
      deliveryAddressId,
      deliveryTimeSlot = '12:30 - 13:15',
      startDate,
      endDate,
      priceInr,
      autoRenewConsent = false,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!planType || !planName || !deliveryAddressId || !startDate || !endDate || !priceInr) {
      res.status(400).json({ error: 'Plan type, delivery address, dates, and price are required.' });
      return;
    }

    const expectedSig = crypto
      .createHmac('sha256', getSandboxSecret())
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      res.status(400).json({ error: 'Subscription payment signature verification failed.' });
      return;
    }

    const now = new Date().toISOString();
    const sub: SubscriptionRecord = {
      id: `sub_${Date.now()}`,
      patientId: req.user!.id,
      patientName: req.user!.name,
      planType,
      planName: String(planName),
      selectedMealIds: Array.isArray(selectedMealIds) ? selectedMealIds.map(String) : [],
      deliveryAddressId: String(deliveryAddressId),
      deliveryTimeSlot: String(deliveryTimeSlot),
      startDate: String(startDate),
      endDate: String(endDate),
      status: 'active',
      priceInr: Number(priceInr),
      autoRenewConsent: Boolean(autoRenewConsent), // Explicit opt-in only!
      createdAt: now,
    };

    const payment: PaymentRecord = {
      id: `pay_${Date.now()}`,
      patientId: req.user!.id,
      patientName: req.user!.name,
      orderId: null,
      subscriptionId: sub.id,
      gateway: getRazorpayInstance() ? 'razorpay' : 'razorpay_test_sandbox',
      gatewayOrderId: String(razorpay_order_id),
      gatewayPaymentId: String(razorpay_payment_id),
      signatureVerified: true,
      amountInr: Number(priceInr),
      status: 'captured',
      invoiceNumber: `INV-SUB-${Date.now().toString().slice(-5)}`,
      refundReason: '',
      createdAt: now,
    };

    dbStore.data.subscriptions.unshift(sub);
    dbStore.data.payments.unshift(payment);
    dbStore.persist();

    emitToUser(req.user!.id, 'subscription:updated', sub);
    emitToRole('admin', 'subscription:created', sub);

    res.status(201).json({ subscription: sub, payment });
  }
);

orderPaymentRouter.put(
  '/subscriptions/:id/status',
  requireAuth,
  requireRole('patient', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const sub = dbStore.data.subscriptions.find((s) => s.id === req.params.id);
    if (!sub) {
      res.status(404).json({ error: 'Subscription not found.' });
      return;
    }
    if (req.user!.role !== 'admin' && sub.patientId !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to modify this subscription.' });
      return;
    }

    const { status, autoRenewConsent } = req.body as {
      status?: 'active' | 'paused' | 'cancelled';
      autoRenewConsent?: boolean;
    };

    if (status && ['active', 'paused', 'cancelled'].includes(status)) {
      sub.status = status;
    }
    if (typeof autoRenewConsent === 'boolean') {
      sub.autoRenewConsent = autoRenewConsent;
    }

    dbStore.persist();
    emitToUser(sub.patientId, 'subscription:updated', sub);
    res.json({ subscription: sub });
  }
);
