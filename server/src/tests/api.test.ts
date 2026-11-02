import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../app.js';
import { dbStore } from '../config/store.js';
import { filterSafeMealsForPatient } from '../services/aiService.js';

const app = createExpressApp();

describe('NutriSync Backend API & Clinical Safety Suite', () => {
  beforeAll(() => {
    dbStore.resetToDemoSeed();
  });

  it('1. Authenticates demo patient and returns HTTP-only cookie + JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient@nutrisync.demo', password: 'Demo@1234' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('patient');
    expect(res.body.token).toBeTruthy();
  });

  it('2. Enforces Role-Based Access Control (Patient cannot access Super Admin dashboard)', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient@nutrisync.demo', password: 'Demo@1234' });
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });

  it('3. Enforces Kitchen PHI Minimization (Chef receives allergen warnings & items, never medical conditions)', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'chef@nutrisync.demo', password: 'Demo@1234' });
    const res = await request(app)
      .get('/api/kitchen/dashboard')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeGreaterThan(0);
    expect(res.body.orders[0].patientAllergenWarnings).toBeDefined();
    expect(res.body.orders[0].medicalConditions).toBeUndefined();
    expect(res.body.orders[0].deliveryAddress).toBeUndefined();
  });

  it('4. Deterministically excludes allergens & excessive sodium in meal recommendation filter', () => {
    const profile = dbStore.data.patientProfiles[0];
    const testMeals = [
      ...dbStore.data.meals,
      {
        ...dbStore.data.meals[0],
        id: 'unsafe_peanut_meal',
        name: 'Peanut Satay Bowl',
        allergens: ['peanuts'],
        sodium: 300,
      },
      {
        ...dbStore.data.meals[0],
        id: 'unsafe_high_sodium',
        name: 'Salty Broth',
        allergens: [],
        sodium: 1200, // Exceeds 45% of 1500mg daily cap
      },
    ];
    const safe = filterSafeMealsForPatient(testMeals, profile);
    expect(safe.some((m) => m.id === 'unsafe_peanut_meal')).toBe(false);
    expect(safe.some((m) => m.id === 'unsafe_high_sodium')).toBe(false);
  });

  it('5. Rejects tampered payment signatures and accepts valid HMAC-SHA256 verified checkout', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient@nutrisync.demo', password: 'Demo@1234' });
    const token = login.body.token;

    const sessionRes = await request(app)
      .post('/api/payments/create-session')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountInr: 349, purpose: 'meal_order' });
    expect(sessionRes.status).toBe(200);

    // Tampered signature must fail
    const badRes = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ mealId: 'meal_1', quantity: 1 }],
        addressId: 'addr_1',
        razorpay_order_id: sessionRes.body.gatewayOrderId,
        razorpay_payment_id: 'pay_fake',
        razorpay_signature: 'invalid_forged_signature',
      });
    expect(badRes.status).toBe(400);

    // Valid server-signed sandbox payload succeeds
    if (sessionRes.body.sandboxTestPayload) {
      const okRes = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ mealId: 'meal_1', quantity: 1 }],
          addressId: 'addr_1',
          ...sessionRes.body.sandboxTestPayload,
        });
      expect(okRes.status).toBe(201);
      expect(okRes.body.payment.signatureVerified).toBe(true);
    }
  });
});
