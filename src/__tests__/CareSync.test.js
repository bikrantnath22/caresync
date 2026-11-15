import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  verifyRolePin,
  resetPinLockout,
  sanitizeInput,
  validatePrescriptionFile,
  getStoredFailedAttempts,
  getLockoutExpiry,
} from "../utils/security.js";
import {
  checkDueReminders,
  parseSlotToDate,
  getLocalDateString,
} from "../services/reminderEngine.js";
import { parseElderVoiceCheckIn } from "../services/aiService.js";
import { tokenize } from "../services/voice/phonetics.js";
import { matchMedication } from "../services/voice/matcher.js";
import { extractSymptoms } from "../services/voice/intent.js";
import { buildSpokenResponse } from "../services/voice/responses.js";

// In-memory mock storage simulating persistent browser localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key)
      ? this.store[key]
      : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

// Attach mock localStorage and mock window to global scope
const mockLocalStorage = new LocalStorageMock();
globalThis.localStorage = mockLocalStorage;
globalThis.window = {
  localStorage: mockLocalStorage,
  speechSynthesis: {
    speak: () => {},
    cancel: () => {},
  },
};

// ============================================================================
// 1. PIN VERIFICATION & PERSISTENT RATE-LIMITING LOCKOUT TESTS
// ============================================================================
describe("Security: verifyRolePin & Persistent Lockout", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    resetPinLockout();
  });

  it("verifies valid PINs for all three authorized roles", () => {
    // Elder PIN 1111
    const elderRes = verifyRolePin("1111", "elder");
    expect(elderRes.success).toBe(true);
    expect(elderRes.role).toBe("elder");
    expect(elderRes.error).toBeNull();

    // Caretaker PIN 2222
    const caretakerRes = verifyRolePin("2222", "caretaker");
    expect(caretakerRes.success).toBe(true);
    expect(caretakerRes.role).toBe("caretaker");

    // Family PIN 3333
    const familyRes = verifyRolePin("3333", "family");
    expect(familyRes.success).toBe(true);
    expect(familyRes.role).toBe("family");
  });

  it("correctly infers role when no target role is specified", () => {
    const res = verifyRolePin("2222");
    expect(res.success).toBe(true);
    expect(res.role).toBe("caretaker");
  });

  it("fails verification for incorrect PINs and counts remaining attempts", () => {
    const res = verifyRolePin("9999", "elder");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Invalid PIN/i);
    expect(res.error).toContain("4 attempts remaining");
    expect(getStoredFailedAttempts()).toBe(1);
  });

  it("triggers 30-second security lockout after 5 consecutive failed attempts", () => {
    const originalDateNow = Date.now;
    const fakeNow = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(fakeNow);

    // Fail 4 times
    for (let i = 1; i <= 4; i++) {
      const res = verifyRolePin("0000", "elder");
      expect(res.success).toBe(false);
      expect(res.lockedUntil).toBeNull();
    }
    expect(getStoredFailedAttempts()).toBe(4);

    // 5th failed attempt triggers lockout
    const fifthRes = verifyRolePin("0000", "elder");
    expect(fifthRes.success).toBe(false);
    expect(fifthRes.error).toMatch(/locked for 30 seconds/i);
    expect(fifthRes.lockedUntil).toBe(fakeNow + 30000);

    // Subsequent attempt while locked out is rejected with active lockout notice
    const lockedRes = verifyRolePin("1111", "elder"); // Even correct PIN is blocked during lockout
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.error).toMatch(/Security lockout active/i);

    // After 31 seconds, lockout expires
    vi.spyOn(Date, "now").mockReturnValue(fakeNow + 31000);
    const recoveredRes = verifyRolePin("1111", "elder");
    expect(recoveredRes.success).toBe(true);
    expect(recoveredRes.role).toBe("elder");

    Date.now = originalDateNow;
  });

  it("persists lockout state in localStorage across simulated page reloads", () => {
    const fakeNow = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(fakeNow);

    // Cause lockout
    for (let i = 0; i < 5; i++) {
      verifyRolePin("0000", "caretaker");
    }

    // Verify localStorage has persisted the values
    expect(mockLocalStorage.getItem("caresync_pin_failed_attempts")).toBe("5");
    expect(mockLocalStorage.getItem("caresync_pin_lockout_expiry")).toBe(
      String(fakeNow + 30000)
    );

    // Calling verifyRolePin immediately honors the persisted lockout
    const res = verifyRolePin("2222", "caretaker");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Security lockout active/i);

    vi.restoreAllMocks();
  });
});

