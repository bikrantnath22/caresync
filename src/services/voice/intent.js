/**
 * CareSync AI — Voice Intent & Clinical Symptom Classification Module
 * Identifies speech intents (dose taken, schedule inquiry, dose-check, schedule overview)
 * and classifies symptoms with negation handling and clinical severity triage.
 * 
 * Rules:
 * - Support multiple intents in one sentence (e.g. "I took Stamlo, when do I take Thyrox?").
 * - Negation: symptom word preceded within 3 tokens by no/not/without/nahi/नहीं/nahin is NOT reported.
 * - Negation covers English, Hindi (Devanagari), and Hinglish.
 * - Emergency symptoms vs High symptoms with clinical triage.
 */

/* Clinical wording must be reviewed by a doctor */

// Negation indicator tokens across English, Hindi, and Hinglish
const NEGATION_TOKENS = new Set([
  "no",
  "not",
  "without",
  "never",
  "nahi",
  "nahin",
  "na",
  "bina",
  "नहीं",
  "ना",
  "बिना",
  "बगैर",
]);

// Clinical Emergency Symptom Signatures (Triage Level: EMERGENCY)
const EMERGENCY_SYMPTOMS = [
  {
    name: "chest pain",
    tokens: [
      ["chest", "pain"],
      ["heart", "pain"],
      ["pressure", "in", "chest"],
      ["seene", "me", "dard"],
      ["chhati", "me", "dard"],
      ["सीने", "में", "दर्द"],
      ["छाती", "में", "दर्द"],
    ],
  },
  {
    name: "breathlessness / difficulty breathing",
    tokens: [
      ["breathlessness"],
      ["breathless"],
      ["shortness", "of", "breath"],
      ["difficulty", "breathing"],
      ["cant", "breathe"],
      ["saans", "lene", "me", "takleef"],
      ["saans", "phoolna"],
      ["सांस", "लेने", "में", "तकलीफ"],
      ["सांस", "फूलना"],
    ],
  },
  {
    name: "fainting / loss of consciousness",
    tokens: [
      ["fainted"],
      ["fainting"],
      ["unconscious"],
      ["passed", "out"],
      ["behosh"],
      ["behoshi"],
      ["बेहोश"],
      ["बेहोशी"],
    ],
  },
  {
    name: "bleeding / blood in vomit or stool",
    tokens: [
      ["bleeding"],
      ["blood", "in", "vomit"],
      ["blood", "in", "stool"],
      ["black", "stool"],
      ["khoon", "aana"],
      ["ulti", "me", "khoon"],
      ["खून", "बहना"],
      ["उल्टी", "में", "खून"],
      ["मल", "में", "खून"],
      ["काला", "मल"],
    ],
  },
  {
    name: "slurred speech / face drooping",
    tokens: [
      ["slurred", "speech"],
      ["face", "drooping"],
      ["ladkhadati", "aawaz"],
      ["लड़खड़ाती", "आवाज"],
      ["चेहरा", "लटकना"],
    ],
  },
  {
    name: "sudden severe headache",
    tokens: [
      ["severe", "headache"],
      ["sudden", "headache"],
      ["tez", "sirdard"],
      ["तेज", "सिरदर्द"],
    ],
  },
];

// Clinical High Priority Symptoms (Triage Level: HIGH)
const HIGH_SYMPTOMS = [
  {
    name: "mild dizziness",
    tokens: [
      ["dizziness"],
      ["dizzy"],
      ["lightheaded"],
      ["chakkar"],
      ["चक्कर"],
    ],
  },
  {
    name: "weakness / fatigue",
    tokens: [
      ["weakness"],
      ["weak"],
      ["exhausted"],
      ["kamzori"],
      ["kamzor"],
      ["कमजोरी"],
      ["कमज़ोरी"],
    ],
  },
  {
    name: "nausea / vomiting",
    tokens: [
      ["nausea"],
      ["nauseous"],
      ["vomiting"],
      ["vomit"],
      ["matli"],
      ["ulti"],
      ["उल्टी"],
      ["जी", "मिचलाना"],
    ],
  },
  {
    name: "physical pain / discomfort",
    tokens: [
      ["pain"],
      ["body", "ache"],
      ["dard"],
      ["दर्द"],
      ["बदन", "दर्द"],
    ],
  },
];

/**
 * Extracts and triages clinical symptoms taking into account 3-token preceding negation.
 * 
 * @param {string[]} tokens - Tokenized words
 * @returns {{
 *   symptomReported: string | null,
 *   severity: "emergency" | "high" | "normal",
 *   emergency: boolean
 * }}
 */
