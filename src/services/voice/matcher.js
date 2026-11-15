/**
 * CareSync AI — Voice Medicine Matcher Module
 * Matches spoken tokens against ONLY the active medications array passed as arguments.
 * Enforces strict confidence tiers: STRONG, MEDIUM, and WEAK.
 * 
 * Rules:
 * - Uses ONLY the approved medications array; no localStorage reads or external drug schedules.
 * - Unknown medicines -> identified as unknown; never guess clinical timing.
 * - Confidence tiers:
 *    * STRONG: Exact token match with medicine name or registered variant. May act immediately.
 *    * MEDIUM: Levenshtein distance <= 1 on names of 6+ letters, or secondary alias. Must ask confirmation.
 *    * WEAK: Pill appearance/color or time-of-day group ("morning medicines"). Lists candidates and asks.
 */

import { PHARMACEUTICAL_VARIANTS, GLOBAL_KNOWN_MEDICINES, levenshteinDistance } from "./phonetics.js";

/**
 * Matches spoken tokens against the approved active medications.
 * 
 * @param {string[]} tokens - Tokenized words from the transcript
 * @param {Array} medications - Active medications passed from context
 * @param {object} [options] - Options including speech alternatives and language
 * @returns {{
 *   tier: "STRONG" | "MEDIUM" | "WEAK" | "NONE",
 *   medication: object | null,
 *   candidates: Array<{ id: string, name: string }>,
 *   needsConfirmation: boolean,
 *   isGroup: boolean,
 *   timeOfDay: string | null,
 *   unknownName: string | null
 * }}
 */
