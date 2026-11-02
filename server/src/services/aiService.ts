import { GoogleGenAI, Type } from '@google/genai';
import { MealRecord, PatientProfileRecord } from '../config/store.js';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const MEDICAL_SAFETY_SYSTEM_PROMPT = `You are the NutriSync Clinical Nutrition Assistant.
STRICT MEDICAL SAFETY RULES (NON-NEGOTIABLE):
1. NEVER diagnose diseases, prescribe medical treatments, alter medication dosages, or advise stopping any prescribed medication.
2. NEVER override clinician-approved nutritional limits (daily calories, max carbohydrates, max sodium, restricted ingredients) or documented food allergies/intolerances.
3. All meal recommendations MUST come strictly from the verified NutriSync meal catalogue provided in context and MUST respect the patient's allergies and dietary preference.
4. Any AI-generated meal plan is strictly a DRAFT suggestion and MUST be reviewed and approved by a Certified Dietitian before medical activation.
5. Keep explanations clear, empathetic, evidence-informed, and concise.`;

export function filterSafeMealsForPatient(meals: MealRecord[], profile?: PatientProfileRecord): MealRecord[] {
  return meals.filter((meal) => {
    if (!meal.isAvailable || meal.nutritionalVerificationStatus !== 'verified') return false;
    if (!profile) return true;

    // 1. Dietary preference enforcement
    if (profile.dietaryPreference === 'vegan' && meal.dietaryType !== 'vegan') return false;
    if (profile.dietaryPreference === 'vegetarian' && meal.dietaryType === 'non_vegetarian') return false;

    // 2. Hard allergy & restricted ingredient exclusion
    const blockedTerms = [
      ...profile.allergies,
      ...profile.intolerances,
      ...(profile.approvedTargets?.restrictedIngredients || []),
    ].map((t) => t.toLowerCase().trim()).filter(Boolean);

    const mealText = [
      ...meal.allergens,
      ...meal.ingredients,
      meal.name,
    ].map((t) => t.toLowerCase());

    for (const blocked of blockedTerms) {
      if (mealText.some((item) => item.includes(blocked))) {
        return false;
      }
    }

    // 3. Per-meal proportion check against approved daily caps (single meal <= 45% of daily sodium/carbs cap)
    if (profile.approvedTargets) {
      if (meal.sodium > profile.approvedTargets.maxSodiumMg * 0.45) return false;
      if (meal.carbs > profile.approvedTargets.maxCarbsGrams * 0.45) return false;
    }

    return true;
  });
}

export async function askNutritionAssistant(params: {
  question: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
  profile?: PatientProfileRecord;
  safeMeals: MealRecord[];
}): Promise<{ reply: string; suggestedSubstitutions: string[]; safetyDisclaimer: string }> {
  const ai = getGeminiClient();
  const safetyDisclaimer =
    'General nutrition guidance only — not a medical diagnosis or prescription. Always follow your physician and Registered Dietitian’s approved plan.';

  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please attach a valid Gemini API key in Settings > Secrets.'
    );
  }

  const profileContext = params.profile
    ? `Patient Approved Profile:
- Dietary Preference: ${params.profile.dietaryPreference}
- Allergies (STRICT EXCLUDE): ${params.profile.allergies.join(', ') || 'None'}
- Intolerances: ${params.profile.intolerances.join(', ') || 'None'}
- Self-Reported Conditions: ${params.profile.medicalConditions.join(', ') || 'None'}
- Dietitian-Approved Daily Targets: ${params.profile.approvedTargets.dailyCalories} kcal, Max Carbs ${params.profile.approvedTargets.maxCarbsGrams}g, Min Protein ${params.profile.approvedTargets.minProteinGrams}g, Max Sodium ${params.profile.approvedTargets.maxSodiumMg}mg.`
    : 'Guest user without a linked clinical profile.';

  const catalogueContext = params.safeMeals
    .map(
      (m) =>
        `- ${m.name} (${m.calories} kcal, P:${m.protein}g, C:${m.carbs}g, F:${m.fat}g, Fiber:${m.fiber}g, Na:${m.sodium}mg, Allergens: ${m.allergens.join(', ') || 'None'})`
    )
    .join('\n');

  const historyContext = (params.history || [])
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'Patient' : 'Assistant'}: ${h.text}`)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: `${profileContext}

Verified Safe NutriSync Catalogue Meals for this user:
${catalogueContext}

Recent Conversation:
${historyContext}