// ============================================================================
// 2. INPUT SANITIZATION TESTS
// ============================================================================
describe("Security: sanitizeInput", () => {
  it("preserves legitimate clinical comparison operators like 'BP < 90 and > 60'", () => {
    const clinicalNote = "BP < 90 and > 60";
    const sanitized = sanitizeInput(clinicalNote);
    expect(sanitized).toBe("BP < 90 and > 60");
  });

  it("strips malicious <script> tags and embedded executable scripts", () => {
    const attack = "<script>alert('xss');</script>Patient complains of fever";
    const sanitized = sanitizeInput(attack);
    expect(sanitized).toBe("Patient complains of fever");
    expect(sanitized).not.toContain("<script>");
  });

  it("strips HTML elements while retaining inner clinical text", () => {
    const input = "<strong>Metformin 500mg</strong> with <em>warm water</em>";
    const sanitized = sanitizeInput(input);
    expect(sanitized).toBe("Metformin 500mg with warm water");
  });

  it("strips inline DOM event handlers and javascript: URIs", () => {
    const inlineAttack = '<img src="x" onerror="stealCookies()">Take with food';
    const sanitized = sanitizeInput(inlineAttack);
    expect(sanitized).not.toContain("onerror");
    expect(sanitized).not.toContain("stealCookies");

    const jsUri = "javascript:alert(1)";
    expect(sanitizeInput(jsUri)).toBe("");
  });

  it("safely handles non-string inputs (null, undefined, numbers)", () => {
    expect(sanitizeInput(null)).toBe("");
    expect(sanitizeInput(undefined)).toBe("");
    expect(sanitizeInput(120)).toBe("120");
  });
});

// ============================================================================
// 3. PRESCRIPTION FILE VALIDATION TESTS
// ============================================================================
describe("Security: validatePrescriptionFile", () => {
  it("rejects missing or empty file input", () => {
    const res = validatePrescriptionFile(null);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/No prescription file selected/i);
  });

  it("accepts valid image/png, image/jpeg, and application/pdf files under 5MB", () => {
    const validPng = { type: "image/png", size: 1024 * 1024 }; // 1MB
    const validJpg = { type: "image/jpeg", size: 2 * 1024 * 1024 }; // 2MB
    const validPdf = { type: "application/pdf", size: 4 * 1024 * 1024 }; // 4MB

    expect(validatePrescriptionFile(validPng).valid).toBe(true);
    expect(validatePrescriptionFile(validJpg).valid).toBe(true);
    expect(validatePrescriptionFile(validPdf).valid).toBe(true);
  });

  it("rejects unauthorized MIME types", () => {
    const badExe = { type: "application/x-msdownload", size: 1024 };
    const badJs = { type: "text/javascript", size: 1024 };
    const badTxt = { type: "text/plain", size: 1024 };

    expect(validatePrescriptionFile(badExe).valid).toBe(false);
    expect(validatePrescriptionFile(badExe).error).toMatch(/Unsupported file type/i);

    expect(validatePrescriptionFile(badJs).valid).toBe(false);
    expect(validatePrescriptionFile(badTxt).valid).toBe(false);
  });

  it("rejects files exceeding the 5MB size ceiling", () => {
    const oversizedPdf = {
      type: "application/pdf",
      size: 5 * 1024 * 1024 + 1, // 5MB + 1 byte
    };
    const res = validatePrescriptionFile(oversizedPdf);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/exceeds the 5MB maximum limit/i);
  });
});

