# NutriSync API Reference & Cloud Deployment Guide

## 1. Environment Variables (`.env`)

| Variable | Required | Description |
| :--- | :--- | :--- |
| `PORT` | Optional | Server port (defaults to `3000`). |
| `JWT_SECRET` | Recommended | Secret key used to sign HTTP-only session tokens. |
| `GEMINI_API_KEY` | Recommended | Google AI Studio API key for server-side `gemini-3.8-flash` nutrition chat, smart recommendations, meal planning, and multimodal prescription OCR. |
| `VITE_GOOGLE_MAPS_API_KEY` | Recommended | Browser-restricted Google Maps Platform key with **Maps JavaScript API**, **Places API (New)**, and **Routes API** enabled. |
| `MONGODB_URI` | Optional | MongoDB Atlas connection string (`mongodb+srv://...`). Automatically falls back to persistent local store (`server/data/nutrisync_store.json`) if unset. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Optional | Razorpay API credentials. When unset, NutriSync runs in **Server-Verified HMAC-SHA256 Test Sandbox** mode. |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASS` | Optional | SMTP credentials for password reset emails via Nodemailer. |

---

## 2. REST API Endpoint Reference

### Authentication & Sessions (`/api/auth`)
- `POST /api/auth/register` — Register patient, dietitian, chef, or delivery partner (`bcrypt` hashed).
- `POST /api/auth/login` — Authenticate and receive HTTP-only cookie + session token.
- `POST /api/auth/logout` — Clear session cookie.
- `GET /api/auth/me` — Retrieve authenticated user profile.
- `PUT /api/auth/profile` — Update user phone, name, or language (`en` / `hi`).
- `POST /api/auth/forgot-password` — Generate 6-digit password reset code.
- `POST /api/auth/reset-password` — Verify reset code and update password.
- `POST /api/auth/deactivate` — Self-service account deactivation.

### Public Smart Meal Catalogue (`/api`)
- `GET /api/meals` — Filterable catalogue (`category`, `dietaryType`, `maxCalories`, `maxSodium`, `minProtein`, `excludeAllergens`, `search`).
- `GET /api/meals/:id` — Single meal nutritional profile, recipe steps, and published reviews.
- `GET /api/categories` — Clinical meal categories.
- `GET /api/dietitians` — Verified Registered Dietitian directory.
- `POST /api/reviews` — Submit verified patient meal rating & comment.

### Patient Workspace (`/api/patient` — `patient` role)
- `GET /api/patient/dashboard` — Aggregated profile, prescriptions, meal plans, orders, subscriptions, payments, addresses, consultations, and notifications.
- `PUT /api/patient/health-profile` — Update demographics, allergies, intolerances, conditions, and family member profiles.
- `POST /api/patient/prescriptions/upload` — Multipart upload (`PDF`/`JPG`/`JPEG`/`PNG` &le; 5 MB) processed by Gemini Multimodal OCR and routed for Dietitian verification.
- `GET /api/patient/addresses` / `POST /api/patient/addresses` / `DELETE /api/patient/addresses/:id` — Saved delivery coordinates.
- `POST /api/patient/consultations` — Book Registered Dietitian consultation.
- `PUT /api/patient/notifications/read-all` — Mark notifications read.

### Gemini AI Nutrition Engine (`/api/ai` — Authenticated)
- `POST /api/ai/chat` — Conversational nutrition Q&A and smart ingredient swaps grounded in patient caps.
- `POST /api/ai/recommendations` — Deterministic allergen/sodium filtered meals with clinical match explanations.
- `POST /api/ai/meal-planner` — Draft daily or 7-day schedules (`pending_review` until Dietitian approval).

### Registered Dietitian Desk (`/api/dietitian` — `dietitian` / `admin` role)
- `GET /api/dietitian/dashboard` — Authorized patient roster, OCR prescription queue, meal plans, and consultations.
- `PUT /api/dietitian/patients/:patientId/targets` — Approve daily calorie, carb, protein, fat, fiber, and sodium guardrails.
- `PUT /api/dietitian/prescriptions/:id/verify` — Verify or reject uploaded prescriptions with immutable access logs.
- `POST /api/dietitian/meal-plans` — Publish custom clinician-approved meal plan.
- `PUT /api/dietitian/meal-plans/:id/review` — Approve or reject AI draft meal plans.
- `PUT /api/dietitian/consultations/:id` — Record consultation notes and follow-up date.

### Orders, Payments & Subscriptions (`/api`)
- `POST /api/payments/create-session` — Initialize Razorpay order or HMAC-SHA256 sandbox session.
- `POST /api/orders/checkout` — Verify cryptographic signature on server, apply coupons/loyalty points, and dispatch to kitchen.
- `POST /api/subscriptions` / `PUT /api/subscriptions/:id/status` — Create (explicit auto-renew opt-in), pause, resume, or cancel meal subscriptions.

### Kitchen KDS, Delivery & Super Admin (`/api`)
- `GET /api/kitchen/dashboard` — PHI-minimized meal tickets, recipe SOPs, and ingredient stock.
- `PUT /api/kitchen/orders/:id/status` — Enforces 4-point QC checklist before `ready_for_dispatch`.
- `PUT /api/kitchen/inventory/:id` — Update kitchen stock quantities.
- `GET /api/delivery/dashboard` / `PUT /api/delivery/availability` / `PUT /api/delivery/orders/:id/status` — Cold-chain partner workflow.
- `GET /api/admin/dashboard` / `PUT /api/admin/users/:id/status` / `POST /api/admin/meals` / `PUT /api/admin/meals/:id` / `PUT /api/admin/payments/:id/refund` / `PUT /api/admin/reviews/:id/moderate` / `PUT /api/admin/settings` — Super Admin governance & analytics.

---

## 3. Production Deployment Guide

### Option A: Unified Full-Stack Container (Google Cloud Run / Render Web Service)
1. Provision a **MongoDB Atlas** cluster (`M0` or `M10`) and whitelist `0.0.0.0/0` (or VPC egress IPs).
2. Configure environment variables (`MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
3. Build command: `npm install && npm run build`
4. Start command: `npm start` (executes `tsx server.ts`, serving compiled `dist/` static assets, `/api/*`, and Socket.IO WebSockets on `$PORT`).

### Option B: Split Frontend (Vercel) + Backend (Render)
1. Deploy root backend on **Render** with `npm start` and set `CORS` origin to your Vercel domain.
2. Deploy Vite SPA on **Vercel** with `VITE_API_URL=https://<your-render-service>.onrender.com/api` and `VITE_GOOGLE_MAPS_API_KEY`.
3. Restrict `VITE_GOOGLE_MAPS_API_KEY` in Google Cloud Console by HTTP referrer (`https://<your-domain>/*`) and limit APIs strictly to Maps JavaScript API, Places API (New), and Routes API.
