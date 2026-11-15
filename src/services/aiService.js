/**
 * CareSync AI — AI Service (Gemini API Multimodal Integration & Deterministic Fallbacks)
 * Provides clinical prescription extraction, drug-drug & food-drug interaction guardrails,
 * bilingual voice check-in parsing (English/Hindi), and automated clinical summaries.
 */

import { tokenize } from "./voice/phonetics.js";
import { matchMedication } from "./voice/matcher.js";
import { extractSymptoms, classifyIntents } from "./voice/intent.js";
import { buildSpokenResponse } from "./voice/responses.js";
import {
  evaluateInteractionRules,
  mergeInteractionWarnings,
} from "../utils/interactionRules.js";
import { hasCloudConsent } from "../utils/security.js";

/**
 * Default Gemini model: gemini-2.5-flash.
 * Note: Model names should default to the current stable Flash model on Google's
 * models page (e.g. gemini-2.5-flash or gemini-2.0-flash). Re-check model availability
 * periodically at https://ai.google.dev/models.
 */
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const FALLBACK_GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Safely retrieves Gemini model name (defaults to gemini-3.5-flash).
 * @returns {string}
 */
function getGeminiModel() {
  return DEFAULT_GEMINI_MODEL;
}

/**
 * Calculates a future date in YYYY-MM-DD format.
 * @param {number} daysAhead
 * @returns {string}
 */
function getFutureDate(daysAhead = 14) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Executes a generateContent request through the server-side proxy (/api/gemini).
 * Caps timeout and enforces client-side consent guardrail.
 *
 * @param {string} model
 * @param {object} payload
 * @param {number} [timeoutMs=25000]
 * @returns {Promise<Response>}
 */