export function extractSymptoms(tokens = []) {
  if (!tokens || tokens.length === 0) {
    return { symptomReported: null, severity: "normal", emergency: false };
  }

  // Helper: checks if index idx is preceded within 3 tokens by any negation token
  function isNegated(idx) {
    const start = Math.max(0, idx - 3);
    for (let i = start; i < idx; i++) {
      if (NEGATION_TOKENS.has(tokens[i])) {
        return true;
      }
    }
    return false;
  }

  // 1. Check for EMERGENCY symptoms first
  for (const symptom of EMERGENCY_SYMPTOMS) {
    for (const phraseTokens of symptom.tokens) {
      for (let i = 0; i <= tokens.length - phraseTokens.length; i++) {
        let match = true;
        for (let j = 0; j < phraseTokens.length; j++) {
          if (tokens[i + j] !== phraseTokens[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          if (!isNegated(i)) {
            return {
              symptomReported: symptom.name,
              severity: "emergency",
              emergency: true,
            };
          }
        }
      }
    }
  }

  // 2. Check for HIGH symptoms
  for (const symptom of HIGH_SYMPTOMS) {
    for (const phraseTokens of symptom.tokens) {
      for (let i = 0; i <= tokens.length - phraseTokens.length; i++) {
        let match = true;
        for (let j = 0; j < phraseTokens.length; j++) {
          if (tokens[i + j] !== phraseTokens[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          if (!isNegated(i)) {
            return {
              symptomReported: symptom.name,
              severity: "high",
              emergency: false,
            };
          }
        }
      }
    }
  }

  return { symptomReported: null, severity: "normal", emergency: false };
}

/**
 * Classifies all speech intents present in the transcript.
 * Supports multiple intents in a single sentence.
 * 
 * @param {string[]} tokens - Tokenized words
 * @returns {{
 *   intents: Array<"dose_taken" | "inquiry" | "dose_check" | "schedule_overview" | "symptom">,
 *   isDoseCheck: boolean,
 *   isScheduleOverview: boolean,
 *   isInquiry: boolean,
 *   isDoseTaken: boolean
 * }}
 */
export function classifyIntents(tokens = []) {
  const tokenSet = new Set(tokens);
  const intents = [];

  // Check for Dose-Check ("can I take another", "take one more", "second dose")
  const hasCanITake =
    (tokenSet.has("can") && tokenSet.has("take")) ||
    (tokenSet.has("should") && tokenSet.has("take")) ||
    (tokenSet.has("kya") && (tokenSet.has("le") || tokenSet.has("lu"))) ||
    (tokenSet.has("क्या") && tokenSet.has("ले"));

  const hasAnother =
    tokenSet.has("another") ||
    tokenSet.has("more") ||
    tokenSet.has("second") ||
    tokenSet.has("extra") ||
    tokenSet.has("aur") ||
    tokenSet.has("dusra") ||
    tokenSet.has("दूसरी") ||
    tokenSet.has("और");

  const isDoseCheck = hasCanITake && hasAnother;
  if (isDoseCheck) {
    intents.push("dose_check");
  }

  // Check for Schedule Overview ("my schedule", "what do I take", "all medicines")
  const hasSchedule =
    tokenSet.has("schedule") ||
    tokenSet.has("overview") ||
    tokenSet.has("list") ||
    tokenSet.has("time-table") ||
    tokenSet.has("timetable") ||
    tokenSet.has("शेड्यूल") ||
    tokenSet.has("समय") ||
    tokenSet.has("सूची");

  const isScheduleOverview =
    (hasSchedule && (tokenSet.has("my") || tokenSet.has("all") || tokenSet.has("today") || tokenSet.has("mera") || tokenSet.has("mera") || tokenSet.has("मेरा") || tokenSet.has("आज"))) ||
    (tokenSet.has("what") && tokenSet.has("take") && tokenSet.has("today"));

  if (isScheduleOverview) {
    intents.push("schedule_overview");
  }

  // Check for Inquiry ("when do I take", "time of", "kab lena hai")
  const hasWhen =
    tokenSet.has("when") ||
    tokenSet.has("time") ||
    tokenSet.has("how") ||
    tokenSet.has("kab") ||
    tokenSet.has("samay") ||
    tokenSet.has("kaise") ||
    tokenSet.has("कब") ||
    tokenSet.has("कैसे");

  const isInquiry = hasWhen && !isDoseCheck && !isScheduleOverview;
  if (isInquiry) {
    intents.push("inquiry");
  }

  // Check for Dose Taken ("I took", "taken", "had", "kha liya", "le li", "liya")
  const hasTakenToken =
    tokenSet.has("took") ||
    tokenSet.has("taken") ||
    tokenSet.has("had") ||
    tokenSet.has("given") ||
    tokenSet.has("swallowed") ||
    tokenSet.has("liya") ||
    tokenSet.has("le") ||
    tokenSet.has("khaya") ||
    tokenSet.has("लिया") ||
    tokenSet.has("ली") ||
    tokenSet.has("खाया") ||
    tokenSet.has("खा");

  const isDoseTaken = hasTakenToken && !hasWhen && !isDoseCheck;
  if (isDoseTaken) {
    intents.push("dose_taken");
  }

  return {
    intents: intents.length > 0 ? intents : ["inquiry"],
    isDoseCheck,
    isScheduleOverview,
    isInquiry,
    isDoseTaken,
  };
}
