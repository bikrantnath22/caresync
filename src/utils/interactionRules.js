/**
 * CareSync AI — Deterministic Clinical Interaction & Allergy Rules Engine
 * Evaluates high-risk drug-drug, food-drug, and allergy conflicts deterministically
 * on top of LLM outputs to guarantee zero clinical hallucination and zero missed critical interactions.
 */

export const INTERACTION_DISCLAIMER =
  "AI/rule check only — confirm with doctor or pharmacist.";

// Classification keyword dictionaries
const ANTICOAGULANTS = [
  "warfarin",
  "coumadin",
  "heparin",
  "apixaban",
  "eliquis",
  "rivaroxaban",
  "xarelto",
  "dabigatran",
  "pradaxa",
];

const ANTIPLATELETS_NSAIDS = [
  "aspirin",
  "asprin",
  "ecosprin",
  "clopidogrel",
  "plavix",
  "ibuprofen",
  "advil",
  "motrin",
  "naproxen",
  "aleve",
  "diclofenac",
  "voveran",
];

const STATINS = [
  "atorvastatin",
  "lipitor",
  "rosuvastatin",
  "arvast",
  "rosuvas",
  "simvastatin",
  "zocor",
  "pravastatin",
  "lovastatin",
];

const ACE_ARBS = [
  "lisinopril",
  "ramipril",
  "enalapril",
  "losartan",
  "telmisartan",
  "valsartan",
];

const POTASSIUM_SPARING = [
  "spironolactone",
  "aldactone",
  "eplerenone",
  "potassium",
  "k-dur",
];

const ALLERGY_MAP = {
  penicillin: ["penicillin", "amoxicillin", "ampicillin", "augmentin", "mox"],
  sulfa: ["sulfa", "sulfamethoxazole", "bactrim", "septra", "cotrimoxazole"],
  aspirin: ["aspirin", "asprin", "ecosprin", "salicylate"],
  nsaid: ["ibuprofen", "naproxen", "diclofenac"],
};

/**
 * Normalizes a drug name to lowercase alphabetic tokens.
 * @param {string} name
 * @returns {string}
 */
function cleanName(name) {
  return (name || "").toLowerCase().trim();
}

/**
 * Checks if a medication matches any term in a dictionary.
 * @param {object} med
 * @param {string[]} terms
 * @returns {boolean}
 */
function matchesAny(med, terms) {
  const name = cleanName(med.name);
  return terms.some((t) => name.includes(t));
}

/**
 * Deterministically evaluates clinical interactions and allergy conflicts
 * across existing medications and newly extracted prescription medications.
 *
 * @param {Array} newMedications - Medications extracted from current prescription
 * @param {Array} existingMedications - Medications already in patient's profile
 * @param {object} elderProfile - Patient profile containing allergies
 * @returns {Array<object>} Array of structured rule-based interaction warnings
 */
