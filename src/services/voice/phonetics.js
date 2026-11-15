/**
 * CareSync AI — Voice Phonetics & Tokenization Module
 * Implements Unicode-safe tokenization and drug-specific phonetic variants.
 * 
 * Rules:
 * - Tokenize on whitespace and punctuation using Unicode property escapes.
 * - Never use \b (which fails on Devanagari script).
 * - Never use substring includes for keywords/aliases.
 * - Retain phonetic variants ONLY for drug-like misspellings and Devanagari transliterations
 *   of approved medications present in the active regimen.
 * - Exclude all ordinary English words (sample, harvest, temple, stapler, etc.).
 */

/**
 * Tokenizes text into lowercase tokens on whitespace and punctuation.
 * Uses Unicode property escapes \p{L} (letters) and \p{N} (numbers) to safely support
 * Latin, Devanagari, and international alphabets without relying on ASCII \b.
 * 
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  if (!text) return [];
  return text
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Known legitimate pharmaceutical misspellings and Devanagari transliterations.
 * Strictly excludes ordinary English words (e.g. no sample, harvest, temple, stapler, table, reflux, etc.).
 */
export const PHARMACEUTICAL_VARIANTS = {
  metformin: [
    "metformin",
    "metformine",
    "metformin-xr",
    "मेटफॉर्मिन",
    "मेटफोरमिन",
    "मेटफ़ॉर्मिन",
  ],
  warfarin: [
    "warfarin",
    "warfarine",
    "वारफारिन",
    "वारफैरिन",
    "वारफेरिन",
  ],
  atorvastatin: [
    "atorvastatin",
    "atorvastatine",
    "एटोरवास्टेटिन",
    "एटोरवास्टैटिन",
  ],
  aspirin: [
    "aspirin",
    "asprin",
    "एस्पिरिन",
    "ऐस्पिरिन",
  ],
  stamlo: [
    "stamlo",
    "stamlop",
    "stamlo-5",
    "stamlo-beta",
    "स्टैमलो",
    "स्टामलो",
  ],
  arvast: [
    "arvast",
    "arvast-5",
    "arvast-10",
    "अर्वस्ट",
    "आरवास्ट",
  ],
  thyrox: [
    "thyrox",
    "thyroxine",
    "थायरोक्स",
    "थाइरॉक्स",
  ],
  bplex: [
    "bplex",
    "b-complex",
    "बीप्लेक्स",
  ],
  fastxr: [
    "fastxr",
    "fast-xr",
    "फास्टएक्सआर",
  ],
};

/**
 * Common pharmacopoeia medicine names to recognize when an elder asks about an unapproved drug.
 */
export const GLOBAL_KNOWN_MEDICINES = new Set([
  "lipitor",
  "coumadin",
  "ecosprin",
  "rosuvas",
  "rosuvastatin",
  "thyronorm",
  "eltroxin",
  "lisinopril",
  "amlodipine",
  "paracetamol",
  "calpol",
  "crocin",
  "insulin",
  "tylenol",
  "advil",
  "ibuprofen",
  "pantocid",
  "pan-d",
  "telmisartan",
  "losartan",
  "stamlo",
  "arvast",
  "thyrox",
  "bplex",
  "fastxr",
  "metformin",
  "warfarin",
  "atorvastatin",
  "aspirin",
  "digoxin",
  "glimepiride",
  "pantoprazole",
]);

/**
 * Computes Levenshtein edit distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshteinDistance(a, b) {
  if (!a || !b) return (a || "").length + (b || "").length;
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}
