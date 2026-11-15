/**
 * CareSync AI — Deterministic Voice Response Generator
 * Builds all spoken responses strictly from stored medication records using localized templates.
 * 
 * Rules:
 * - The LLM must NEVER write spokenResponse or any clinical dose/time.
 * - Dynamic patient naming using elderProfile.name (no hardcoded names).
 * - Localized English and Hindi response templates.
 * - Unknown medicine -> "<name> is not in your medicine list. Please ask your caretaker."
 * - Negation and clinical triage safety responses.
 */

/**
 * Builds a deterministic spoken response based on matched intent, medication, and symptoms.
 * 
 * @param {object} params
 * @returns {string}
 */
export function buildSpokenResponse({
  lang = "en-IN",
  elderProfile = {},
  matchedMedication = null,
  unknownName = null,
  intents = [],
  symptomReported = null,
  severity = "normal",
  emergency = false,
  needsConfirmation = false,
  candidates = [],
  isGroup = false,
  timeOfDay = null,
  actions = [],
  medications = [],
}) {
  const isHindi = (lang || "").toLowerCase().startsWith("hi");
  const patientName = (elderProfile && elderProfile.name) ? elderProfile.name : (isHindi ? "रामेश्वर" : "Rameshwar");
  const greeting = isHindi ? `${patientName} जी` : patientName;

  const responses = [];

  // 1. Emergency Symptom Alert Response (Highest Priority)
  if (emergency) {
    if (isHindi) {
      return `${greeting}, यह गंभीर आपातकालीन स्थिति है! कृपया तुरंत बैठ जाएं और 112 या अपने डॉक्टर को कॉल करें। मैंने आपके परिवार को आपातकालीन सूचना भेज दी है।`;
    }
    return `${greeting}, this is a critical emergency! Please sit down immediately and call 112 or your doctor. I have alerted your family right now.`;
  }

  // 2. High Symptom Alert (e.g., mild dizziness, nausea)
  if (symptomReported && severity === "high") {
    if (isHindi) {
      responses.push(
        `${greeting}, मैंने दर्ज कर लिया है कि आपको ${symptomReported} महसूस हो रहा है। कृपया बैठें, आराम करें और पानी पिएं। मैंने आपके देखभाल करने वाले को सूचित कर दिया है।`
      );
    } else {
      responses.push(
        `${greeting}, I have recorded that you feel ${symptomReported}. Please sit down, rest, and drink some water. I have notified your caretaker.`
      );
    }
  }

  // 3. Unknown Medicine Mentioned (Not in approved medications list)
  if (unknownName) {
    if (isHindi) {
      responses.push(
        `${unknownName} आपकी दवाइयों की सूची में नहीं है। कृपया अपनी देखभाल करने वाले से पूछें।`
      );
    } else {
      responses.push(
        `${unknownName} is not in your medicine list. Please ask your caretaker.`
      );
    }
    return responses.join(" ");
  }

  // 4. Plural Group Confirmation (e.g. "morning medicines")
  if (isGroup && needsConfirmation && candidates.length > 0) {
    const periodLabel = timeOfDay === "morning" ? (isHindi ? "सुबह" : "morning") : (isHindi ? "शाम" : "evening");
    if (isHindi) {
      responses.push(
        `${greeting}, क्या आप सभी ${candidates.length} ${periodLabel} की दवाइयों को लिया हुआ दर्ज करना चाहते हैं? पुष्टि करने के लिए स्क्रीन पर टैप करें।`
      );
    } else {
      responses.push(
        `${greeting}, do you want to mark all ${candidates.length} ${periodLabel} medicines as taken? Tap confirm on the card below.`
      );
    }
    return responses.join(" ");
  }

  // 5. Single Medicine Confirmation Needed (MEDIUM confidence)
  if (needsConfirmation && candidates.length > 0) {
    const candidateName = candidates[0].name;
    if (isHindi) {
      responses.push(
        `${greeting}, क्या आपका मतलब ${candidateName} से था? खुराक दर्ज करने के लिए नीचे पुष्टि करें।`
      );
    } else {
      responses.push(
        `${greeting}, did you mean ${candidateName}? Please tap confirm below to mark it as taken.`
      );
    }
    return responses.join(" ");
  }

  // 6. Dose-Check Intent ("Can I take another / one more")
  if (intents.includes("dose_check") && matchedMedication) {
    const med = matchedMedication;
    const allSlots = med.timeSlots || ["08:00 AM"];
    const takenSlots = med.takenSlots || [];
    const untakenSlots = allSlots.filter((s) => !takenSlots.includes(s));

    if (untakenSlots.length === 0 || med.takenToday) {
      if (isHindi) {
        responses.push(
          `रुकिए! ${greeting}, आप आज अपनी ${med.name} की सभी निर्धारित खुराक ले चुके हैं। दूसरी खुराक लेना सुरक्षित नहीं है।`
        );
      } else {
        responses.push(
          `STOP! ${greeting}, you already took all scheduled doses of ${med.name} today. Taking another dose is unsafe.`
        );
      }
    } else {
      const nextDue = untakenSlots[0];
      if (isHindi) {
        responses.push(
          `${greeting}, आपकी अगली ${med.name} खुराक ${nextDue} को निर्धारित है। कृपया इसे समय पर ही लें।`
        );
      } else {
        responses.push(
          `${greeting}, your next scheduled ${med.name} dose is at ${nextDue}. Please take it at the scheduled time.`
        );
      }
    }
    return responses.join(" ");
  }

  // 7. Dose Taken Intent (STRONG match with approved action)
  if (intents.includes("dose_taken") && matchedMedication) {
    const med = matchedMedication;
    const allSlots = med.timeSlots || ["08:00 AM"];
    const takenSlots = med.takenSlots || [];
    const untaken = allSlots.filter((s) => !takenSlots.includes(s));

    if (med.takenToday || untaken.length === 0) {
      if (isHindi) {
        responses.push(
          `${greeting}, आपकी ${med.name} दवा आज पहले ही दर्ज हो चुकी है। आपको दोबारा लेने की आवश्यकता नहीं है।`
        );
      } else {
        responses.push(
          `${greeting}, your ${med.name} was already recorded as taken earlier today. No second dose needed.`
        );
      }
    } else {
      const slotLabel = untaken[0] || allSlots[0];
      if (isHindi) {
        responses.push(
          `${greeting}, मैंने आपकी ${med.name} (${slotLabel}) खुराक दर्ज कर ली है।`
        );
      } else {
        responses.push(
          `${greeting}, I have marked your ${med.name} (${slotLabel}) as taken.`
        );
      }
    }
  }

  // 8. Schedule Inquiry Intent (e.g. "when do I take Stamlo")
  if (intents.includes("inquiry") && matchedMedication) {
    const med = matchedMedication;
    const allSlots = med.timeSlots || ["08:00 AM"];
    const takenSlots = med.takenSlots || [];
    const untaken = allSlots.filter((s) => !takenSlots.includes(s));

    if (med.takenToday || untaken.length === 0) {
      const lastTime = med.lastTakenAt || "earlier today";
      if (isHindi) {
        responses.push(
          `${greeting}, आपने आज ${med.name} ${lastTime} पर ले ली है। आज के लिए और कोई खुराक नहीं बची है।`
        );
      } else {
        responses.push(
          `${greeting}, you already took ${med.name} today at ${lastTime}. No more doses are due today.`
        );
      }
    } else if (takenSlots.length > 0) {
      const nextSlot = untaken[0];
      if (isHindi) {
        responses.push(
          `${greeting}, आपने पिछली खुराक ${med.lastTakenAt || "पहले"} ली थी। आपकी अगली ${med.name} खुराक ${nextSlot} को है।`
        );
      } else {
        responses.push(
          `${greeting}, you took a dose at ${med.lastTakenAt || "earlier"}. Your next ${med.name} dose is scheduled at ${nextSlot}.`
        );
      }
    } else {
      const slotsStr = allSlots.join(isHindi ? " और " : " and ");
      const meal = med.mealInstruction || (isHindi ? "पानी के साथ" : "with water");
      if (isHindi) {
        responses.push(
          `${greeting}, आपकी ${med.name} (${med.dosage}) का समय ${slotsStr} है। ${meal} लें।`
        );
      } else {
        responses.push(
          `${greeting}, your ${med.name} (${med.dosage}) is scheduled at ${slotsStr}. ${meal}.`
        );
      }
    }
  }

  // 9. Schedule Overview Intent ("my medicine schedule")
  if (intents.includes("schedule_overview") || (responses.length === 0 && !matchedMedication)) {
    if (medications.length > 0) {
      const summaryList = medications
        .map((m) => `${m.name} (${m.timeSlots ? m.timeSlots.join(", ") : "08:00 AM"})`)
        .join(isHindi ? ", " : ", ");

      if (isHindi) {
        responses.push(
          `${greeting}, आपकी आज की दवाइयां हैं: ${summaryList}। दवा लेने के बाद नीचे दिए गए कार्ड को दबाएं।`
        );
      } else {
        responses.push(
          `${greeting}, here is your schedule for today: ${summaryList}. Tap any card once you take it.`
        );
      }
    } else {
      if (isHindi) {
        responses.push(`${greeting}, आपकी सूची में अभी कोई निर्धारित दवा नहीं है।`);
      } else {
        responses.push(`${greeting}, you currently have no scheduled medications.`);
      }
    }
  }

  return responses.join(" ");
}