// ============================================================================
// 4. ADHERENCE & PER-SLOT DOUBLE-DOSE LOGIC TESTS
// ============================================================================
describe("Adherence Scoring & Per-Slot Double-Dose Protection", () => {
  function computeAdherence(medications, nowMinutes) {
    if (!medications || medications.length === 0) return 100;
    let dosesDue = 0;
    let dosesTaken = 0;

    medications.forEach((med) => {
      const slots =
        Array.isArray(med.timeSlots) && med.timeSlots.length > 0
          ? med.timeSlots
          : ["08:00 AM"];
      const taken = Array.isArray(med.takenSlots) ? med.takenSlots : [];

      slots.forEach((slot) => {
        const slotDate = parseSlotToDate(slot, new Date());
        const slotMin = slotDate.getHours() * 60 + slotDate.getMinutes();

        if (slotMin <= nowMinutes) {
          dosesDue += 1;
          if (taken.includes(slot)) {
            dosesTaken += 1;
          }
        } else if (taken.includes(slot)) {
          dosesDue += 1;
          dosesTaken += 1;
        }
      });
    });

    if (dosesDue === 0) return 100;
    return Math.min(100, Math.round((dosesTaken / dosesDue) * 100));
  }

  function evaluateDoseAction(med, requestedSlot = null) {
    const allSlots =
      Array.isArray(med.timeSlots) && med.timeSlots.length > 0
        ? med.timeSlots
        : ["08:00 AM"];
    const taken = Array.isArray(med.takenSlots) ? med.takenSlots : [];
    const untakenSlots = allSlots.filter((s) => !taken.includes(s));

    let chosenSlot = null;
    if (requestedSlot) {
      if (!taken.includes(requestedSlot)) {
        chosenSlot = requestedSlot;
      }
    } else if (untakenSlots.length > 0) {
      chosenSlot = untakenSlots[0];
    }

    if (!chosenSlot) {
      return {
        allowed: false,
        doubleDoseBlocked: true,
        reason: "Double-dose lockout: all slots already taken",
      };
    }

    return {
      allowed: true,
      chosenSlot,
      doubleDoseBlocked: false,
    };
  }

  it("calculates 100% adherence when no scheduled doses are due yet", () => {
    const medications = [
      { id: "1", name: "Metformin", timeSlots: ["08:00 AM"], takenSlots: [] },
      { id: "2", name: "Amlodipine", timeSlots: ["08:00 PM"], takenSlots: [] },
    ];
    // 06:00 AM (360 mins) — before any dose is due
    expect(computeAdherence(medications, 6 * 60)).toBe(100);
  });

  it("calculates exact adherence percentage as scheduled slots become due", () => {
    const medications = [
      { id: "1", name: "Metformin", timeSlots: ["08:00 AM"], takenSlots: ["08:00 AM"] },
      { id: "2", name: "Amlodipine", timeSlots: ["08:00 AM"], takenSlots: [] },
    ];
    // 10:00 AM — both 08:00 AM doses are due, 1 taken out of 2 due = 50%
    expect(computeAdherence(medications, 10 * 60)).toBe(50);

    // Mark second medication as taken -> 2 of 2 = 100%
    medications[1].takenSlots.push("08:00 AM");
    expect(computeAdherence(medications, 10 * 60)).toBe(100);
  });

  it("blocks duplicate dose attempts when slot is already taken (Double-Dose Lockout)", () => {
    const singleSlotMed = {
      id: "med-1",
      name: "Metformin",
      timeSlots: ["08:00 AM"],
      takenSlots: ["08:00 AM"],
      takenToday: true,
    };

    // Attempting to take Metformin again should be blocked
    const result = evaluateDoseAction(singleSlotMed);
    expect(result.allowed).toBe(false);
    expect(result.doubleDoseBlocked).toBe(true);
    expect(result.reason).toContain("Double-dose lockout");
  });

  it("allows taking the next untaken slot in multi-slot regimens without lockout", () => {
    const multiSlotMed = {
      id: "med-2",
      name: "Thyroxine",
      timeSlots: ["08:00 AM", "08:00 PM"],
      takenSlots: ["08:00 AM"],
      takenToday: false,
    };

    // 08:00 AM is taken, but 08:00 PM is untaken
    const result = evaluateDoseAction(multiSlotMed);
    expect(result.allowed).toBe(true);
    expect(result.chosenSlot).toBe("08:00 PM");
    expect(result.doubleDoseBlocked).toBe(false);

    // After recording 08:00 PM, all slots are filled
    multiSlotMed.takenSlots.push("08:00 PM");
    const blockedResult = evaluateDoseAction(multiSlotMed);
    expect(blockedResult.allowed).toBe(false);
    expect(blockedResult.doubleDoseBlocked).toBe(true);
  });
});