Patient Question: ${params.question}`,
    config: {
      systemInstruction: MEDICAL_SAFETY_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: 'Helpful, medically safe answer tailored to approved limits and verified meals.',
          },
          suggestedSubstitutions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2 to 4 practical smart ingredient substitutions respecting allergies and sodium/glycemic goals.',
          },
        },
        required: ['reply', 'suggestedSubstitutions'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    reply?: string;
    suggestedSubstitutions?: string[];
  };

  return {
    reply: parsed.reply || 'Unable to generate nutrition guidance right now.',
    suggestedSubstitutions: parsed.suggestedSubstitutions || [],
    safetyDisclaimer,
  };
}

export async function generateSmartRecommendations(params: {
  profile: PatientProfileRecord;
  safeMeals: MealRecord[];
}): Promise<
  {
    mealId: string;
    matchScore: number;
    clinicalReason: string;
    nutrientHighlights: string[];
  }[]
> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please attach a valid Gemini API key in Settings > Secrets.'
    );
  }

  if (params.safeMeals.length === 0) {
    return [];
  }

  const mealsPayload = params.safeMeals.map((m) => ({
    id: m.id,
    name: m.name,
    dietaryType: m.dietaryType,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    fiber: m.fiber,
    sodium: m.sodium,
    suitableLabels: m.suitableLabels,
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: `Analyze this patient's Dietitian-Approved Nutrition Profile and explain why each pre-filtered safe meal matches their targets.
Patient Profile:
- Preference: ${params.profile.dietaryPreference}
- Allergies Excluded: ${params.profile.allergies.join(', ') || 'None'}
- Conditions: ${params.profile.medicalConditions.join(', ') || 'General Wellness'}
- Approved Targets: ${params.profile.approvedTargets.dailyCalories} kcal/day, Max Carbs ${params.profile.approvedTargets.maxCarbsGrams}g, Min Protein ${params.profile.approvedTargets.minProteinGrams}g, Max Sodium ${params.profile.approvedTargets.maxSodiumMg}mg, Min Fiber ${params.profile.approvedTargets.minFiberGrams}g.

Verified Safe Meals:
${JSON.stringify(mealsPayload, null, 2)}`,
    config: {
      systemInstruction: MEDICAL_SAFETY_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            mealId: { type: Type.STRING },
            matchScore: { type: Type.INTEGER, description: 'Compatibility score between 80 and 99' },
            clinicalReason: {
              type: Type.STRING,
              description: '1-2 sentence explanation referencing exact protein, fiber, carbs, or sodium numbers vs approved limits.',
            },
            nutrientHighlights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['mealId', 'matchScore', 'clinicalReason', 'nutrientHighlights'],
        },
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '[]').trim());
  return Array.isArray(parsed) ? parsed : [];
}

export async function generateDraftMealPlan(params: {
  profile: PatientProfileRecord;
  safeMeals: MealRecord[];
  durationType: 'daily' | 'weekly';
}): Promise<{
  title: string;
  clinicalRationale: string;
  days: {
    dayLabel: string;
    breakfastMealId: string;
    lunchMealId: string;
    snackMealId: string;
    dinnerMealId: string;
  }[];
}> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please attach a valid Gemini API key in Settings > Secrets.'
    );
  }

  const dayCount = params.durationType === 'weekly' ? 7 : 1;
  const mealSummary = params.safeMeals.map((m) => ({
    id: m.id,
    name: m.name,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    fiber: m.fiber,
    sodium: m.sodium,
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: `Create a ${dayCount}-day DRAFT meal plan strictly selecting meal IDs from the Verified Safe Meals list below.
Target Daily Totals: ~${params.profile.approvedTargets.dailyCalories} kcal, <=${params.profile.approvedTargets.maxSodiumMg}mg sodium, <=${params.profile.approvedTargets.maxCarbsGrams}g carbs, >=${params.profile.approvedTargets.minProteinGrams}g protein.
Verified Safe Meals:
${JSON.stringify(mealSummary)}`,
    config: {
      systemInstruction: MEDICAL_SAFETY_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          clinicalRationale: { type: Type.STRING },
          days: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                dayLabel: { type: Type.STRING },
                breakfastMealId: { type: Type.STRING },
                lunchMealId: { type: Type.STRING },
                snackMealId: { type: Type.STRING },
                dinnerMealId: { type: Type.STRING },
              },
              required: ['dayLabel', 'breakfastMealId', 'lunchMealId', 'snackMealId', 'dinnerMealId'],
            },
          },
        },
        required: ['title', 'clinicalRationale', 'days'],
      },
    },
  });

  return JSON.parse((response.text ?? '{}').trim());
}

export async function extractPrescriptionWithGeminiOCR(params: {
  base64Data: string;
  mimeType: string;
  fileName: string;
}): Promise<{
  rawSummary: string;
  identifiedConditions: string[];
  dietaryInstructions: string[];
  potentialAllergies: string[];
  medicationsNotedForContext: string[];
  uncertainOrUnreadableFields: string[];
  confidenceNote: string;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please attach a valid Gemini API key in Settings > Secrets.'
    );
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType,
            data: params.base64Data,
          },
        },
        {
          text: `Perform clinical document OCR extraction on this uploaded dietary/medical prescription (${params.fileName}).
Organize all readable dietary guidance, noted medical conditions, potential food allergies/restrictions, and explicitly flag any uncertain, blurry, abbreviated, or unreadable fields so a Registered Dietitian can verify them before activation.
Never invent instructions that are not present in the document.`,
        },
      ],
    },
    config: {
      systemInstruction: MEDICAL_SAFETY_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rawSummary: { type: Type.STRING },
          identifiedConditions: { type: Type.ARRAY, items: { type: Type.STRING } },
          dietaryInstructions: { type: Type.ARRAY, items: { type: Type.STRING } },
          potentialAllergies: { type: Type.ARRAY, items: { type: Type.STRING } },
          medicationsNotedForContext: { type: Type.ARRAY, items: { type: Type.STRING } },
          uncertainOrUnreadableFields: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidenceNote: { type: Type.STRING },
        },
        required: [
          'rawSummary',
          'identifiedConditions',
          'dietaryInstructions',
          'potentialAllergies',
          'medicationsNotedForContext',
          'uncertainOrUnreadableFields',
          'confidenceNote',
        ],
      },
    },
  });

  return JSON.parse((response.text ?? '{}').trim());
}
