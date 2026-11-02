import { Router, Response } from 'express';
import multer from 'multer';
import { dbStore, PrescriptionRecord } from '../config/store.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { extractPrescriptionWithGeminiOCR } from '../services/aiService.js';
import { emitToRole, emitToUser } from '../sockets/socketHub.js';

export const patientRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB strict limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Only PDF, JPG, JPEG, and PNG files are allowed.'));
    }
  },
});

patientRouter.use(requireAuth, requireRole('patient'));

patientRouter.get('/dashboard', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const profile = dbStore.data.patientProfiles.find((p) => p.userId === userId);
  const prescriptions = dbStore.data.prescriptions.filter((p) => p.patientId === userId);
  const mealPlans = dbStore.data.mealPlans.filter((m) => m.patientId === userId);
  const orders = dbStore.data.orders.filter((o) => o.patientId === userId);
  const subscriptions = dbStore.data.subscriptions.filter((s) => s.patientId === userId);
  const payments = dbStore.data.payments.filter((p) => p.patientId === userId);
  const addresses = dbStore.data.addresses.filter((a) => a.userId === userId);
  const consultations = dbStore.data.consultations.filter((c) => c.patientId === userId);
  const notifications = dbStore.data.notifications.filter((n) => n.userId === userId);
  const user = dbStore.data.users.find((u) => u.id === userId);

  res.json({
    isDemoSeeded: dbStore.data.isDemoSeeded,
    loyaltyPoints: user?.loyaltyPoints ?? 0,
    referralCode: user?.referralCode ?? '',
    profile,
    prescriptions,
    mealPlans,
    orders,
    subscriptions,
    payments,
    addresses,
    consultations,
    notifications,
  });
});

patientRouter.put('/health-profile', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  let profile = dbStore.data.patientProfiles.find((p) => p.userId === userId);
  if (!profile) {
    res.status(404).json({ error: 'Patient profile not found.' });
    return;
  }

  const {
    age,
    gender,
    heightCm,
    weightKg,
    dietaryPreference,
    allergies,
    intolerances,
    medicalConditions,
    assignedDietitianId,
    familyMembers,
    mealRemindersEnabled,
  } = req.body;

  if (age !== undefined) profile.age = Number(age);
  if (gender) profile.gender = gender;
  if (heightCm !== undefined) profile.heightCm = Number(heightCm);
  if (weightKg !== undefined) profile.weightKg = Number(weightKg);
  if (dietaryPreference) profile.dietaryPreference = dietaryPreference;
  if (Array.isArray(allergies)) profile.allergies = allergies.map(String).filter(Boolean);
  if (Array.isArray(intolerances)) profile.intolerances = intolerances.map(String).filter(Boolean);
  if (Array.isArray(medicalConditions)) profile.medicalConditions = medicalConditions.map(String).filter(Boolean);
  if (assignedDietitianId) profile.assignedDietitianId = String(assignedDietitianId);
  if (Array.isArray(familyMembers)) profile.familyMembers = familyMembers;
  if (typeof mealRemindersEnabled === 'boolean') profile.mealRemindersEnabled = mealRemindersEnabled;

  dbStore.addAuditLog({
    actorId: userId,
    actorEmail: req.user!.email,
    actorRole: 'patient',
    action: 'PATIENT_PROFILE_UPDATED',
    resourceType: 'PatientProfile',
    resourceId: userId,
    details: 'Updated personal health demographics, dietary preference, or allergies.',
  });

  dbStore.persist();
  res.json({ profile });
});

patientRouter.post('/favorites/:mealId', (req: AuthenticatedRequest, res: Response) => {
  const mealId = String(req.params.mealId);
  const profile = dbStore.data.patientProfiles.find((p) => p.userId === req.user!.id);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found.' });
    return;
  }
  const idx = profile.favoriteMealIds.indexOf(mealId);
  if (idx >= 0) {
    profile.favoriteMealIds.splice(idx, 1);
  } else {
    profile.favoriteMealIds.push(mealId);
  }
  dbStore.persist();
  res.json({ favoriteMealIds: profile.favoriteMealIds });
});

patientRouter.get('/addresses', (req: AuthenticatedRequest, res: Response) => {
  const addresses = dbStore.data.addresses.filter((a) => a.userId === req.user!.id);
  res.json({ addresses });
});

patientRouter.post('/addresses', (req: AuthenticatedRequest, res: Response) => {
  const { label, recipientName, phone, formattedAddress, landmark = '', postalCode, lat, lng, isDefault } = req.body;
  if (!recipientName || !phone || !formattedAddress || !postalCode) {
    res.status(400).json({ error: 'Recipient name, phone, formatted address, and postal code are required.' });
    return;
  }

  if (isDefault) {
    dbStore.data.addresses
      .filter((a) => a.userId === req.user!.id)
      .forEach((a) => {
        a.isDefault = false;
      });
  }

  const newAddr = {
    id: `addr_${Date.now()}`,
    userId: req.user!.id,
    label: String(label || 'Home'),
    recipientName: String(recipientName),
    phone: String(phone),
    formattedAddress: String(formattedAddress),
    landmark: String(landmark),
    postalCode: String(postalCode),
    lat: Number(lat) || 12.9716,
    lng: Number(lng) || 77.5946,
    isDefault: Boolean(isDefault),
  };

  dbStore.data.addresses.push(newAddr);
  dbStore.persist();
  res.status(201).json({ address: newAddr });
});