// ============================================================================
// 5. PROACTIVE REMINDER ENGINE WITH SIMULATED/FAKE CLOCK
// ============================================================================
describe("Reminder Engine: checkDueReminders with Simulated Clock", () => {
  const baseMedications = [
    {
      id: "med-metformin",
      name: "Metformin",
      dosage: "500mg",
      timeSlots: ["08:00 AM"],
      takenSlots: [],
      remainingPills: 15,
      mealInstruction: "After breakfast",
    },
    {
      id: "med-amlodipine",
      name: "Amlodipine",
      dosage: "5mg",
      timeSlots: ["08:00 PM"],
      takenSlots: [],
      remainingPills: 4, // Low refill alert trigger (<= 5)
      mealInstruction: "After dinner",
    },
  ];

  it("generates dose-upcoming reminder 15 minutes before slot time", () => {
    // 07:50 AM on 2026-11-15 (10 mins before 08:00 AM)
    const simulatedClock = new Date(2026, 10, 15, 7, 50, 0);

    const reminders = checkDueReminders({
      medications: baseMedications,
      appointments: [],
      now: simulatedClock,
      elderProfile: { name: "Rameshwar Nath" },
    });

    const upcoming = reminders.find((r) => r.type === "dose-upcoming");
    expect(upcoming).toBeDefined();
    expect(upcoming.dedupeKey).toBe("dose-upcoming-med-metformin-08:00 AM-2026-11-15");
    expect(upcoming.stage).toBe(1);
    expect(upcoming.subject).toContain("Upcoming Dose Reminder");
  });

  it("generates dose-missed-30 Stage 2 Caretaker alert 30 minutes after untaken slot", () => {
    // 08:35 AM (35 mins after 08:00 AM)
    const simulatedClock = new Date(2026, 10, 15, 8, 35, 0);

    const reminders = checkDueReminders({
      medications: baseMedications,
      appointments: [],
      now: simulatedClock,
      elderProfile: {
        name: "Rameshwar Nath",
        caretakerEmail: "caretaker@caresync.ai",
      },
    });

    const missed30 = reminders.find((r) => r.type === "dose-missed-30");
    expect(missed30).toBeDefined();
    expect(missed30.dedupeKey).toBe("dose-missed-30-med-metformin-08:00 AM-2026-11-15");
    expect(missed30.stage).toBe(2);
    expect(missed30.to).toBe("caretaker@caresync.ai");
    expect(missed30.body).toContain("30 minutes overdue");
  });

  it("generates dose-missed-60 Stage 3 Family Urgent alert 60 minutes after untaken slot", () => {
    // 09:15 AM (75 mins after 08:00 AM)
    const simulatedClock = new Date(2026, 10, 15, 9, 15, 0);

    const reminders = checkDueReminders({
      medications: baseMedications,
      appointments: [],
      now: simulatedClock,
      elderProfile: {
        name: "Rameshwar Nath",
        familyEmail: "family@caresync.ai",
      },
    });

    const missed60 = reminders.find((r) => r.type === "dose-missed-60");
    expect(missed60).toBeDefined();
    expect(missed60.dedupeKey).toBe("dose-missed-60-med-metformin-08:00 AM-2026-11-15");
    expect(missed60.stage).toBe(3);
    expect(missed60.priority).toBe("critical");
    expect(missed60.to).toBe("family@caresync.ai");
    expect(missed60.body).toContain("60 minutes");
    // Also contains pharmacy refill order link for low-stock Amlodipine (4 pills left)
    expect(missed60.body).toContain("https://pharmacy.caresync.ai/refill/med-amlodipine");
  });

  it("cancels missed-dose alerts when slot is marked taken or skipped", () => {
    // 09:15 AM (75 mins after 08:00 AM)
    const simulatedClock = new Date(2026, 10, 15, 9, 15, 0);

    // Scenario A: Taken slot
    const takenMeds = [
      {
        ...baseMedications[0],
        takenSlots: ["08:00 AM"],
        takenToday: true,
      },
    ];
    const remindersTaken = checkDueReminders({
      medications: takenMeds,
      now: simulatedClock,
    });
    expect(remindersTaken.find((r) => r.type === "dose-missed-30")).toBeUndefined();
    expect(remindersTaken.find((r) => r.type === "dose-missed-60")).toBeUndefined();

    // Scenario B: Skipped slot
    const skippedMeds = [
      {
        ...baseMedications[0],
        skippedSlots: ["08:00 AM"],
      },
    ];
    const remindersSkipped = checkDueReminders({
      medications: skippedMeds,
      now: simulatedClock,
    });
    expect(remindersSkipped.find((r) => r.type === "dose-missed-30")).toBeUndefined();
    expect(remindersSkipped.find((r) => r.type === "dose-missed-60")).toBeUndefined();
  });

  it("triggers refill warning for medications with 5 or fewer remaining pills", () => {
    const simulatedClock = new Date(2026, 10, 15, 12, 0, 0);
    const reminders = checkDueReminders({
      medications: baseMedications,
      now: simulatedClock,
    });

    const refillAlert = reminders.find(
      (r) => r.type === "refill" && r.medicationId === "med-amlodipine"
    );
    expect(refillAlert).toBeDefined();
    expect(refillAlert.subject).toContain("Low Stock Refill Alert");
    expect(refillAlert.body).toContain("4 pills left");
  });

  it("triggers 24-hour and 2-hour consultation appointment reminders", () => {
    const appointments = [
      {
        id: "apt-1",
        doctorName: "Dr. Arvind Sharma",
        specialty: "Cardiology",
        date: "2026-11-16",
        time: "10:00 AM",
        location: "Max Healthcare",
      },
    ];

    // 24 hours before (2026-11-15 at 12:00 PM — 22 hours prior)
    const clock24h = new Date(2026, 10, 15, 12, 0, 0);
    const reminders24h = checkDueReminders({
      medications: [],
      appointments,
      now: clock24h,
    });
    const apt24 = reminders24h.find((r) => r.type === "appointment-24h");
    expect(apt24).toBeDefined();
    expect(apt24.subject).toContain("Consultation Tomorrow");

    // 2 hours before (2026-11-16 at 08:30 AM — 1.5 hours prior)
    const clock2h = new Date(2026, 10, 16, 8, 30, 0);
    const reminders2h = checkDueReminders({
      medications: [],
      appointments,
      now: clock2h,
    });
    const apt2 = reminders2h.find((r) => r.type === "appointment-2h");
    expect(apt2).toBeDefined();
    expect(apt2.subject).toContain("Upcoming Consultation in 2 Hours");
  });
});

