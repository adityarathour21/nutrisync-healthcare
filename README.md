# NutriSync — AI-Powered Personalized Nutrition & Smart Meal Delivery Platform

> *"Your Health. Your Nutrition. Your Personalized Plate."*

NutriSync is a production-style full-stack healthcare nutrition and clinical meal delivery platform connecting **Patients**, **Registered Dietitians**, **Clinical Chefs**, **Cold-Chain Delivery Partners**, and **Super Administrators**.

Designed for individuals managing **Type 2 Diabetes**, **Hypertension (Low-Sodium)**, **Thyroid Disorders**, **Weight Management**, and **Strict Food Allergies**, NutriSync enforces clinician-in-the-loop governance over AI recommendations, multimodal prescription OCR, allergen-segregated kitchen workflows, cryptographic payment verification, and live Google Maps dispatch routing.

---

## 1. Pre-Seeded Demo Accounts (Instant 1-Click Evaluation)

All five role-based workspaces are pre-seeded and accessible from the **Sign In (`/login`)** page or the sidebar **Switch Demo Workspace** widget:

| Role | Demo Email | Password | Primary Route |
| :--- | :--- | :--- | :--- |
| **Patient / Customer** | `patient@nutrisync.demo` | `Demo@1234` | `/portal/patient` |
| **Registered Dietitian** | `dietitian@nutrisync.demo` | `Demo@1234` | `/portal/dietitian` |
| **Chef / Kitchen KDS** | `chef@nutrisync.demo` | `Demo@1234` | `/portal/kitchen` |
| **Delivery Partner** | `delivery@nutrisync.demo` | `Demo@1234` | `/portal/delivery` |
| **Super Admin** | `admin@nutrisync.demo` | `Demo@1234` | `/portal/admin` |

**Test Promo Codes at Checkout:** `FIRSTHEALTH15` (15% off up to ₹180) · `CARE10` (10% off up to ₹120)

---

## 2. Core Platform Capabilities & Medical Safety Governance

### Clinical & AI Safety Controls
1. **Zero Autonomous Medical Diagnosis**: Powered by `@google/genai` (`gemini-3.8-flash`) strictly on the backend, NutriSync AI never diagnoses diseases, prescribes treatments, or modifies medications.
2. **Deterministic Allergen & Sodium Hard-Filtering**: Before Gemini ranks or explains meals, `filterSafeMealsForPatient()` deterministically excludes any meal containing declared patient allergens or restricted ingredients.
3. **Clinician-Gated Prescriptions & Meal Plans**:
   - Multimodal Prescription OCR (`PDF`, `JPG`, `JPEG`, `PNG` &le; 5 MB) extracts structured dietary guidance and highlights uncertain/illegible fields in amber. Raw OCR output is **never** treated as an active prescription until verified by an assigned Registered Dietitian.
   - AI Draft Meal Plans (`daily` / `weekly`) calculate exact macro and sodium totals from verified catalogue entries and remain in `pending_review` until Dietitian approval.
4. **PHI Data Minimization for Kitchens & Drivers**:
   - **Kitchen Display System (`/api/kitchen/dashboard`)** strips patient names, medical conditions, prescriptions, emails, and drop-off addresses—exposing only order numbers, scheduled slots, weighed portions, and prominent allergen alerts, gated by a mandatory 4-point Quality Control checklist.
   - **Delivery Partner Portal (`/api/delivery/dashboard`)** exposes pickup/drop-off coordinates and recipient contact details with zero medical information.

### Full-Stack Architecture
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, Motion, Recharts, Lucide Icons, `@vis.gl/react-google-maps` (Places Autocomplete + Routes API `Route.computeRoutes()`), `socket.io-client`, and full PWA installability (`vite-plugin-pwa`).
- **Backend**: Node.js, Express, Socket.IO (JWT-authenticated room isolation), Mongoose (23 MongoDB schemas in `server/src/models/schemas.ts`) + resilient JSON persistence fallback (`server/data/nutrisync_store.json`), `bcryptjs`, `jsonwebtoken` HTTP-only cookies + Bearer fallback, `helmet`, `express-rate-limit`, `multer`, `razorpay` HMAC-SHA256 verification, and `nodemailer`.

---

## 3. Local Development Setup (Windows PowerShell & macOS/Linux)

### Prerequisites
- **Node.js** `v20+` and **npm** `v10+`
- Optional API keys (see `.env.example` — the platform starts safely and runs end-to-end even when optional credentials like `MONGODB_URI`, `RAZORPAY_KEY_ID`, or `EMAIL_HOST` are omitted).

### Windows PowerShell Commands
```powershell
# 1. Clone repository and enter project root
git clone <your-repo-url> nutrisync
Set-Location nutrisync

# 2. Install dependencies
npm install

# 3. Copy environment template and add your keys
Copy-Item .env.example .env

# 4. (Optional) Re-seed demo accounts and verified clinical meals
npm run seed

# 5. Start full-stack Express + Socket.IO + Vite server on http://localhost:3000
npm run dev
```

### Automated Backend Test Suite
```powershell
# Runs Vitest + Supertest covering Auth, RBAC, PHI Kitchen Minimization, QC Gates, and HMAC Payment Security
npm test
```

### Production Build & Start
```powershell
npm run build
npm start
```

See [`docs/API_AND_DEPLOYMENT.md`](./docs/API_AND_DEPLOYMENT.md) for the complete REST API reference, environment variable guide, and MongoDB Atlas / Render / Vercel deployment instructions.