patientRouter.delete('/addresses/:id', (req: AuthenticatedRequest, res: Response) => {
  const idx = dbStore.data.addresses.findIndex(
    (a) => a.id === req.params.id && a.userId === req.user!.id
  );
  if (idx < 0) {
    res.status(404).json({ error: 'Address not found.' });
    return;
  }
  dbStore.data.addresses.splice(idx, 1);
  dbStore.persist();
  res.json({ deleted: true });
});

patientRouter.post(
  '/prescriptions/upload',
  (req, res, next) => {
    upload.single('document')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Please select a PDF, JPG, JPEG, or PNG prescription file.' });
        return;
      }

      const { doctorName = '', issuedDate = '' } = req.body as Record<string, string>;
      const base64Data = file.buffer.toString('base64');

      const ocrExtracted = await extractPrescriptionWithGeminiOCR({
        base64Data,
        mimeType: file.mimetype,
        fileName: file.originalname,
      });

      const now = new Date().toISOString();
      const record: PrescriptionRecord = {
        id: `rx_${Date.now()}`,
        patientId: req.user!.id,
        patientName: req.user!.name,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        doctorName: doctorName.trim() || 'Referring Physician',
        issuedDate: issuedDate || now.slice(0, 10),
        ocrExtracted,
        verificationStatus: 'pending_dietitian_review',
        reviewedByDietitianId: null,
        reviewedByDietitianName: null,
        dietitianVerificationNotes: '',
        accessLogs: [
          {
            actorId: req.user!.id,
            actorRole: 'patient',
            action: 'uploaded_and_ocr_extracted',
            timestamp: now,
          },
        ],
        createdAt: now,
      };

      dbStore.data.prescriptions.unshift(record);
      dbStore.addAuditLog({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        actorRole: 'patient',
        action: 'PRESCRIPTION_UPLOADED',
        resourceType: 'Prescription',
        resourceId: record.id,
        details: `Uploaded ${file.originalname} (${file.mimetype}) for Dietitian review`,
      });
      dbStore.persist();

      const profile = dbStore.data.patientProfiles.find((p) => p.userId === req.user!.id);
      if (profile?.assignedDietitianId) {
        const notif = dbStore.addNotification(
          profile.assignedDietitianId,
          'New Prescription Pending Review',
          `${req.user!.name} uploaded ${file.originalname} for clinical verification.`,
          'clinical'
        );
        emitToUser(profile.assignedDietitianId, 'notification:new', notif);
      }
      emitToRole('dietitian', 'prescription:uploaded', { id: record.id, patientName: req.user!.name });

      res.status(201).json({ prescription: record });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Prescription OCR extraction failed.',
      });
    }
  }
);

patientRouter.post('/consultations', (req: AuthenticatedRequest, res: Response) => {
  const { dietitianId, preferredDate, preferredSlot, healthConcern } = req.body as Record<string, string>;
  if (!dietitianId || !preferredDate || !preferredSlot || !healthConcern) {
    res.status(400).json({ error: 'Dietitian, date, time slot, and health concern are required.' });
    return;
  }

  const dietitian = dbStore.data.dietitianProfiles.find((d) => d.userId === dietitianId);
  if (!dietitian) {
    res.status(404).json({ error: 'Selected dietitian not found.' });
    return;
  }

  const consultation = {
    id: `con_${Date.now()}`,
    patientId: req.user!.id,
    patientName: req.user!.name,
    dietitianId: dietitian.userId,
    dietitianName: dietitian.name,
    preferredDate,
    preferredSlot,
    healthConcern: healthConcern.trim(),
    status: 'requested' as const,
    clinicalSummaryNotes: '',
    followUpDate: '',
    createdAt: new Date().toISOString(),
  };

  dbStore.data.consultations.unshift(consultation);
  const notif = dbStore.addNotification(
    dietitian.userId,
    'New Consultation Request',
    `${req.user!.name} requested a consultation on ${preferredDate} (${preferredSlot}).`,
    'clinical'
  );
  emitToUser(dietitian.userId, 'notification:new', notif);
  dbStore.persist();

  res.status(201).json({ consultation });
});

patientRouter.put('/notifications/read-all', (req: AuthenticatedRequest, res: Response) => {
  dbStore.data.notifications
    .filter((n) => n.userId === req.user!.id)
    .forEach((n) => {
      n.isRead = true;
    });
  dbStore.persist();
  res.json({ updated: true });
});