export function matchMedication(tokens = [], medications = [], options = {}) {
  if (!tokens || tokens.length === 0 || !medications || medications.length === 0) {
    return {
      tier: "NONE",
      medication: null,
      candidates: [],
      needsConfirmation: false,
      isGroup: false,
      timeOfDay: null,
      unknownName: null,
    };
  }

  // Pre-normalize active approved medications
  const approvedMeds = medications.map((med) => {
    const rawName = (med.name || "").trim().toLowerCase();
    const cleanTokens = rawName.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const variants = PHARMACEUTICAL_VARIANTS[cleanTokens[0]] || [rawName];
    return {
      raw: med,
      name: rawName,
      tokens: cleanTokens,
      variants,
      appearance: (med.pillAppearance || "").toLowerCase(),
      timeSlots: med.timeSlots || [],
      takenSlots: med.takenSlots || [],
    };
  });

  // 1. Check for Plural / Time-of-Day Group Ingestion (e.g., "morning medicines", "evening pills")
  const isPluralMention =
    tokens.some((t) =>
      ["medicines", "pills", "tablets", "dawaiya", "dawaiyan", "goliya", "goliyan", "दवाइयां", "दवाइयाँ", "गोलियां", "गोलियाँ"].includes(t)
    ) ||
    tokens.includes("all") ||
    tokens.includes("sab") ||
    tokens.includes("sari") ||
    tokens.includes("सारी") ||
    tokens.includes("सभी");

  const hasMorningToken = tokens.some((t) =>
    ["morning", "breakfast", "subah", "सुबह", "नाश्ता"].includes(t)
  );
  const hasEveningToken = tokens.some((t) =>
    ["evening", "night", "dinner", "shaam", "raat", "शाम", "रात"].includes(t)
  );

  if (isPluralMention && (hasMorningToken || hasEveningToken)) {
    const timeOfDay = hasMorningToken ? "morning" : "evening";
    const matchingMeds = approvedMeds.filter((m) => {
      // Find medicines with an untaken slot in that part of the day
      return m.timeSlots.some((slot) => {
        const slotUpper = slot.toUpperCase();
        const isMorningSlot = slotUpper.includes("AM") || slotUpper.startsWith("08:") || slotUpper.startsWith("09:");
        const isEveningSlot = slotUpper.includes("PM") && !slotUpper.startsWith("12:");
        const matchesPeriod = hasMorningToken ? isMorningSlot : isEveningSlot;
        const isUntaken = !m.takenSlots.includes(slot);
        return matchesPeriod && isUntaken;
      });
    });

    if (matchingMeds.length > 0) {
      return {
        tier: "WEAK",
        medication: null,
        candidates: matchingMeds.map((m) => ({ id: m.raw.id, name: m.raw.name })),
        needsConfirmation: true,
        isGroup: true,
        timeOfDay,
        unknownName: null,
      };
    }
  }

  // 2. TIER: STRONG — Exact token match with approved medication name or registered variant
  for (const token of tokens) {
    for (const med of approvedMeds) {
      // Exact match on full name or primary token
      if (med.name === token || med.tokens.includes(token)) {
        return {
          tier: "STRONG",
          medication: med.raw,
          candidates: [{ id: med.raw.id, name: med.raw.name }],
          needsConfirmation: false,
          isGroup: false,
          timeOfDay: null,
          unknownName: null,
        };
      }
      // Exact match on registered pharmaceutical variant for this approved medicine
      if (med.variants.includes(token)) {
        return {
          tier: "STRONG",
          medication: med.raw,
          candidates: [{ id: med.raw.id, name: med.raw.name }],
          needsConfirmation: false,
          isGroup: false,
          timeOfDay: null,
          unknownName: null,
        };
      }
    }
  }

  // Check speech recognition alternatives for STRONG matches if available
  if (Array.isArray(options.alternatives)) {
    for (const alt of options.alternatives) {
      const altTokens = (alt || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      for (const token of altTokens) {
        for (const med of approvedMeds) {
          if (med.name === token || med.tokens.includes(token) || med.variants.includes(token)) {
            return {
              tier: "STRONG",
              medication: med.raw,
              candidates: [{ id: med.raw.id, name: med.raw.name }],
              needsConfirmation: false,
              isGroup: false,
              timeOfDay: null,
              unknownName: null,
            };
          }
        }
      }
    }
  }

  // 3. TIER: MEDIUM — Levenshtein distance <= 1 on names of 6+ letters
  for (const token of tokens) {
    if (token.length >= 5) {
      for (const med of approvedMeds) {
        for (const mToken of med.tokens) {
          if (mToken.length >= 6) {
            const dist = levenshteinDistance(token, mToken);
            if (dist <= 1) {
              return {
                tier: "MEDIUM",
                medication: med.raw,
                candidates: [{ id: med.raw.id, name: med.raw.name }],
                needsConfirmation: true,
                isGroup: false,
                timeOfDay: null,
                unknownName: null,
              };
            }
          }
        }
      }
    }
  }

  // 4. TIER: WEAK — Pill color / appearance matching
  const colorMatches = [];
  const colorKeywords = [
    { en: "white", hi: "सफेद", hinglish: "safed" },
    { en: "pink", hi: "गुलाबी", hinglish: "gulabi" },
    { en: "yellow", hi: "पीली", hinglish: "peeli" },
    { en: "round", hi: "गोल", hinglish: "gol" },
    { en: "oval", hi: "अंडाकार", hinglish: "andakar" },
  ];

  for (const ck of colorKeywords) {
    if (tokens.includes(ck.en) || tokens.includes(ck.hi) || tokens.includes(ck.hinglish)) {
      for (const med of approvedMeds) {
        if (med.appearance.includes(ck.en)) {
          if (!colorMatches.some((m) => m.id === med.raw.id)) {
            colorMatches.push(med.raw);
          }
        }
      }
    }
  }

  if (colorMatches.length > 0) {
    return {
      tier: "WEAK",
      medication: colorMatches.length === 1 ? colorMatches[0] : null,
      candidates: colorMatches.map((m) => ({ id: m.id, name: m.name })),
      needsConfirmation: true,
      isGroup: false,
      timeOfDay: null,
      unknownName: null,
    };
  }

  // 5. Unknown Medicine Detection:
  // Check if user mentioned an unapproved drug from pharmacopoeia or in a clear medicine query
  for (const token of tokens) {
    if (GLOBAL_KNOWN_MEDICINES.has(token)) {
      const isApproved = approvedMeds.some(
        (m) => m.name.includes(token) || m.tokens.includes(token) || m.variants.includes(token)
      );
      if (!isApproved) {
        return {
          tier: "NONE",
          medication: null,
          candidates: [],
          needsConfirmation: false,
          isGroup: false,
          timeOfDay: null,
          unknownName: token,
        };
      }
    }
  }

  for (const [canonical, variants] of Object.entries(PHARMACEUTICAL_VARIANTS)) {
    const isApproved = approvedMeds.some(
      (m) => m.name.includes(canonical) || m.tokens.includes(canonical)
    );
    if (!isApproved) {
      for (const token of tokens) {
        if (canonical === token || variants.includes(token)) {
          return {
            tier: "NONE",
            medication: null,
            candidates: [],
            needsConfirmation: false,
            isGroup: false,
            timeOfDay: null,
            unknownName: token,
          };
        }
      }
    }
  }

  // Check pattern queries: e.g. "when do I take X", "X medicine", "X dawai", "X tablet", "X kab lena hai"
  const STOP_WORDS = new Set([
    "when", "do", "i", "take", "my", "the", "a", "an", "this", "that", "is", "it", "to",
    "for", "in", "on", "at", "and", "or", "medicine", "medicines", "pill", "pills", "tablet",
    "tablets", "schedule", "today", "now", "please", "another", "one", "more", "can", "should",
    "will", "did", "have", "had", "took", "tell", "what", "time", "kab", "lena", "hai", "le",
    "li", "lia", "dawa", "dawai", "dawaiya", "dawaiyan", "goli", "goliya", "goliyan", "batao",
    "mujhe", "aaj", "ki", "ka", "ke", "ko", "se", "aur", "bhi", "kya", "subah", "shaam", "raat",
    "dophar", "nahi", "nahin", "yes", "no", "sample", "want", "know", "overview"
  ]);

  const hasInquiryPattern =
    tokens.includes("when") ||
    tokens.includes("kab") ||
    tokens.includes("medicine") ||
    tokens.includes("tablet") ||
    tokens.includes("pill") ||
    tokens.includes("dawai") ||
    tokens.includes("dawa") ||
    tokens.includes("goli") ||
    tokens.includes("another");

  if (hasInquiryPattern) {
    const nonStopTokens = tokens.filter((t) => !STOP_WORDS.has(t) && t.length >= 3);
    for (const nst of nonStopTokens) {
      const isApproved = approvedMeds.some(
        (m) => m.name.includes(nst) || m.tokens.includes(nst) || m.variants.includes(nst)
      );
      if (!isApproved) {
        return {
          tier: "NONE",
          medication: null,
          candidates: [],
          needsConfirmation: false,
          isGroup: false,
          timeOfDay: null,
          unknownName: nst,
        };
      }
    }
  }

  return {
    tier: "NONE",
    medication: null,
    candidates: [],
    needsConfirmation: false,
    isGroup: false,
    timeOfDay: null,
    unknownName: null,
  };
}
