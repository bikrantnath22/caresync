/**
 * CareSync AI — Master CareContext
 * Central state management for elder profile, medications, appointments,
 * audit logs, email simulation, real-time adherence scoring, and daily slot resets.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { verifyRolePin, sanitizeInput } from "../utils/security";

// Initial Demo Data matching SPEC.md Section 3 exactly with takenSlots tracking
export const INITIAL_ELDER_PROFILE = {
  name: "Rameshwar Nath",
  age: 74,
  bloodGroup: "O+",
  conditions: ["Hypertension", "Type 2 Diabetes", "Atrial Fibrillation"],
  allergies: ["Penicillin", "Sulfa Drugs"],
  primaryDoctor: "Dr. A. K. Sharma (Cardiologist)",
  caretakerEmail: "caretaker.shift@caresync.ai",
  familyEmail: "family.admin@caresync.ai",
};

export const INITIAL_MEDICATIONS = [
  {
    id: "med-1",
    name: "Metformin",
    dosage: "500mg",
    frequency: "Twice Daily (1-0-1)",
    timeSlots: ["08:00 AM", "08:00 PM"],
    takenSlots: [],
    mealInstruction: "Take 15 mins after breakfast and dinner",
    pillAppearance: "Round White Pill",
    remainingPills: 14,
    takenToday: false,
    lastTakenAt: null,
    interactionWarning: null,
    foodRule:
      "Take with meals to prevent stomach upset; avoid excessive alcohol.",
  },
  {
    id: "med-2",
    name: "Warfarin",
    dosage: "5mg",
    frequency: "Once Daily (0-0-1)",
    timeSlots: ["06:00 PM"],
    takenSlots: [],
    mealInstruction: "Take with evening water",
    pillAppearance: "Pink Oval Pill",
    remainingPills: 4,
    takenToday: false,
    lastTakenAt: null,
    interactionWarning:
      "CRITICAL: High bleeding risk if combined with Aspirin or NSAIDs.",
    foodRule: "Keep daily Vitamin K intake (spinach, leafy greens) consistent.",
  },
];

export const INITIAL_APPOINTMENTS = [
  {
    id: "apt-1",
    doctorName: "Dr. A. K. Sharma",
    specialty: "Cardiology & INR Review",
    date: "2026-11-22",
    time: "10:30 AM",
    location: "City Heart Clinic, Room 204",
    notes:
      "Bring 30-day medication adherence brief and blood pressure log.",
    reminderSent: false,
  },
];

export const INITIAL_LOGS = [
  {
    id: "log-1",
    timestamp: "08:05 AM",
    role: "Elder",
    type: "dose",
    severity: "normal",
    message: "Took Metformin 500mg (Morning Dose)",
  },
];

export const INITIAL_EMAILS = [
  {
    id: "email-1",
    timestamp: "08:30 AM",
    stage: "Stage 2: Caretaker Missed-Dose Alert",
    priority: "high",
    to: "caretaker.shift@caresync.ai",
    subject: "ACTION REQUIRED: Missed 08:00 AM Dose for Rameshwar Nath",
    body: "Rameshwar Nath has not logged his 08:00 AM Metformin 500mg dose (30 mins overdue). Please verify adherence.",
  },
];

const CareContext = createContext(null);

/**
 * Helper to safely read from localStorage
 */
function getStoredItem(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Returns today's local date string formatted as YYYY-MM-DD
 */
export function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Helper to get current formatted time (e.g. "08:05 AM")
 */
function getCurrentTimeFormatted() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Generates an RFC4122/UUID or robust pseudo-random unique ID.
 * @param {string} prefix
 * @returns {string}
 */
export function generateUniqueId(prefix = "id") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return `${prefix}-${crypto.randomUUID()}`;
    } catch {
      // fallback
    }
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parses a slot time string (e.g. "08:00 AM", "06:00 PM", "14:30") to minutes from midnight.
 * @param {string} slotStr
 * @returns {number}
 */