// ============================================================================
// 6. VOICE PARSER TESTS (SAMPLE, NO DIZZINESS, UNKNOWN MEDICINE)
// ============================================================================
describe("Voice Parsing & Clinical Safety Guardrails", () => {
  const patientMedications = [
    {
      id: "med-1",
      name: "Metformin",
      dosage: "500mg",
      timeSlots: ["08:00 AM"],
      takenSlots: [],
      takenToday: false,
      pillAppearance: "white round",
    },
    {
      id: "med-2",
      name: "Thyroxine",
      dosage: "50mcg",
      timeSlots: ["07:00 AM"],
      takenSlots: [],
      takenToday: false,
      pillAppearance: "small yellow round",
    },
  ];

  it("returns no match for arbitrary speech like 'sample'", async () => {
    const result = await parseElderVoiceCheckIn("sample", patientMedications);

    expect(result.matchedMedicationId).toBeNull();
    expect(result.confidenceTier).toBe("NONE");
    expect(result.shouldMarkTaken).toBe(false);
    expect(result.actions).toHaveLength(0);
  });

  it("negation safety: 'no dizziness' extracts ZERO symptoms", async () => {
    const text = "I took Metformin, no dizziness today";
    const result = await parseElderVoiceCheckIn(text, patientMedications, {
      lang: "en-IN",
      elderProfile: { name: "Rameshwar" },
    });

    // Medicine should match
    expect(result.matchedMedicationName.toLowerCase()).toBe("metformin");
    // Symptom must NOT be reported due to 3-token negation detection
    expect(result.symptomReported).toBeNull();
    expect(result.severity).toBe("normal");
    expect(result.emergency).toBe(false);
  });

  it("unknown medicine inquiry: states '<medicine> is not in your list'", async () => {
    const text = "When do I take Lipitor?";
    const result = await parseElderVoiceCheckIn(text, patientMedications, {
      lang: "en-IN",
      elderProfile: { name: "Rameshwar" },
    });

    // Lipitor is not in patientMedications
    expect(result.matchedMedicationId).toBeNull();
    // Deterministic voice response must state that it is not in their list
    expect(result.spokenResponse.toLowerCase()).toContain("not in your medicine list");
    expect(result.spokenResponse.toLowerCase()).toContain("lipitor");
  });

  it("extracts symptoms when not negated (e.g. 'I feel a little dizzy today')", async () => {
    const tokens = tokenize("I feel a little dizzy today");
    const extracted = extractSymptoms(tokens);

    expect(extracted.symptomReported).toBe("mild dizziness");
    expect(extracted.severity).toBe("high");
    expect(extracted.emergency).toBe(false);
  });
});