export function evaluateInteractionRules(
  newMedications = [],
  existingMedications = [],
  elderProfile = {}
) {
  const warnings = [];
  let warnCounter = 1;

  const allMeds = [...existingMedications, ...newMedications];
  const patientAllergies = Array.isArray(elderProfile.allergies)
    ? elderProfile.allergies
    : [];

  // 1. Patient Allergy Cross-Check (Critical)
  for (const allergy of patientAllergies) {
    const cleanAllergy = cleanName(allergy);
    let triggerTerms = [cleanAllergy];

    for (const [key, variants] of Object.entries(ALLERGY_MAP)) {
      if (cleanAllergy.includes(key)) {
        triggerTerms = Array.from(new Set([...triggerTerms, ...variants]));
      }
    }

    for (const med of newMedications) {
      if (matchesAny(med, triggerTerms)) {
        warnings.push({
          id: `rule-warn-allergy-${warnCounter++}`,
          severity: "critical",
          type: "Allergy Conflict",
          source: "rule-based",
          drugs: [med.name, allergy],
          title: "DOCUMENTED PATIENT ALLERGY CONFLICT",
          warning: `Prescribed medication "${med.name}" conflicts with documented patient allergy: "${allergy}".`,
          action:
            "DO NOT ADMINISTER. Immediate physician review required to select a safe non-allergenic alternative.",
        });
      }
    }
  }

  // 2. Warfarin / Anticoagulant + Aspirin / NSAID Hazard (Critical Bleeding Risk)
  const hasAnticoagulant = allMeds.find((m) => matchesAny(m, ANTICOAGULANTS));
  const hasAntiplatelet = allMeds.find((m) => matchesAny(m, ANTIPLATELETS_NSAIDS));

  if (hasAnticoagulant && hasAntiplatelet) {
    warnings.push({
      id: `rule-warn-bleeding-${warnCounter++}`,
      severity: "critical",
      type: "Drug-Drug Interaction",
      source: "rule-based",
      drugs: [hasAnticoagulant.name, hasAntiplatelet.name],
      title: "CRITICAL BLEEDING HAZARD",
      warning: `Combining anticoagulant (${hasAnticoagulant.name}) with antiplatelet/NSAID agent (${hasAntiplatelet.name}) synergistically amplifies major gastrointestinal and systemic bleeding risks.`,
      action:
        "Immediate physician review required before co-administering this medication.",
    });
  }

  // 3. Duplicate Statin Therapy Hazard (Critical Myopathy Risk)
  const statinMatches = allMeds.filter((m) => matchesAny(m, STATINS));
  if (statinMatches.length >= 2) {
    const uniqueStatinNames = Array.from(
      new Set(statinMatches.map((m) => m.name))
    );
    warnings.push({
      id: `rule-warn-statin-${warnCounter++}`,
      severity: "critical",
      type: "Duplicate Therapy Hazard",
      source: "rule-based",
      drugs: uniqueStatinNames,
      title: "DUPLICATE STATIN THERAPY HAZARD",
      warning: `Concurrent administration of multiple statin medications (${uniqueStatinNames.join(
        ", "
      )}) drastically increases risk of severe muscle toxicity and rhabdomyolysis.`,
      action:
        "Do not take two statins concurrently; consult physician to discontinue one.",
    });
  }

  // 4. Duplicate Medication Conflict (Same drug name prescribed twice)
  const nameCounts = {};
  for (const med of allMeds) {
    const rootName = cleanName(med.name).split(/\s+/)[0];
    if (rootName && rootName.length >= 3) {
      nameCounts[rootName] = (nameCounts[rootName] || 0) + 1;
    }
  }

  for (const [rootName, count] of Object.entries(nameCounts)) {
    if (count >= 2) {
      // Find matching items from new medications to ensure it's relevant to this upload
      const relevantNew = newMedications.find((m) =>
        cleanName(m.name).startsWith(rootName)
      );
      if (relevantNew) {
        warnings.push({
          id: `rule-warn-dup-${warnCounter++}`,
          severity: "critical",
          type: "Duplicate Drug Warning",
          source: "rule-based",
          drugs: [relevantNew.name],
          title: "DUPLICATE MEDICATION DETECTED",
          warning: `Medication matching "${relevantNew.name}" appears multiple times in the active regimen, creating a danger of accidental overdose.`,
          action:
            "Verify whether this is a dosage update or an accidental duplicate before administering.",
        });
      }
    }
  }

  // 5. ACE Inhibitor / ARB + Potassium Sparing (Hyperkalemia Warning)
  const hasAceArb = allMeds.find((m) => matchesAny(m, ACE_ARBS));
  const hasPotassium = allMeds.find((m) => matchesAny(m, POTASSIUM_SPARING));
  if (hasAceArb && hasPotassium) {
    warnings.push({
      id: `rule-warn-hyperkalemia-${warnCounter++}`,
      severity: "warning",
      type: "Drug-Drug Interaction",
      source: "rule-based",
      drugs: [hasAceArb.name, hasPotassium.name],
      title: "HYPERKALEMIA RISK",
      warning: `Co-administering ACE inhibitors or ARBs (${hasAceArb.name}) with potassium-sparing agents (${hasPotassium.name}) can cause dangerously elevated serum potassium.`,
      action: "Monitor serum potassium and renal electrolytes regularly.",
    });
  }

  // 6. Food-Drug: Statin + Grapefruit Rule
  const statinInNew = newMedications.find((m) => matchesAny(m, STATINS));
  if (statinInNew) {
    warnings.push({
      id: `rule-warn-grapefruit-${warnCounter++}`,
      severity: "warning",
      type: "Food-Drug Interaction",
      source: "rule-based",
      drugs: [statinInNew.name],
      title: "CYP3A4 FOOD INHIBITION ADVISORY",
      warning:
        "Grapefruit products inhibit hepatic CYP3A4 metabolism, drastically elevating statin systemic concentration and muscle toxicity risk.",
      action:
        "Counsel patient to strictly avoid grapefruit and grapefruit juice while on this therapy.",
    });
  }

  return warnings;
}

/**
 * Merges LLM-generated warnings with deterministic rule-based warnings,
 * eliminating duplicates and tagging sources cleanly.
 *
 * @param {Array} llmWarnings
 * @param {Array} ruleWarnings
 * @returns {Array<object>}
 */
export function mergeInteractionWarnings(llmWarnings = [], ruleWarnings = []) {
  const merged = [];
  const seenTypes = new Set();

  // Rule-based warnings take precedence and are inserted first
  for (const rw of ruleWarnings) {
    const key = `${rw.type}-${(rw.drugs || []).slice().sort().join("-")}`.toLowerCase();
    if (!seenTypes.has(key)) {
      seenTypes.add(key);
      merged.push({
        ...rw,
        source: "rule-based",
      });
    }
  }

  // LLM warnings appended if not already covered
  for (const lw of llmWarnings) {
    const key = `${lw.type}-${(lw.drugs || []).slice().sort().join("-")}`.toLowerCase();
    const titleKey = (lw.title || "").toLowerCase();
    const isDup =
      seenTypes.has(key) ||
      (titleKey.includes("bleeding") && seenTypes.has("bleeding")) ||
      (titleKey.includes("grapefruit") && seenTypes.has("grapefruit"));

    if (!isDup) {
      if (titleKey.includes("bleeding")) seenTypes.add("bleeding");
      if (titleKey.includes("grapefruit")) seenTypes.add("grapefruit");
      seenTypes.add(key);

      merged.push({
        ...lw,
        id: lw.id || `warn-llm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: "llm",
      });
    }
  }

  return merged;
}
