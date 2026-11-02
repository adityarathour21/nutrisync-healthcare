import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { dbStore, UserRecord, UserRole } from '../config/store.js';
import {
  AuthenticatedRequest,
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signAuthToken,
} from '../middleware/auth.js';
import { sendClinicalEmail } from '../services/emailService.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = 'patient',
      phone = '',
      qualification = '',
      licenseNumber = '',
      vehiclePlate = '',
      referralCodeUsed = '',
    } = req.body as Record<string, string>;

    if (!name || !email || !password || password.length < 6) {
      res.status(400).json({ error: 'Name, valid email, and password (min 6 chars) are required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (dbStore.data.users.some((u) => u.email === normalizedEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const allowedRoles: UserRole[] = ['patient', 'dietitian', 'chef', 'delivery'];
    const safeRole: UserRole = allowedRoles.includes(role as UserRole) ? (role as UserRole) : 'patient';

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    let initialPoints = 100;
    if (referralCodeUsed) {
      const referrer = dbStore.data.users.find(
        (u) => u.referralCode.toLowerCase() === referralCodeUsed.toLowerCase().trim()
      );
      if (referrer) {
        referrer.loyaltyPoints += 150;
        initialPoints += 150;
      }
    }

    const newUser: UserRecord = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: safeRole,
      phone: phone.trim(),
      isEmailVerified: true,
      isActive: true,
      isVerifiedByAdmin: safeRole === 'patient',
      preferredLanguage: 'en',
      referralCode: `${name.trim().slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'NS')}${Math.floor(100 + Math.random() * 900)}`,
      loyaltyPoints: safeRole === 'patient' ? initialPoints : 0,
      createdAt: now,
    };

    dbStore.data.users.push(newUser);

    if (safeRole === 'patient') {
      const defaultDietitian = dbStore.data.dietitianProfiles.find((d) => d.verificationStatus === 'verified');
      dbStore.data.patientProfiles.push({
        userId,
        age: 30,
        gender: 'prefer_not_to_say',
        heightCm: 170,
        weightKg: 70,
        dietaryPreference: 'vegetarian',
        allergies: [],
        intolerances: [],
        medicalConditions: [],
        assignedDietitianId: defaultDietitian?.userId || null,
        approvedTargets: {
          dailyCalories: 1800,
          maxCarbsGrams: 190,
          minProteinGrams: 70,
          maxFatGrams: 60,
          minFiberGrams: 30,
          maxSodiumMg: 1800,
          restrictedIngredients: [],
          approvedByDietitianId: null,
          approvedByDietitianName: null,
          approvedAt: null,
          clinicalNotes: 'Baseline wellness nutritional limits pending Certified Dietitian assessment.',
        },
        favoriteMealIds: [],
        familyMembers: [],
        mealRemindersEnabled: true,
        dailyIntakeLog: [],
      });
    } else if (safeRole === 'dietitian') {
      dbStore.data.dietitianProfiles.push({
        userId,
        name: newUser.name,
        qualification: qualification || 'MSc Clinical Nutrition & Dietetics',
        licenseNumber: licenseNumber || `IDA-PENDING-${Date.now().toString().slice(-4)}`,
        specializations: ['Clinical Nutrition', 'Metabolic Care'],
        experienceYears: 3,
        hospitalAffiliation: 'Independent Clinical Practice',
        consultationFeeInr: 600,
        bio: 'Registered clinical nutrition practitioner awaiting credential verification.',
        verificationStatus: 'pending',
        rating: 4.8,
      });
    } else if (safeRole === 'delivery') {
      dbStore.data.deliveryProfiles.push({
        userId,
        name: newUser.name,
        vehicleType: 'electric_scooter',
        vehiclePlate: vehiclePlate || 'KA-01-TEMP-0001',
        coldChainBagId: `NS-COLD-${Math.floor(200 + Math.random() * 700)}`,
        isAvailable: true,
        verificationStatus: 'pending',
        totalDeliveries: 0,
        totalEarningsInr: 0,
      });
    }

    dbStore.addAuditLog({
      actorId: userId,
      actorEmail: normalizedEmail,
      actorRole: safeRole,
      action: 'USER_REGISTERED',
      resourceType: 'User',
      resourceId: userId,
      details: `Registered new ${safeRole} account`,
    });

    dbStore.persist();

    const token = signAuthToken(newUser);
    setAuthCookie(res, token);

    const { passwordHash: _pw, ...safeUser } = newUser;
    res.status(201).json({ user: safeUser, token });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = dbStore.data.users.find((u) => u.email === email.toLowerCase().trim());
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'This account has been deactivated. Contact platform support.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    dbStore.addAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_LOGIN',
      resourceType: 'Session',
      resourceId: user.id,
      details: 'Authenticated via email & password',
    });

    const { passwordHash: _pw, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Sign-in failed.' });
  }
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Signed out successfully.' });
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

authRouter.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = dbStore.data.users.find((u) => u.id === req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const { name, phone, preferredLanguage, newPassword, deactivateAccount } = req.body as {
    name?: string;
    phone?: string;
    preferredLanguage?: 'en' | 'hi';
    newPassword?: string;
    deactivateAccount?: boolean;
  };

  if (name) user.name = name.trim();
  if (typeof phone === 'string') user.phone = phone.trim();
  if (preferredLanguage === 'en' || preferredLanguage === 'hi') {
    user.preferredLanguage = preferredLanguage;
  }
  if (newPassword && newPassword.length >= 6) {
    user.passwordHash = await bcrypt.hash(newPassword, 10);
  }
  if (deactivateAccount === true) {
    user.isActive = false;
    clearAuthCookie(res);
  }

  dbStore.persist();
  const { passwordHash: _pw, ...safeUser } = user;
  res.json({ user: safeUser });
});

const resetCodes = new Map<string, { code: string; expiresAt: number }>();

authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }
  const normalized = email.toLowerCase().trim();
  const user = dbStore.data.users.find((u) => u.email === normalized);
  if (!user) {
    res.json({ message: 'If that email is registered, a verification code has been issued.' });
    return;
  }

  const code = crypto.randomInt(100000, 999999).toString();
  resetCodes.set(normalized, { code, expiresAt: Date.now() + 15 * 60 * 1000 });

  const mailResult = await sendClinicalEmail({
    to: normalized,
    subject: 'NutriSync Password Reset Verification Code',
    text: `Your NutriSync password reset code is: ${code} (valid for 15 minutes).`,
  });

  res.json({
    message:
      mailResult.mode === 'smtp'
        ? 'Verification code sent to your email.'
        : 'SMTP is not configured in this environment. Use the development verification code below to test password reset.',
    devVerificationCode: mailResult.mode === 'unconfigured_preview' ? code : undefined,
  });
});

authRouter.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body as {
    email?: string;
    code?: string;
    newPassword?: string;
  };
  if (!email || !code || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'Email, verification code, and new password (min 6 chars) are required.' });
    return;
  }

  const normalized = email.toLowerCase().trim();
  const entry = resetCodes.get(normalized);
  if (!entry || entry.code !== code.trim() || Date.now() > entry.expiresAt) {
    res.status(400).json({ error: 'Invalid or expired verification code.' });
    return;
  }

  const user = dbStore.data.users.find((u) => u.email === normalized);
  if (!user) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  resetCodes.delete(normalized);
  dbStore.persist();

  res.json({ message: 'Password updated successfully. You may now sign in.' });
});