export function parseSlotToMinutes(slotStr) {
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
 * Cancels pending scheduled missed-dose alerts in localStorage for a specific slot.
 * @param {string} medId
 * @param {string} slot
 */
export function cancelSlotReminders(medId, slot) {
  try {
    const raw = localStorage.getItem("caresync_sent_reminder_keys");
    const set = new Set(raw ? JSON.parse(raw) : []);
    const dateStr = getLocalDateString();
    set.add(`dose-missed-30-${medId}-${slot}-${dateStr}`);
    set.add(`dose-missed-60-${medId}-${slot}-${dateStr}`);
    set.add(`dose-upcoming-${medId}-${slot}-${dateStr}`);
    localStorage.setItem("caresync_sent_reminder_keys", JSON.stringify(Array.from(set)));
  } catch {
    // ignore storage errors
  }
}

export function CareProvider({ children }) {
  // Master persistent states
  const [activeRole, setActiveRole] = useState(() =>
    getStoredItem("caresync_active_role", "elder")
  );
  const [elderProfile, setElderProfile] = useState(() =>
    getStoredItem("caresync_elder_profile", INITIAL_ELDER_PROFILE)
  );

  // Migrate old localStorage data ensuring takenSlots: [] and skippedSlots: [] defaults for every med
  const [medications, setMedications] = useState(() => {
    const stored = getStoredItem("caresync_medications", INITIAL_MEDICATIONS);
    if (Array.isArray(stored)) {
      return stored.map((m) => ({
        ...m,
        takenSlots: Array.isArray(m.takenSlots) ? m.takenSlots : [],
        skippedSlots: Array.isArray(m.skippedSlots) ? m.skippedSlots : [],
      }));
    }
    return INITIAL_MEDICATIONS;
  });

  const [appointments, setAppointments] = useState(() =>
    getStoredItem("caresync_appointments", INITIAL_APPOINTMENTS)
  );
  const [logs, setLogs] = useState(() =>
    getStoredItem("caresync_logs", INITIAL_LOGS)
  );
  const [emails, setEmails] = useState(() =>
    getStoredItem("caresync_emails", INITIAL_EMAILS)
  );
  const [doubleDoseAlert, setDoubleDoseAlert] = useState(null);

  // Track daily reset date (YYYY-MM-DD)
  const [lastResetDate, setLastResetDate] = useState(() =>
    getStoredItem("caresync_last_reset_date", getLocalDateString())
  );

  // Demo fast-forward clock offset (in minutes) (Requirement 6)
  const [clockOffsetMinutes, setClockOffsetMinutes] = useState(0);

  // Sync state changes with localStorage
  useEffect(() => {
    try {
      localStorage.setItem("caresync_active_role", JSON.stringify(activeRole));
    } catch {
      // ignore storage errors
    }
  }, [activeRole]);

  useEffect(() => {
    try {
      localStorage.setItem("caresync_elder_profile", JSON.stringify(elderProfile));
    } catch {
      // ignore storage errors
    }
  }, [elderProfile]);

  useEffect(() => {
    try {
      localStorage.setItem("caresync_medications", JSON.stringify(medications));
    } catch {
      // ignore storage errors
    }
  }, [medications]);

  useEffect(() => {
    try {
      localStorage.setItem("caresync_appointments", JSON.stringify(appointments));
    } catch {
      // ignore storage errors
    }
  }, [appointments]);

  useEffect(() => {
    try {
      localStorage.setItem("caresync_logs", JSON.stringify(logs));
    } catch {
      // ignore storage errors
    }
  }, [logs]);

  useEffect(() => {
    try {
      localStorage.setItem("caresync_emails", JSON.stringify(emails));
    } catch {
      // ignore storage errors
    }
  }, [emails]);

  useEffect(() => {
    try {
      localStorage.setItem("caresync_last_reset_date", JSON.stringify(lastResetDate));
    } catch {
      // ignore storage errors
    }
  }, [lastResetDate]);

  // Add an audit log entry
  const addLog = useCallback((role, type, severity, message) => {
    const newEntry = {
      id: generateUniqueId("log"),
      timestamp: getCurrentTimeFormatted(),
      role: role || "System",
      type: type || "event",
      severity: severity || "normal",
      message: sanitizeInput(message),
    };
    setLogs((prev) => [newEntry, ...prev]);
  }, []);

  // Check and perform automatic daily reset of taken dose status
  const checkDayReset = useCallback(() => {
    const todayStr = getLocalDateString();
    const storedDate = getStoredItem("caresync_last_reset_date", todayStr);

    if (storedDate !== todayStr || lastResetDate !== todayStr) {
      setMedications((prev) =>
        prev.map((m) => ({
          ...m,
          takenToday: false,
          lastTakenAt: null,
          takenSlots: [],
          skippedSlots: [],
        }))
      );
      setLastResetDate(todayStr);
      try {
        localStorage.setItem("caresync_last_reset_date", JSON.stringify(todayStr));
      } catch {
        // ignore
      }
      addLog("System", "daily-reset", "normal", "New day: dose status reset");
    }
  }, [lastResetDate, addLog]);

  // Run daily reset check on load, on interval (every 1 minute), and on tab focus
  useEffect(() => {
    checkDayReset();

    const interval = setInterval(() => {
      checkDayReset();
    }, 60 * 1000);

    const handleFocus = () => {
      checkDayReset();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkDayReset]);

  // Real-time computed adherenceScore:
  // adherenceScore = taken doses / doses already due (slots with time <= now). Return 100 when nothing is due yet.
  const adherenceScore = useMemo(() => {
    if (!medications || medications.length === 0) return 100;

    const effectiveNow = new Date(Date.now() + (clockOffsetMinutes || 0) * 60 * 1000);
    const nowMinutes = effectiveNow.getHours() * 60 + effectiveNow.getMinutes();

    let totalDosesDue = 0;
    let totalDosesTaken = 0;

    medications.forEach((med) => {
      const slots = Array.isArray(med.timeSlots) && med.timeSlots.length > 0
        ? med.timeSlots
        : ["08:00 AM"];
      const taken = Array.isArray(med.takenSlots) ? med.takenSlots : [];

      slots.forEach((slot) => {
        const slotMin = parseSlotToMinutes(slot);
        if (slotMin <= nowMinutes) {
          totalDosesDue += 1;
          if (taken.includes(slot)) {
            totalDosesTaken += 1;
          }
        } else if (taken.includes(slot)) {
          totalDosesDue += 1;
          totalDosesTaken += 1;
        }
      });
    });

    if (totalDosesDue === 0) {
      return 100;
    }

    return Math.min(100, Math.round((totalDosesTaken / totalDosesDue) * 100));
  }, [medications, clockOffsetMinutes]);

  // Real-time computed lowStockMedications: remainingPills <= 5
  const lowStockMedications = useMemo(() => {
    if (!medications) return [];
    return medications.filter((m) => Number(m.remainingPills) <= 5);
  }, [medications]);

  // Trigger escalating email simulation
  const triggerEscalatingEmail = useCallback(
    (stageType, customDetails = {}) => {
      const timestamp = getCurrentTimeFormatted();
      let stageLabel = "";
      let priority = "normal";
      let to = elderProfile.caretakerEmail;
      let subject = "";
      let body = "";

      const lowStockList = medications.filter((m) => Number(m.remainingPills) <= 5);
      const refillNote =
        lowStockList.length > 0
          ? `\n\n[REFILL ALERT] The following medications have critical stock (<= 5 pills remaining):\n` +
            lowStockList
              .map(
                (m) =>
                  `• ${m.name} (${m.dosage}) — ${m.remainingPills} pills left. [1-Click Order Link: https://pharmacy.caresync.ai/refill/${m.id}]`
              )
              .join("\n")
          : "";

      const patientName = elderProfile.name || "Patient";

      if (stageType === 1 || stageType === "stage1" || stageType?.includes?.("Stage 1")) {
        stageLabel = "Stage 1: Upcoming Dose & Appointment Reminder";
        priority = "normal";
        to = elderProfile.familyEmail;
        subject = `Gentle Reminder: Daily Care & Appointments for ${patientName}`;
        body =
          customDetails.body ||
          `Daily schedule is active for ${patientName}. Ensure morning medications are taken on time.${refillNote}`;
      } else if (stageType === 2 || stageType === "stage2" || stageType?.includes?.("Stage 2")) {
        stageLabel = "Stage 2: Caretaker Missed-Dose Alert";
        priority = "high";
        to = elderProfile.caretakerEmail;
        subject =
          customDetails.subject ||
          `ACTION REQUIRED: Missed Scheduled Dose for ${patientName}`;
        body =
          customDetails.body ||
          `${patientName} has not logged a scheduled dose (30 mins overdue). Please verify medication adherence.${refillNote}`;
      } else {
        // Stage 3 / Critical Overdose / Missed Dose
        stageLabel = customDetails.stage || "Stage 3: Family Urgent Alert";
        priority = "critical";
        to = elderProfile.familyEmail;
        subject =
          customDetails.subject ||
          `URGENT OVERDOSE ALERT: Repeated Dose Attempt for ${patientName}`;
        body =
          customDetails.body ||
          `Emergency Alert: An attempt was made to take an extra medication dose today at ${timestamp}. The system has locked out the dose. Please inspect ${patientName} immediately.${refillNote}`;
      }

      const newEmail = {
        id: generateUniqueId("email"),
        timestamp,
        stage: stageLabel,
        priority,
        to: customDetails.to || to,
        subject: sanitizeInput(subject),
        body: sanitizeInput(body),
      };

      setEmails((prev) => [newEmail, ...prev]);
      addLog(
        "System",
        "email",
        priority === "critical" ? "critical" : "high",
        `Sent ${stageLabel} to ${newEmail.to}`
      );
      return newEmail;
    },
    [elderProfile, medications, addLog]
  );

  // Role switching with optional PIN check
  const switchRole = useCallback((targetRole, pin = null) => {
    const normalized = targetRole.toLowerCase();
    if (pin !== null && pin !== undefined) {
      const verification = verifyRolePin(pin, normalized);
      if (!verification.success) {
        return verification;
      }
    }
    setActiveRole(normalized);
    addLog(
      "Auth",
      "session",
      "normal",
      `Switched active role to ${normalized.toUpperCase()}`
    );
    return { success: true, role: normalized, error: null };
  }, [addLog]);

  // Add new medication — ignores incoming id, generates unique UUID,
  // and updates existing record if same name + dosage already exists
  const addMedication = useCallback((medObj) => {
    const cleanName = sanitizeInput(medObj.name || "").trim().toLowerCase();
    const cleanDosage = sanitizeInput(medObj.dosage || "").trim().toLowerCase();

    // Check for existing duplicate by name + dosage
    const existingMed = medications.find(
      (m) =>
        (m.name || "").trim().toLowerCase() === cleanName &&
        (m.dosage || "").trim().toLowerCase() === cleanDosage
    );

    if (existingMed) {
      // Update existing record rather than duplicating
      const updatedFields = {
        frequency: medObj.frequency ? sanitizeInput(medObj.frequency) : existingMed.frequency,
        timeSlots: Array.isArray(medObj.timeSlots) && medObj.timeSlots.length > 0
          ? medObj.timeSlots.map(sanitizeInput)
          : existingMed.timeSlots,
        mealInstruction: medObj.mealInstruction
          ? sanitizeInput(medObj.mealInstruction)
          : existingMed.mealInstruction,
        pillAppearance: medObj.pillAppearance
          ? sanitizeInput(medObj.pillAppearance)
          : existingMed.pillAppearance,
        remainingPills: medObj.remainingPills != null
          ? Number(medObj.remainingPills)
          : existingMed.remainingPills,
        interactionWarning: medObj.interactionWarning != null
          ? (medObj.interactionWarning ? sanitizeInput(medObj.interactionWarning) : null)
          : existingMed.interactionWarning,
        foodRule: medObj.foodRule != null
          ? sanitizeInput(medObj.foodRule)
          : existingMed.foodRule,
      };

      setMedications((prev) =>
        prev.map((m) => (m.id === existingMed.id ? { ...m, ...updatedFields } : m))
      );
      addLog(
        "Prescription",
        "medication-update",
        "normal",
        `Updated existing medication: ${existingMed.name} (${existingMed.dosage})`
      );
      return;
    }

    // Create fresh unique medication record
    const newMed = {
      id: generateUniqueId("med"),
      name: sanitizeInput(medObj.name),
      dosage: sanitizeInput(medObj.dosage),
      frequency: sanitizeInput(medObj.frequency || "Once Daily"),
      timeSlots: Array.isArray(medObj.timeSlots) && medObj.timeSlots.length > 0
        ? medObj.timeSlots.map(sanitizeInput)
        : ["08:00 AM"],
      takenSlots: [],
      mealInstruction: sanitizeInput(
        medObj.mealInstruction || "Take with water"
      ),
      pillAppearance: sanitizeInput(
        medObj.pillAppearance || "White Tablet"
      ),
      remainingPills: Number(medObj.remainingPills) || 30,
      takenToday: false,
      lastTakenAt: null,
      interactionWarning: medObj.interactionWarning
        ? sanitizeInput(medObj.interactionWarning)
        : null,
      foodRule: medObj.foodRule ? sanitizeInput(medObj.foodRule) : "",
    };

    setMedications((prev) => [...prev, newMed]);
    addLog(
      "Prescription",
      "medication",
      newMed.interactionWarning ? "high" : "normal",
      `Added medication: ${newMed.name} (${newMed.dosage})`
    );
  }, [medications, addLog]);

  // Update existing medication
  const updateMedication = useCallback((id, updatedFields) => {
    setMedications((prev) =>
      prev.map((med) => {
        if (med.id !== id) return med;
        const sanitized = {};
        for (const [key, val] of Object.entries(updatedFields)) {
          if (typeof val === "string") {
            sanitized[key] = sanitizeInput(val);
          } else {
            sanitized[key] = val;
          }
        }
        return { ...med, ...sanitized };
      })
    );
    addLog("Medication", "edit", "normal", `Updated medication details (ID: ${id})`);
  }, [addLog]);

  // Delete medication — target computed first, addLog called separately outside setState updater
  const deleteMedication = useCallback((id) => {
    const target = medications.find((m) => m.id === id);
    const name = target ? target.name : id;
    setMedications((prev) => prev.filter((m) => m.id !== id));
    addLog("Medication", "delete", "normal", `Removed medication: ${name}`);
  }, [medications, addLog]);

  // Restock medication pills
  const restockMedication = useCallback((id, amount = 30) => {
    setMedications((prev) =>
      prev.map((med) => {
        if (med.id === id) {
          const newTotal = (med.remainingPills || 0) + Number(amount);
          return { ...med, remainingPills: newTotal };
        }
        return med;
      })
    );
    addLog("Pharmacy", "refill", "normal", `Restocked +${amount} pills for medication ${id}`);
  }, [addLog]);

  // Mark dose taken with per-slot twice-daily tracking & double-dose lockout
  const markDoseTaken = useCallback(
    (medId, triggeredByRole = "Elder", slotLabel = null) => {
      const target = medications.find((m) => m.id === medId);
      if (!target) return;

      const currentTime = getCurrentTimeFormatted();
      const allSlots = Array.isArray(target.timeSlots) && target.timeSlots.length > 0
        ? target.timeSlots
        : ["08:00 AM"];
      const taken = Array.isArray(target.takenSlots) ? target.takenSlots : [];
      const untakenSlots = allSlots.filter((s) => !taken.includes(s));

      let chosenSlot = null;

      if (slotLabel) {
        // Specific slot requested
        if (taken.includes(slotLabel) || !allSlots.includes(slotLabel)) {
          chosenSlot = null; // Double dose attempt on already taken slot
        } else {
          chosenSlot = slotLabel;
        }
      } else {
        // General administration ("I Took This Pill" or "Confirm Dose Administered")
        // If already taken today and no untaken slots remain -> Double dose lockout!
        if (target.takenToday && untakenSlots.length === 0) {
          chosenSlot = null;
        } else if (untakenSlots.length > 0) {
          // Select next available untaken slot
          const effectiveNow = new Date(Date.now() + (clockOffsetMinutes || 0) * 60 * 1000);
          const effectiveMinutes = effectiveNow.getHours() * 60 + effectiveNow.getMinutes();
          const sortedUntaken = [...untakenSlots].sort((a, b) => {
            const distA = Math.abs(parseSlotToMinutes(a) - effectiveMinutes);
            const distB = Math.abs(parseSlotToMinutes(b) - effectiveMinutes);
            return distA - distB;
          });
          chosenSlot = sortedUntaken[0];
        } else {
          chosenSlot = null;
        }
      }

      // DOUBLE DOSE OVERDOSE LOCKOUT ENGAGED
      if (!chosenSlot) {
        const patientName = elderProfile?.name || "Patient";
        const alertObj = {
          medicationId: target.id,
          medicationName: target.name,
          dosage: target.dosage,
          lastTakenAt: target.lastTakenAt || "earlier today",
          triggeredAt: currentTime,
          message: `CRITICAL OVERDOSE WARNING: ${target.name} ${target.dosage} dose was already recorded today. Accidental duplicate dose blocked!`,
        };
        setDoubleDoseAlert(alertObj);

        // Audio synthesis warning using dynamic patient name
        if (
          typeof window !== "undefined" &&
          "speechSynthesis" in window &&
          window.speechSynthesis
        ) {
          try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(
              `Warning! ${patientName}, you have already taken your ${target.name} dose today. Please do not take another pill.`
            );
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
          } catch {
            // Speech synthesis failed or blocked by policy
          }
        }

        // Critical audit log
        addLog(
          triggeredByRole,
          "overdose-attempt",
          "critical",
          `BLOCKED ACCIDENTAL DOUBLE DOSE: ${target.name} ${target.dosage} already taken at ${target.lastTakenAt || "today"}`
        );

        // Stage 3 Urgent Email trigger using dynamic patient name
        triggerEscalatingEmail(3, {
          stage: "Stage 3: Accidental Double-Dose Overdose Warning",
          subject: `URGENT OVERDOSE ALERT: Repeated Dose Attempt for ${patientName}`,
          body: `Emergency Alert: An attempt was made to take ${target.name} ${target.dosage} a second time today at ${currentTime} (previously taken at ${target.lastTakenAt || "earlier"}). The system has locked out the dose. Please inspect ${patientName} immediately.`,
        });
        return;
      }

      // VALID DOSE: Record slot, decrement pill count, set lastTakenAt, set takenToday = true
      const updatedTakenSlots = [...taken, chosenSlot];
      const allSlotsComplete = updatedTakenSlots.length >= allSlots.length;

      setMedications((prev) =>
        prev.map((med) => {
          if (med.id === medId) {
            return {
              ...med,
              takenSlots: updatedTakenSlots,
              takenToday: true,
              allSlotsComplete,
              lastTakenAt: `${currentTime} (${chosenSlot})`,
              remainingPills: Math.max(0, (med.remainingPills || 1) - 1),
            };
          }
          return med;
        })
      );

      // Cancel pending missed alerts for this slot
      cancelSlotReminders(medId, chosenSlot);

      addLog(
        triggeredByRole,
        "dose",
        "normal",
        `Took ${target.name} ${target.dosage} (${chosenSlot} dose at ${currentTime})`
      );
    },
    [
      medications,
      elderProfile,
      clockOffsetMinutes,
      cancelSlotReminders,
      addLog,
      triggerEscalatingEmail,
    ]
  );

  // Skip a scheduled dose with clinical reason (Requirement 4)
  const skipDose = useCallback(
    (medId, triggeredByRole = "Elder", slotLabel = null, reason = "Felt unwell") => {
      const target = medications.find((m) => m.id === medId);
      if (!target) return;

      const currentTime = getCurrentTimeFormatted();
      const allSlots = Array.isArray(target.timeSlots) && target.timeSlots.length > 0
        ? target.timeSlots
        : ["08:00 AM"];
      const skipped = Array.isArray(target.skippedSlots) ? target.skippedSlots : [];
      const chosenSlot = slotLabel || allSlots.find((s) => !skipped.includes(s)) || allSlots[0];

      const updatedSkipped = [...skipped, chosenSlot];

      setMedications((prev) =>
        prev.map((med) => {
          if (med.id === medId) {
            return {
              ...med,
              skippedSlots: updatedSkipped,
            };
          }
          return med;
        })
      );

      // Cancel pending missed alerts for this slot
      cancelSlotReminders(medId, chosenSlot);

      // Log skip event
      addLog(
        triggeredByRole,
        "dose-skipped",
        "normal",
        `Skipped ${target.name} ${target.dosage} (${chosenSlot}) — Reason: ${reason}`
      );

      // Notify caretaker at normal priority (Requirement 4)
      const patientName = elderProfile.name || "Patient";
      triggerEscalatingEmail(2, {
        stage: "Stage 2: Dose Skipped Notification",
        priority: "normal",
        to: elderProfile.caretakerEmail,
        subject: `Dose Skipped by ${patientName}: ${target.name} (${chosenSlot})`,
        body: `${patientName} skipped the scheduled ${chosenSlot} dose of ${target.name} ${target.dosage}.\nReason: ${reason}.\nLogged at ${currentTime}. Pending missed alerts cancelled.`,
      });
    },
    [medications, elderProfile, addLog, triggerEscalatingEmail]
  );

  // Demo fast-forward clock offset controls (Requirement 6)
  const fastForwardClock = useCallback(
    (minutes = 60) => {
      setClockOffsetMinutes((prev) => prev + Number(minutes));
      addLog(
        "System",
        "clock-shift",
        "normal",
        `Fast-forwarded engine clock by +${minutes} minutes for demo testing`
      );
    },
    [addLog]
  );

  const resetClock = useCallback(() => {
    setClockOffsetMinutes(0);
    addLog("System", "clock-reset", "normal", "Reset engine clock to real-time");
  }, [addLog]);

  // Clear double dose alert modal
  const clearDoubleDoseAlert = useCallback(() => {
    setDoubleDoseAlert(null);
  }, []);

  // Add appointment — always generates unique UUID, ignores incoming id
  const addAppointment = useCallback((aptObj) => {
    const cleanDoc = sanitizeInput(aptObj.doctorName || "").trim().toLowerCase();
    const cleanDate = sanitizeInput(aptObj.date || "").trim();

    // Check for existing duplicate appointment by doctor + date
    const existingApt = appointments.find(
      (a) =>
        (a.doctorName || "").trim().toLowerCase() === cleanDoc &&
        (a.date || "").trim() === cleanDate
    );

    if (existingApt) {
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === existingApt.id
            ? {
                ...a,
                specialty: aptObj.specialty ? sanitizeInput(aptObj.specialty) : a.specialty,
                time: aptObj.time ? sanitizeInput(aptObj.time) : a.time,
                location: aptObj.location ? sanitizeInput(aptObj.location) : a.location,
                notes: aptObj.notes ? sanitizeInput(aptObj.notes) : a.notes,
              }
            : a
        )
      );
      addLog(
        "Calendar",
        "appointment-update",
        "normal",
        `Updated existing appointment with ${existingApt.doctorName} on ${existingApt.date}`
      );
      return;
    }

    const newApt = {
      id: generateUniqueId("apt"),
      doctorName: sanitizeInput(aptObj.doctorName),
      specialty: sanitizeInput(aptObj.specialty),
      date: sanitizeInput(aptObj.date),
      time: sanitizeInput(aptObj.time),
      location: sanitizeInput(aptObj.location),
      notes: sanitizeInput(aptObj.notes || ""),
      reminderSent: Boolean(aptObj.reminderSent),
    };

    setAppointments((prev) => [...prev, newApt]);
    addLog(
      "Calendar",
      "appointment",
      "normal",
      `Scheduled appointment with ${newApt.doctorName} on ${newApt.date}`
    );
  }, [appointments, addLog]);

  // Delete appointment — target computed first, addLog called separately outside setState updater
  const deleteAppointment = useCallback((id) => {
    const target = appointments.find((a) => a.id === id);
    const doc = target ? target.doctorName : id;
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    addLog("Calendar", "appointment-delete", "normal", `Cancelled appointment with ${doc}`);
  }, [appointments, addLog]);

  // Toggle appointment reminder
  const toggleAppointmentReminder = useCallback((id) => {
    setAppointments((prev) =>
      prev.map((apt) => {
        if (apt.id === id) {
          const updated = !apt.reminderSent;
          return { ...apt, reminderSent: updated };
        }
        return apt;
      })
    );
  }, []);

  // Reset demo data to pristine initial specification
  const resetDemoData = useCallback(() => {
    try {
      localStorage.removeItem("caresync_active_role");
      localStorage.removeItem("caresync_elder_profile");
      localStorage.removeItem("caresync_medications");
      localStorage.removeItem("caresync_appointments");
      localStorage.removeItem("caresync_logs");
      localStorage.removeItem("caresync_emails");
      localStorage.removeItem("caresync_latest_prescription");
      localStorage.removeItem("caresync_last_reset_date");
      localStorage.removeItem("caresync_caretaker_tasks");
      localStorage.removeItem("caresync_vitals_history");
      localStorage.removeItem("caresync_sent_reminder_keys");
    } catch {
      // ignore
    }
    const todayStr = getLocalDateString();
    setActiveRole("elder");
    setClockOffsetMinutes(0);
    setElderProfile(INITIAL_ELDER_PROFILE);
    setMedications(
      INITIAL_MEDICATIONS.map((m) => ({
        ...m,
        takenSlots: [],
        skippedSlots: [],
        takenToday: false,
        lastTakenAt: null,
      }))
    );
    setAppointments(INITIAL_APPOINTMENTS);
    setLogs(INITIAL_LOGS);
    setEmails(INITIAL_EMAILS);
    setDoubleDoseAlert(null);
    setLastResetDate(todayStr);
  }, []);

  const value = useMemo(
    () => ({
      activeRole,
      elderProfile,
      medications,
      appointments,
      logs,
      emails,
      doubleDoseAlert,
      adherenceScore,
      lowStockMedications,
      lastResetDate,
      clockOffsetMinutes,
      fastForwardClock,
      resetClock,
      skipDose,
      cancelSlotReminders,
      switchRole,
      addMedication,
      updateMedication,
      deleteMedication,
      restockMedication,
      markDoseTaken,
      clearDoubleDoseAlert,
      addAppointment,
      deleteAppointment,
      toggleAppointmentReminder,
      addLog,
      triggerEscalatingEmail,
      resetDemoData,
    }),
    [
      activeRole,
      elderProfile,
      medications,
      appointments,
      logs,
      emails,
      doubleDoseAlert,
      adherenceScore,
      lowStockMedications,
      lastResetDate,
      clockOffsetMinutes,
      fastForwardClock,
      resetClock,
      skipDose,
      switchRole,
      addMedication,
      updateMedication,
      deleteMedication,
      restockMedication,
      markDoseTaken,
      clearDoubleDoseAlert,
      addAppointment,
      deleteAppointment,
      toggleAppointmentReminder,
      addLog,
      triggerEscalatingEmail,
      resetDemoData,
    ]
  );

  return <CareContext.Provider value={value}>{children}</CareContext.Provider>;
}

export function useCare() {
  const context = useContext(CareContext);
  if (!context) {
    throw new Error("useCare must be used within a CareProvider");
  }
  return context;
}