export async function callGemini(model, payload, timeoutMs = 25000) {
  // Support legacy 4-argument call (model, apiKey, payload, timeoutMs)
  if (arguments.length >= 3 && typeof payload === "string" && typeof arguments[2] === "object") {
    payload = arguments[2];
    timeoutMs = arguments[3] || 25000;
  }

  // Ensure consent is granted before any cloud call
  if (!hasCloudConsent()) {
    throw new Error(
      "Cloud AI consent has not been granted. Please enable Cloud AI in settings, or use offline mode."
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model, payload }),
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Generates client-side unique identifiers (UUID with fallback).
 * @param {string} prefix
 * @returns {string}
 */
function generateClientId(prefix = "med") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Deterministic fallback payload for prescription parsing & interaction checks.
 * Used EXCLUSIVELY by the "Load Sample Prescription" 1-click demonstration button.
 * Guarantees 100% offline reliability for sample demonstrations.
 */
function getPrescriptionFallback() {
  return {
    extractedMedications: [
      {
        id: generateClientId("med"),
        name: "Atorvastatin",
        genericName: "Atorvastatin Calcium",
        dosage: "20mg",
        dosageExplicit: true,
        frequency: "Once Daily (0-0-1)",
        timeSlots: ["09:00 PM"],
        timeSlotsExplicit: true,
        mealInstruction: "Take after dinner with water",
        mealInstructionExplicit: true,
        pillAppearance: "White Oval Tablet",
        remainingPills: 30,
        remainingPillsExplicit: true,
        takenToday: false,
        lastTakenAt: null,
        interactionWarning: null,
        foodRule:
          "Avoid grapefruit juice; increases muscle toxicity (rhabdomyolysis) risk.",
        sources: {
          name: "extracted",
          dosage: "extracted",
          timeSlots: "extracted",
          remainingPills: "extracted",
          mealInstruction: "extracted",
        },
      },
      {
        id: generateClientId("med"),
        name: "Aspirin",
        genericName: "Acetylsalicylic Acid",
        dosage: "75mg",
        dosageExplicit: true,
        frequency: "Once Daily (0-1-0)",
        timeSlots: ["01:00 PM"],
        timeSlotsExplicit: true,
        mealInstruction: "Take immediately after lunch",
        mealInstructionExplicit: true,
        pillAppearance: "Small Yellow Round Pill",
        remainingPills: 15,
        remainingPillsExplicit: true,
        takenToday: false,
        lastTakenAt: null,
        interactionWarning:
          "SEVERE CONFLICT: Combining Aspirin 75mg with active Warfarin 5mg significantly increases internal bleeding risk.",
        foodRule: "Take with meals to prevent stomach mucosal irritation.",
        sources: {
          name: "extracted",
          dosage: "extracted",
          timeSlots: "extracted",
          remainingPills: "extracted",
          mealInstruction: "extracted",
        },
      },
    ],
    interactionWarnings: [
      {
        id: "rule-warn-bleeding-sample",
        severity: "critical",
        type: "Drug-Drug Interaction",
        drugs: ["Aspirin", "Warfarin"],
        title: "CRITICAL BLEEDING HAZARD",
        warning:
          "Combining anticoagulant (Warfarin) with antiplatelet agent (Aspirin) significantly amplifies major gastrointestinal and systemic bleeding risks.",
        action:
          "Immediate physician review required before co-administering this medication.",
        source: "rule-based",
      },
      {
        id: "rule-warn-grapefruit-sample",
        severity: "warning",
        type: "Food-Drug Interaction",
        drugs: ["Atorvastatin"],
        title: "CYP3A4 FOOD INHIBITION ADVISORY",
        warning:
          "Grapefruit products inhibit hepatic CYP3A4 metabolism, drastically elevating statin systemic concentration and muscle toxicity risk.",
        action:
          "Counsel patient to strictly avoid grapefruit juice while on Atorvastatin therapy.",
        source: "rule-based",
      },
    ],
    extractedAppointment: {
      id: generateClientId("apt"),
      doctorName: "Dr. R. Baruah",
      specialty: "Endocrinology & Lipid Review",
      date: getFutureDate(14),
      dateSource: "extracted",
      time: "11:00 AM",
      location: "Metro Specialty Hospital, Block C-3",
      notes: "Review lipid profile & blood sugar in 2 weeks.",
      reminderSent: false,
    },
  };
}

/**
 * Parses medical prescription data (image or text) and evaluates interactions against active regimen.
 * Supports Multimodal Vision input (base64 image) via Gemini Flash.
 *
 * Grounding & Safety rules:
 * - Real uploads NEVER return fake medicines on failure (throws clear actionable errors).
 * - Fallback payload is permitted ONLY for the sample demonstration button.
 * - Interaction rules run deterministically on top of LLM results.
 * - Always assigns client-side unique IDs.
 * - Appointments are optional and only included if explicitly present in prescription.
 *
 * @param {object|string} fileData - Base64 object ({ base64Data, mimeType }) or text metadata
 * @param {Array} existingMedications - Current medications list in CareContext
 * @param {object} elderProfile - Patient clinical profile
 * @returns {Promise<{ extractedMedications: Array, interactionWarnings: Array, extractedAppointment: object|null }>}
 */
export async function parsePrescriptionAndCheckInteractions(
  fileData,
  existingMedications = [],
  elderProfile = {}
) {
  const isSample = Boolean(
    fileData &&
      (fileData.isSample ||
        fileData.fileName === "Dr_Sharma_Official_Prescription_Cardiology.pdf")
  );

  // If sample button is pressed without cloud consent, return deterministic sample fallback
  if (isSample && !hasCloudConsent()) {
    const fallback = getPrescriptionFallback();
    const ruleWarnings = evaluateInteractionRules(
      fallback.extractedMedications,
      existingMedications,
      elderProfile
    );
    fallback.interactionWarnings = mergeInteractionWarnings(
      fallback.interactionWarnings,
      ruleWarnings
    );
    return fallback;
  }

  // Real upload without consent -> Throw clear error, NEVER return fake medicines
  if (!isSample && !hasCloudConsent()) {
    throw new Error(
      "Cloud AI consent has not been granted. Please enable Cloud AI in settings to analyze real prescription files with Gemini, or enter medications manually."
    );
  }

  try {
    const isMultimodal = Boolean(fileData && fileData.base64Data);

    const prompt = `You are an expert clinical pharmacist and medical OCR specialist analyzing a medical prescription for patient ${
      elderProfile.name || "Patient"
    } (Age: ${elderProfile.age || 74}, Conditions: ${JSON.stringify(
      elderProfile.conditions || []
    )}, Documented Allergies: ${JSON.stringify(elderProfile.allergies || [])}).

Current approved medications already taken by patient:
${JSON.stringify(
  existingMedications.map((m) => ({ name: m.name, dosage: m.dosage }))
)}

${
  isMultimodal
    ? "Carefully inspect and transcribe the doctor's handwriting or printed text from the attached prescription image."
    : "Analyze the provided prescription text and clinical metadata."
}

CRITICAL CLINICAL EXTRACTION & GUARDRAIL INSTRUCTIONS:
1. Extract ALL prescribed medications accurately:
   - name: Exact brand or generic medication name written on the prescription.
   - genericName: Chemical / active ingredient molecule if known, or null.
   - dosage: Specific dosage strength (e.g. "500mg", "20mg", "5mg", "1 puff").
   - dosageExplicit: boolean, true if dosage strength was explicitly written on the prescription; false if assumed.
   - frequency: Exact dosing regimen (e.g. "Once Daily (0-0-1)", "Twice Daily (1-0-1)").
   - timeSlots: Array of scheduled times (e.g. ["08:00 AM"], ["08:00 PM"]).
   - timeSlotsExplicit: boolean, true if schedule times were explicitly indicated; false if defaulted/assumed.
   - mealInstruction: Meal relationship (e.g. "Take after meals", "Take on empty stomach").
   - mealInstructionExplicit: boolean, true if meal instructions were written; false if assumed.
   - pillAppearance: Realistic pill appearance description (e.g. "White round tablet").
   - remainingPills: Number of pills or days prescribed (integer, e.g. 30).
   - remainingPillsExplicit: boolean, true if pill quantity/duration was written; false if assumed.
   - foodRule: Specific dietary precautions (or empty string).

2. Evaluate Interactions & Patient Allergies:
   - Cross-check against current patient medications: ${JSON.stringify(
     existingMedications.map((m) => m.name)
   )} and between newly prescribed medications.
   - Cross-check against documented patient allergies: ${JSON.stringify(
     elderProfile.allergies || []
   )}. Flag any allergic cross-reactivity with severity "critical" and type "Allergy Conflict".
   - Return structured interactionWarnings.

3. Follow-up Doctor Appointment (OPTIONAL):
   - ONLY if the prescription explicitly contains a follow-up review date, next visit, or lab review instruction.
   - If NO follow-up is mentioned, return null for extractedAppointment.
   - If mentioned:
     * doctorName: Doctor name for follow-up.
     * specialty: Clinic name or medical specialty.
     * date: Stated date (YYYY-MM-DD), or null if not stated.
     * dateExplicit: boolean, true if an exact calendar date was written; false if relative/assumed.
     * time: Stated time, or "10:00 AM".
     * location: Hospital or clinic address from prescription header.
     * notes: Follow-up notes or lab investigations requested.

Return STRICT valid JSON ONLY matching:
{
  "extractedMedications": [
    {
      "name": "string",
      "genericName": "string or null",
      "dosage": "string",
      "dosageExplicit": boolean,
      "frequency": "string",
      "timeSlots": ["string"],
      "timeSlotsExplicit": boolean,
      "mealInstruction": "string",
      "mealInstructionExplicit": boolean,
      "pillAppearance": "string",
      "remainingPills": number,
      "remainingPillsExplicit": boolean,
      "foodRule": "string"
    }
  ],
  "interactionWarnings": [
    {
      "severity": "critical" | "warning",
      "type": "Drug-Drug Interaction" | "Food-Drug Interaction" | "Allergy Conflict",
      "drugs": ["string"],
      "title": "string",
      "warning": "string",
      "action": "string"
    }
  ],
  "extractedAppointment": null | {
    "doctorName": "string",
    "specialty": "string",
    "date": "YYYY-MM-DD",
    "dateExplicit": boolean,
    "time": "string",
    "location": "string",
    "notes": "string"
  }
}`;

    const parts = [{ text: prompt }];

    if (isMultimodal) {
      parts.push({
        inlineData: {
          mimeType: fileData.mimeType || "image/jpeg",
          data: fileData.base64Data,
        },
      });
    } else if (fileData) {
      parts.push({
        text: `Prescription text input:\n${
          typeof fileData === "string" ? fileData : JSON.stringify(fileData)
        }`,
      });
    }

    const payload = {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    };

    const primaryModel = getGeminiModel();
    let response;

    try {
      response = await callGemini(primaryModel, payload, 25000);
      if (!response.ok && primaryModel !== FALLBACK_GEMINI_MODEL) {
        response = await callGemini(FALLBACK_GEMINI_MODEL, payload, 20000);
      }
    } catch (err) {
      if (isSample) {
        const fallback = getPrescriptionFallback();
        const ruleWarnings = evaluateInteractionRules(
          fallback.extractedMedications,
          existingMedications,
          elderProfile
        );
        fallback.interactionWarnings = mergeInteractionWarnings(
          fallback.interactionWarnings,
          ruleWarnings
        );
        return fallback;
      }
      throw err;
    }

    if (!response || !response.ok) {
      if (isSample) {
        const fallback = getPrescriptionFallback();
        const ruleWarnings = evaluateInteractionRules(
          fallback.extractedMedications,
          existingMedications,
          elderProfile
        );
        fallback.interactionWarnings = mergeInteractionWarnings(
          fallback.interactionWarnings,
          ruleWarnings
        );
        return fallback;
      }
      const errData = await response.json().catch(() => ({}));
      const errMsg =
        errData?.error?.message ||
        errData?.error ||
        `Google Gemini OCR returned HTTP status ${response?.status || "error"}`;
      throw new Error(errMsg);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed;
    try {
      parsed = JSON.parse(
        rawText.replace(/\`\`\`json/gi, "").replace(/\`\`\`/g, "").trim()
      );
    } catch {
      if (isSample) {
        const fallback = getPrescriptionFallback();
        const ruleWarnings = evaluateInteractionRules(
          fallback.extractedMedications,
          existingMedications,
          elderProfile
        );
        fallback.interactionWarnings = mergeInteractionWarnings(
          fallback.interactionWarnings,
          ruleWarnings
        );
        return fallback;
      }
      throw new Error(
        "Unable to parse prescription details from the uploaded image. Please ensure the document is clear and legible."
      );
    }

    if (
      !parsed ||
      !Array.isArray(parsed.extractedMedications) ||
      parsed.extractedMedications.length === 0
    ) {
      if (isSample) {
        const fallback = getPrescriptionFallback();
        const ruleWarnings = evaluateInteractionRules(
          fallback.extractedMedications,
          existingMedications,
          elderProfile
        );
        fallback.interactionWarnings = mergeInteractionWarnings(
          fallback.interactionWarnings,
          ruleWarnings
        );
        return fallback;
      }
      throw new Error(
        "No medications could be detected in this prescription. Please verify the document is legible, or enter medications manually."
      );
    }

    // Assign client-side unique IDs (Rule 6) and source flags (Rule 4)
    parsed.extractedMedications = parsed.extractedMedications.map((med) => ({
      ...med,
      id: generateClientId("med"),
      remainingPills: Number(med.remainingPills) || 30,
      takenToday: false,
      lastTakenAt: null,
      sources: {
        name: "extracted",
        dosage: med.dosageExplicit !== false ? "extracted" : "assumed",
        timeSlots: med.timeSlotsExplicit !== false ? "extracted" : "assumed",
        remainingPills:
          med.remainingPillsExplicit === true ? "extracted" : "assumed",
        mealInstruction:
          med.mealInstructionExplicit !== false ? "extracted" : "assumed",
      },
    }));

    // Follow-up appointment is optional (Rule 5)
    if (
      parsed.extractedAppointment &&
      (parsed.extractedAppointment.doctorName ||
        parsed.extractedAppointment.notes)
    ) {
      const todayIso = new Date().toISOString().split("T")[0];
      parsed.extractedAppointment = {
        ...parsed.extractedAppointment,
        id: generateClientId("apt"),
        date:
          parsed.extractedAppointment.date &&
          parsed.extractedAppointment.date >= todayIso
            ? parsed.extractedAppointment.date
            : getFutureDate(14),
        dateSource: parsed.extractedAppointment.dateExplicit
          ? "extracted"
          : "assumed",
        time: parsed.extractedAppointment.time || "10:00 AM",
        reminderSent: false,
      };
    } else {
      parsed.extractedAppointment = null;
    }

    // Deterministic Rule-Based Interaction & Allergy Verification (Rule 7)
    const ruleWarnings = evaluateInteractionRules(
      parsed.extractedMedications,
      existingMedications,
      elderProfile
    );

    parsed.interactionWarnings = mergeInteractionWarnings(
      parsed.interactionWarnings || [],
      ruleWarnings
    );

    return parsed;
  } catch (err) {
    if (isSample) {
      const fallback = getPrescriptionFallback();
      const ruleWarnings = evaluateInteractionRules(
        fallback.extractedMedications,
        existingMedications,
        elderProfile
      );
      fallback.interactionWarnings = mergeInteractionWarnings(
        fallback.interactionWarnings,
        ruleWarnings
      );
      return fallback;
    }
    throw err;
  }
}

/**
 * Phonetic normalization map for Indian brand and generic medications.
 * Resolves browser Web Speech API acoustic misrecognitions.
 */
const PHONETIC_MEDICINE_MAP = [
  {
    canonical: "Stamlo",
    variants: [
      "stamplo",
      "stemplo",
      "stampla",
      "templo",
      "temple",
      "stemlo",
      "stamlo",
      "stemplo",
      "tamlo",
      "damlo",
      "templa",
      "stam low",
      "stamilo",
      "stumble",
      "sample",
      "stamford",
      "stepler",
      "stapler",
      "stapler medicine",
      "table medicine",
      "temple medicine",
      "stumble medicine",
      "stand low",
      "stem low",
      // Devanagari Hindi variants
      "स्टेपलर",
      "स्टेप्लर",
      "स्टैम्पलो",
      "स्टेम्पलो",
      "स्टाम्पलो",
      "स्टेपलर मेडिसिन",
      "स्टैमलो",
      "स्टेमलो",
      "स्टामलो",
      "स्टेम्लो",
      "स्टेम लो",
      "टैम्पल",
      "टेम्पल",
      "टैम्पलो",
      "टेम्पलो",
      "टामलो",
      "स्टैमलो दवा",
      "स्टेमलो दवा",
      "स्टामलो दवा",
    ],
  },
  {
    canonical: "Arvast",
    variants: [
      "arvant",
      "arvat",
      "arvast",
      "arwaz",
      "arwast",
      "ervast",
      "alvast",
      "arvan",
      "arvest",
      "harvest",
      "arrived",
      "our past",
      "august",
      "are fast",
      "harvest medicine",
      "arrived medicine",
      "our past medicine",
      "artist medicine",
      "vast medicine",
      "all waste",
      // Devanagari Hindi variants
      "अरवास्ट",
      "अरवांत",
      "अरवास्तव",
      "अरवास्त",
      "अरवत",
      "हार्वेस्ट",
      "अर्वस्त",
      "अरवास्ट दवा",
      "अरवास्त दवा",
    ],
  },
  {
    canonical: "Thyrox",
    variants: [
      "thyrax",
      "thyrox",
      "thyro",
      "thyronorm",
      "thyroxine",
      "tyrox",
      "tirox",
      "thyrocare",
      "thyroid",
      "high rocks",
      "tie rocks",
      "thai rocks",
      "thyroid medicine",
      "high rocks medicine",
      "thyro medicine",
      "thirox",
      "thyroxin",
      // Devanagari Hindi variants
      "थायरॉक्स",
      "थाइरॉक्स",
      "थायरोक्स",
      "थायरो",
      "थायरानॉर्म",
      "थायरॉक्सीन",
      "थाइरोइड",
      "थायरॉइड",
      "थायरोक्सिन",
      "थायरॉक्स दवा",
      "थायरॉक्स मेडिसिन",
      "थाइरॉक्स दवा",
    ],
  },
  {
    canonical: "Bplex Forte",
    variants: [
      "bplex",
      "vplex",
      "b flex",
      "b-plex",
      "bplex forte",
      "b complex",
      "bcomplex",
      "b forte",
      "complex forte",
      "veeplex",
      "bplex fort",
      "vplex fort",
      "b complex forte",
      "bplex fait",
      "complex",
      "reflux",
      "b complex",
      "bplex tablet",
      // Devanagari Hindi variants
      "बीप्लेक्स",
      "बी-प्लेक्स",
      "बीप्लेक्स फोर्ट",
      "बी काम्प्लेक्स",
      "बी कांपलेक्स",
      "कॉम्प्लेक्स",
      "बी काम्पलेक्स फोर्ट",
    ],
  },
  {
    canonical: "Metformin",
    variants: [
      "metformin",
      "glycomet",
      "metfor",
      "formin",
      "met famine",
      "met form in",
      "met form",
      "metfomin",
      // Devanagari Hindi variants
      "मेटफॉर्मिन",
      "मेटफ़ॉर्मिन",
      "मेटफोर्मिन",
      "ग्लाइकोमेट",
      "मेटफॉर्मिन दवा",
    ],
  },
  {
    canonical: "Warfarin",
    variants: [
      "warfarin",
      "coumadin",
      "warfar",
      "warpering",
      "varfarin",
      "warfrin",
      // Devanagari Hindi variants
      "वारफेरिन",
      "वारफारिन",
      "वारफैरिन",
    ],
  },
  {
    canonical: "Atorvastatin",
    variants: [
      "atorvastatin",
      "atorva",
      "ator",
      "atrova",
      "lipitor",
      "atorva statin",
      "atorvastin",
      // Devanagari Hindi variants
      "एटोरवास्टेटिन",
      "एटोरवास्टैटिन",
      "एटोरवा",
      "अटोरवा",
    ],
  },
  {
    canonical: "Aspirin",
    variants: [
      "aspirin",
      "ecosprin",
      "asprin",
      "disprin",
      "aspiran",
      "ecosprin 75",
      // Devanagari Hindi variants
      "एस्पिरिन",
      "एस्प्रिन",
      "इकोस्प्रिन",
    ],
  },
  {
    canonical: "Lisinopril",
    variants: [
      "lisinopril",
      "zestril",
      "prinivil",
      "lisin",
      // Devanagari Hindi variants
      "लिसिनोप्रिल",
    ],
  },
];

/**
 * Intelligent localized parser for elderly voice check-ins.
 * Grounded strictly in active approved medications.
 * 
 * Signature:
 * parseElderVoiceCheckIn(rawTranscript, medications, options = { lang, elderProfile, alternatives, confidence })
 * 
 * @param {string} rawTranscript - Spoken text from SpeechRecognition
 * @param {Array} medications - Active medications list in CareContext
 * @param {object} [options] - Configuration options { lang, elderProfile, alternatives, confidence }
 * @returns {Promise<{
 *   needsConfirmation: boolean,
 *   candidates: Array<{ id: string, name: string }>,
 *   actions: Array<{ type: "mark_taken", medicationId: string }>,
 *   emergency: boolean,
 *   intent: string,
 *   intents: string[],
 *   matchedMedicationId: string | null,
 *   matchedMedicationName: string,
 *   shouldMarkTaken: boolean,
 *   symptomReported: string | null,
 *   severity: string,
 *   spokenResponse: string,
 *   isHindi: boolean,
 *   confidenceTier: string,
 *   timingDetails: object | null,
 *   isScheduleOverview: boolean
 * }>}
 */
export async function parseElderVoiceCheckIn(
  rawTranscript = "",
  medications = [],
  options = {}
) {
  const text = (rawTranscript || "").trim();
  const tokens = tokenize(text);

  // Language selection: options.lang takes precedence; Devanagari script can override
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const lang = hasDevanagari ? "hi-IN" : (options.lang || "en-IN");
  const isHindi = lang.toLowerCase().startsWith("hi");

  // Step 1: Rule-based local intent & symptom extraction (always available, zero-latency)
  const symptomData = extractSymptoms(tokens);
  const intentData = classifyIntents(tokens);
  let finalIntents = [...intentData.intents];

  // Step 2: Medication matching against ONLY the medications argument
  const matchResult = matchMedication(tokens, medications, {
    ...options,
    lang,
  });

  // Step 3: Optional Gemini classification step (classification ONLY, 8s timeout, validated against medications)
  if (hasCloudConsent() && text.length > 2) {
    try {
      const classificationPrompt = {
        contents: [
          {
            parts: [
              {
                text: `You are a clinical speech intent classifier for a 74-year-old patient.
Analyze this spoken transcript: ${JSON.stringify(text)}
Approved patient medications: ${JSON.stringify(medications.map((m) => m.name))}

Return strictly valid JSON with this exact schema (no markdown, no code blocks):
{
  "intents": ["dose_taken" | "inquiry" | "dose_check" | "schedule_overview"],
  "medicineMentions": ["string"],
  "symptoms": ["string"]
}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
        }
      };

      const resp = await callGemini(getGeminiModel(), classificationPrompt, 8000);
      if (resp && resp.ok) {
        const data = await resp.json();
        const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const cleanJson = rawJsonText.replace(/\`\`\`json/gi, "").replace(/\`\`\`/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        if (Array.isArray(parsed.intents) && parsed.intents.length > 0) {
          finalIntents = Array.from(new Set([...finalIntents, ...parsed.intents]));
        }
      }
    } catch {
      // Graceful fallback to rule-based classification on any network error, timeout, or proxy absence
    }
  }

  // Determine actions (only STRONG matches with dose_taken intent may act immediately without confirmation, and only when untaken slots exist)
  const actions = [];
  if (
    matchResult.tier === "STRONG" &&
    !matchResult.needsConfirmation &&
    matchResult.medication &&
    finalIntents.includes("dose_taken")
  ) {
    const med = matchResult.medication;
    const allSlots = Array.isArray(med.timeSlots) && med.timeSlots.length > 0 ? med.timeSlots : ["08:00 AM"];
    const takenSlots = Array.isArray(med.takenSlots) ? med.takenSlots : [];
    const untaken = allSlots.filter((s) => !takenSlots.includes(s));

    if (!med.takenToday && untaken.length > 0) {
      actions.push({
        type: "mark_taken",
        medicationId: med.id,
      });
    }
  }

  // Step 4: Deterministic spoken response constructed strictly from stored medication fields & templates
  const spokenResponse = buildSpokenResponse({
    lang,
    elderProfile: options.elderProfile || {},
    matchedMedication: matchResult.medication,
    unknownName: matchResult.unknownName,
    intents: finalIntents,
    symptomReported: symptomData.symptomReported,
    severity: symptomData.severity,
    emergency: symptomData.emergency,
    needsConfirmation: matchResult.needsConfirmation,
    candidates: matchResult.candidates,
    isGroup: matchResult.isGroup,
    timeOfDay: matchResult.timeOfDay,
    actions,
    medications,
  });

  return {
    needsConfirmation: matchResult.needsConfirmation || matchResult.tier === "MEDIUM",
    candidates: matchResult.candidates || [],
    actions,
    emergency: symptomData.emergency,

    // Preserved fields for backwards compatibility
    intent: finalIntents[0] || "inquiry",
    intents: finalIntents,
    matchedMedicationId: matchResult.medication ? matchResult.medication.id : (matchResult.candidates[0]?.id || null),
    matchedMedicationName: matchResult.medication ? matchResult.medication.name : (matchResult.candidates[0]?.name || ""),
    shouldMarkTaken: actions.length > 0 && !matchResult.needsConfirmation,
    symptomReported: symptomData.symptomReported,
    severity: symptomData.severity,
    spokenResponse,
    isHindi,
    confidenceTier: matchResult.tier,
    timingDetails: matchResult.medication ? {
      timeSlots: matchResult.medication.timeSlots,
      mealInstruction: matchResult.medication.mealInstruction,
      dosage: matchResult.medication.dosage,
    } : null,
    isScheduleOverview: finalIntents.includes("schedule_overview"),
    unknownMedicineMentioned: matchResult.unknownName,
  };
}

/**
 * Parses a slot time string (e.g. "08:00 AM", "06:00 PM") to minutes from midnight.
 * @param {string} slotStr
 * @returns {number}
 */
function parseSlotToMinutesLocal(slotStr) {
  if (!slotStr) return 0;
  const clean = String(slotStr).trim().toUpperCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Calculates medication adherence (doses taken vs doses due) matching CareContext logic.
 * @param {Array} medications
 * @returns {{ adherence: number, dosesTaken: number, dosesDue: number, missedDoses: Array<string> }}
 */
function computeRegimenAdherence(medications = []) {
  if (!medications || medications.length === 0) {
    return { adherence: 100, dosesTaken: 0, dosesDue: 0, missedDoses: [] };
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let dosesDue = 0;
  let dosesTaken = 0;
  const missedDoses = [];

  medications.forEach((med) => {
    const slots =
      Array.isArray(med.timeSlots) && med.timeSlots.length > 0
        ? med.timeSlots
        : ["08:00 AM"];
    const taken = Array.isArray(med.takenSlots) ? med.takenSlots : [];

    slots.forEach((slot) => {
      const slotMin = parseSlotToMinutesLocal(slot);
      if (slotMin <= nowMinutes) {
        dosesDue += 1;
        if (taken.includes(slot)) {
          dosesTaken += 1;
        } else {
          missedDoses.push(`${med.name} (${slot})`);
        }
      }
    });
  });

  const adherence =
    dosesDue === 0 ? 100 : Math.min(100, Math.round((dosesTaken / dosesDue) * 100));

  return { adherence, dosesTaken, dosesDue, missedDoses };
}

/**
 * Builds a deterministic clinical brief derived exclusively from real patient records.
 * Rules:
 * - Zero hallucination of symptoms or vitals (if no symptom logs, says "No symptoms reported").
 * - Adherence strictly reflects real doses taken vs due.
 * - Captures overdose lockout attempts, low-stock drugs with pill counts, and next appointment.
 * - Appends permanent footer: "Generated from app logs — not a medical record."
 *
 * @param {Array} medications
 * @param {Array} logs
 * @param {Array} appointments
 * @param {object} elderProfile
 * @returns {{ shiftHandoverBullets: Array<string>, doctorVisitSummary: object, footer: string }}
 */
function buildDeterministicClinicalBrief(
  medications = [],
  logs = [],
  appointments = [],
  elderProfile = {}
) {
  // 1. Compute adherence strictly matching CareContext formula
  const { adherence, dosesTaken, dosesDue, missedDoses } =
    computeRegimenAdherence(medications);

  const bullet1 =
    dosesDue === 0
      ? `Adherence status: No scheduled doses due yet today (100% adherence rate). Total active medications: ${medications.length}.`
      : `Adherence status: ${dosesTaken} of ${dosesDue} scheduled doses taken today (${adherence}% adherence rate).${
          missedDoses.length > 0
            ? ` Pending or missed: ${missedDoses.join(", ")}.`
            : " All scheduled doses taken on schedule."
        }`;

  // 2. Window logs to the last 14 days (Rule 3)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const recentLogs = (logs || []).filter((log) => {
    if (log.createdAt) {
      const d = new Date(log.createdAt);
      if (!isNaN(d.getTime())) return d >= fourteenDaysAgo;
    }
    if (log.date) {
      const d = new Date(log.date);
      if (!isNaN(d.getTime())) return d >= fourteenDaysAgo;
    }
    return true;
  });

  // Extract voice-reported symptoms (type "voice-symptom" or "voice-emergency")
  const symptomLogs = recentLogs.filter(
    (l) =>
      l.type === "voice-symptom" ||
      l.type === "voice-emergency" ||
      (typeof l.message === "string" &&
        (l.message.toLowerCase().includes("voice-symptom") ||
          l.message.toLowerCase().includes("voice check-in:")))
  );

  const reportedSymptoms = symptomLogs
    .map((l) =>
      (l.message || "")
        .replace(/^Voice Check-In:\s*/i, "")
        .replace(/^CRITICAL EMERGENCY ALERT.*?:\s*/i, "")
        .trim()
    )
    .filter(Boolean);

  // Extract overdose lockout attempts
  const overdoseLogs = recentLogs.filter(
    (l) =>
      l.type === "overdose-attempt" ||
      (typeof l.message === "string" &&
        (l.message.toLowerCase().includes("overdose") ||
          l.message.toLowerCase().includes("double dose")))
  );

  let bullet2 = "";
  if (reportedSymptoms.length > 0) {
    bullet2 = `Clinical observations: Voice-reported symptoms: ${Array.from(
      new Set(reportedSymptoms)
    ).join("; ")}.`;
  } else {
    // Rule 2: Say "No symptoms reported" instead of making one up
    bullet2 = "Clinical observations: No symptoms reported.";
  }

  if (overdoseLogs.length > 0) {
    bullet2 += ` ${overdoseLogs.length} accidental double-dose attempt(s) blocked by system lockout.`;
  }

  // 3. Low-stock medications with names and pill counts
  const lowStock = (medications || []).filter(
    (m) => Number(m.remainingPills) <= 5
  );

  const bullet3 =
    lowStock.length > 0
      ? `Pharmacy inventory: Low refill stock flagged for ${lowStock
          .map((m) => `${m.name} (${m.remainingPills} pills left)`)
          .join(", ")}.`
      : "Pharmacy inventory: Adequate stock across all prescribed medications.";

  // 4. Next appointment (sorted by date >= today, then time)
  const todayStr = getFutureDate(0);
  const upcomingAppointments = (appointments || []).filter(
    (apt) => (apt.date || "") >= todayStr
  );
  upcomingAppointments.sort((a, b) => {
    const dCmp = (a.date || "").localeCompare(b.date || "");
    if (dCmp !== 0) return dCmp;
    return (
      parseSlotToMinutesLocal(a.time || "") -
      parseSlotToMinutesLocal(b.time || "")
    );
  });
  const nextAppointment = upcomingAppointments[0] || null;

  let bullet4 = "Upcoming consultation: No upcoming doctor appointments scheduled.";
  if (nextAppointment) {
    const rawDoc = (nextAppointment.doctorName || "Doctor").trim();
    const docLabel = /^Dr\.?\s+/i.test(rawDoc) ? rawDoc : `Dr. ${rawDoc}`;
    bullet4 = `Upcoming consultation: ${docLabel} (${
      nextAppointment.specialty || "Review"
    }) on ${nextAppointment.date} at ${nextAppointment.time || "10:00 AM"}.`;
  }

  // Active interaction warnings from medications
  const activeInteractions = (medications || [])
    .filter((m) => Boolean(m.interactionWarning))
    .map((m) => `${m.name}: ${m.interactionWarning}`);

  // Rule 5: Permanent footer line
  const footerLine = "Generated from app logs — not a medical record.";

  const doctorVisitSummary = {
    adherenceRate: adherence,
    criticalAlerts:
      overdoseLogs.length > 0
        ? `${overdoseLogs.length} accidental double-dose attempt(s) prevented by lockout.`
        : "No accidental overdose attempts or critical lockouts recorded.",
    activeInteractions:
      activeInteractions.length > 0
        ? activeInteractions.join("; ")
        : "No active critical drug interactions flagged in current regimen.",
    symptomTimeline:
      reportedSymptoms.length > 0
        ? `Recent reported symptoms: ${Array.from(
            new Set(reportedSymptoms)
          ).join("; ")}.`
        : "No symptoms reported.",
    recommendation:
      lowStock.length > 0
        ? `Authorize pharmacy refill for ${lowStock
            .map((m) => m.name)
            .join(", ")}; review routine adherence at next visit.`
        : "Continue current regimen; review routine adherence and vitals at next visit.",
    footer: footerLine,
  };

  return {
    shiftHandoverBullets: [bullet1, bullet2, bullet3, bullet4],
    doctorVisitSummary,
    footer: footerLine,
  };
}

/**
 * Validates the structure and keys of the LLM-generated brief.
 * @param {object} obj
 * @returns {boolean}
 */
function isValidBriefShape(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (
    !Array.isArray(obj.shiftHandoverBullets) ||
    obj.shiftHandoverBullets.length !== 4
  ) {
    return false;
  }
  if (
    !obj.shiftHandoverBullets.every(
      (b) => typeof b === "string" && b.trim().length > 0
    )
  ) {
    return false;
  }
  const summary = obj.doctorVisitSummary;
  if (!summary || typeof summary !== "object") return false;
  const requiredKeys = [
    "adherenceRate",
    "criticalAlerts",
    "activeInteractions",
    "symptomTimeline",
    "recommendation",
  ];
  return requiredKeys.every(
    (k) => k in summary && summary[k] !== undefined && summary[k] !== null
  );
}

/**
 * Generates an automated clinical brief including a 12-hour caretaker shift handover
 * and a structured doctor visit summary.
 *
 * Rules:
 * - Deterministic brief computed from real medications, logs, and appointments.
 * - Adherence strictly equals real doses taken vs due.
 * - If no symptom logs exist, states "No symptoms reported" (no invented dizziness).
 * - Brief window uses logs from the last 14 days, trimmed for prompt fitting.
 * - Gemini may only rephrase verified facts; validated against exact schema shape.
 * - Appends permanent footer: "Generated from app logs — not a medical record."
 *
 * @param {Array} medications - Regimen
 * @param {Array} logs - Audit trail
 * @param {Array} appointments - Consultation calendar
 * @param {object} elderProfile - Patient profile
 * @returns {Promise<{ shiftHandoverBullets: Array<string>, doctorVisitSummary: object, footer: string }>}
 */
export async function generateClinicalBrief(
  medications = [],
  logs = [],
  appointments = [],
  elderProfile = {}
) {
  // Always compute deterministic brief from real clinical facts
  const deterministicBrief = buildDeterministicClinicalBrief(
    medications,
    logs,
    appointments,
    elderProfile
  );

  if (!hasCloudConsent()) {
    return deterministicBrief;
  }

  try {
    // Window logs to last 14 days and trim to max 50 for prompt fitting
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const recentLogs = (logs || [])
      .filter((log) => {
        if (log.createdAt) {
          const d = new Date(log.createdAt);
          if (!isNaN(d.getTime())) return d >= fourteenDaysAgo;
        }
        if (log.date) {
          const d = new Date(log.date);
          if (!isNaN(d.getTime())) return d >= fourteenDaysAgo;
        }
        return true;
      })
      .slice(0, 50);

    const prompt = `You are a clinical documentation assistant for patient ${
      elderProfile.name || "Patient"
    }.
Rephrase the following verified facts into professional clinical handover language.
You must ONLY rephrase the verified facts below. DO NOT invent any symptoms, times, dates, vitals, or clinical events that are not explicitly stated.
If symptoms state "No symptoms reported", you MUST state "No symptoms reported".

Verified Clinical Facts:
- Adherence: ${deterministicBrief.shiftHandoverBullets[0]}
- Symptoms & Observations: ${deterministicBrief.shiftHandoverBullets[1]}
- Inventory & Stock: ${deterministicBrief.shiftHandoverBullets[2]}
- Upcoming Consultations: ${deterministicBrief.shiftHandoverBullets[3]}
- Doctor Review Summary: ${JSON.stringify(deterministicBrief.doctorVisitSummary)}
- Recent Logs (last 14 days, max 50): ${JSON.stringify(recentLogs)}

Return STRICT valid JSON ONLY matching this exact shape (exactly 4 bullet strings and all summary keys):
{
  "shiftHandoverBullets": [
    "Bullet 1: Adherence status (${deterministicBrief.doctorVisitSummary.adherenceRate}% adherence rate, taken vs due)",
    "Bullet 2: Clinical observations & symptoms (if none, state 'No symptoms reported')",
    "Bullet 3: Pharmacy inventory & refills",
    "Bullet 4: Upcoming appointments or next actions"
  ],
  "doctorVisitSummary": {
    "adherenceRate": ${deterministicBrief.doctorVisitSummary.adherenceRate},
    "criticalAlerts": "string",
    "activeInteractions": "string",
    "symptomTimeline": "string",
    "recommendation": "string"
  }
}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    };

    const primaryModel = getGeminiModel();
    let response;
    try {
      response = await callGemini(primaryModel, payload, 8000);
      if (!response.ok && primaryModel !== FALLBACK_GEMINI_MODEL) {
        response = await callGemini(FALLBACK_GEMINI_MODEL, payload, 6000);
      }
    } catch {
      if (primaryModel !== FALLBACK_GEMINI_MODEL) {
        try {
          response = await callGemini(FALLBACK_GEMINI_MODEL, payload, 6000);
        } catch {
          return deterministicBrief;
        }
      } else {
        return deterministicBrief;
      }
    }

    if (!response || !response.ok) return deterministicBrief;

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanJson = rawText
      .replace(/\`\`\`json/gi, "")
      .replace(/\`\`\`/g, "")
      .trim();
    const parsed = JSON.parse(cleanJson);

    // Rule 4: Validate JSON shape (4 bullets, all summary keys); if invalid, use deterministic brief
    if (!isValidBriefShape(parsed)) {
      return deterministicBrief;
    }

    // Enforce computed adherenceRate and footer line
    parsed.doctorVisitSummary.adherenceRate =
      deterministicBrief.doctorVisitSummary.adherenceRate;
    parsed.doctorVisitSummary.footer = deterministicBrief.footer;
    parsed.footer = deterministicBrief.footer;

    return parsed;
  } catch {
    return deterministicBrief;
  }
}
