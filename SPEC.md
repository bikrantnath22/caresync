# CareSync AI — Master Architecture & Rubric Specification (`SPEC.md`)

> **CRITICAL AGENT INSTRUCTION (READ BEFORE EVERY TASK):**
> This file is the **Single Source of Truth** for **CareSync AI: Elderly Care & Medication Management Platform** (PromptWars x Catalyst Challenge).
> Every file, component, function signature, and data schema MUST strictly follow this specification. Never invent conflicting prop names, file paths, or state keys.

---

## 1. Evaluation Rubric & Automated Grader Targets (100% Score + Leaderboard)
Your code is evaluated by both an **Automated Code Assessment Scanner** (Live Leaderboard) and **Final Judges**:
1. **Implementation (20%) & Problem-Solution Alignment (20%):** Shared ecosystem where elderly users, caretakers, and family members manage profiles via secure passcode-based access (`1111`, `2222`, `3333`), schedule/edit medications, track adherence, monitor doctor appointments, and send proactive email reminders.
2. **Functionality (20%):** End-to-end working Prescription File Upload (with 1-click Demo Sample), AI Drug-Drug & Food-Drug Interaction Guardrails, Voice Check-In, Double-Dose Overdose Lockout, Low-Refill Tracker, 3-Stage Escalating Email Simulator, AI Shift-Handover, and Printable Doctor Visit Brief.
3. **UI/UX & Accessibility (15% + Automated a11y Grader):** Responsive mobile/desktop Tailwind design, WCAG AAA high-contrast Elder View (`18px-24px` typography), semantic HTML5 landmarks (`<header>`, `<nav>`, `<main>`, `<section>`), explicit `aria-label` on all buttons/inputs, and `role="alert"` / `aria-live="assertive"` on critical modals.
4. **Security & Efficiency (Automated Leaderboard Grader):**
   - Zero hardcoded API keys (`import.meta.env.VITE_GEMINI_API_KEY` only).
   - Zero `eval()`, `dangerouslySetInnerHTML`, or `console.log` statements in production code.
   - Input XSS sanitization, PIN rate-limiting, and strict file upload validation (`src/utils/security.js`).
   - Memoized state selectors and handlers (`useMemo`, `useCallback`, `React.memo`).
5. **Deployment & Completeness (10% — Zero-DQ Rule):** Wrapped in `ErrorBoundary.jsx` so the app can NEVER crash to a white screen, plus SPA routing rules (`vercel.json` and `public/_redirects`) so refreshes never 404.
6. **Testing & GitHub Repository (5% + Automated Test Grader):** Runnable unit test suite (`src/__tests__/CareSync.test.js`) and comprehensive documentation (`README.md` + `.env.example`).

---

## 2. Exact Project File Structure
Maintain this exact directory tree. Do not create duplicate files outside these paths:

```text
├── public/
│   └── _redirects                      # SPA fallback for Netlify: /* /index.html 200
├── src/
│   ├── main.jsx                        # Wraps <App/> in <ErrorBoundary> and <CareProvider>
│   ├── App.jsx                         # Role router + Floating Judge's Quick-Test Bar
│   ├── index.css                       # Tailwind directives + print & high-contrast rules
│   ├── utils/
│   │   └── security.js                 # XSS sanitizer, PIN hash verifier + rate limiter, file validator
│   ├── context/
│   │   └── CareContext.jsx             # Master state + localStorage sync + memoized CRUD actions
│   ├── services/
│   │   └── aiService.js                # Gemini API calls + 100% reliable deterministic JSON fallbacks
│   ├── components/
│   │   ├── ErrorBoundary.jsx           # Prevents white-screen crashes + 1-click state recovery
│   │   ├── Navbar.jsx                  # Adherence badge, PIN modal trigger & 1-click role switch pills
│   │   ├── PasscodeGate.jsx            # Accessible 4-digit PIN keypad modal (1111, 2222, 3333)
│   │   ├── ElderDashboard.jsx          # PIN 1111: Giant cards, Voice Check-In, Double-Dose Lockout
│   │   ├── CaretakerDashboard.jsx      # PIN 2222: Shift checklist, Vitals logger, Rx Uploader, Handover
│   │   ├── FamilyDashboard.jsx         # PIN 3333: Full Med/Appointment CRUD, Refill alerts, Email Center
│   │   ├── PrescriptionUploader.jsx    # File upload + 1-Click Sample Rx -> Ecosystem Auto-Sync
│   │   ├── EmailNotificationCenter.jsx # 3-Stage Escalating Email Simulator + Live Inbox Preview Drawer
│   │   └── ClinicalReports.jsx         # AI 12-Hour Shift Handover + Printable Doctor Visit Brief
│   └── __tests__/
│       └── CareSync.test.js            # Automated unit tests for security, lockout, interactions & emails
├── .env.example                        # Documents VITE_GEMINI_API_KEY
├── vercel.json                         # SPA rewrite rule for Vercel deployment
└── README.md                           # Architecture, rubric alignment table, passcodes & setup guide


3. Exact Data Schemas (src/context/CareContext.jsx)
All components MUST consume and update state via const { ... } = useCare() using these exact property names:

3.1 elderProfile (Object)
JSON
{
  "name": "Rameshwar Nath",
  "age": 74,
  "bloodGroup": "O+",
  "conditions": ["Hypertension", "Type 2 Diabetes", "Atrial Fibrillation"],
  "allergies": ["Penicillin", "Sulfa Drugs"],
  "primaryDoctor": "Dr. A. K. Sharma (Cardiologist)",
  "caretakerEmail": "caretaker.shift@caresync.ai",
  "familyEmail": "family.admin@caresync.ai"
}
3.2 medications (Array of Objects)
JSON
[
  {
    "id": "med-1",
    "name": "Metformin",
    "dosage": "500mg",
    "frequency": "Twice Daily (1-0-1)",
    "timeSlots": ["08:00 AM", "08:00 PM"],
    "mealInstruction": "Take 15 mins after breakfast and dinner",
    "pillAppearance": "Round White Pill",
    "remainingPills": 14,
    "takenToday": false,
    "lastTakenAt": null,
    "interactionWarning": null,
    "foodRule": "Take with meals to prevent stomach upset; avoid excessive alcohol."
  },
  {
    "id": "med-2",
    "name": "Warfarin",
    "dosage": "5mg",
    "frequency": "Once Daily (0-0-1)",
    "timeSlots": ["06:00 PM"],
    "mealInstruction": "Take with evening water",
    "pillAppearance": "Pink Oval Pill",
    "remainingPills": 4,
    "takenToday": false,
    "lastTakenAt": null,
    "interactionWarning": "CRITICAL: High bleeding risk if combined with Aspirin or NSAIDs.",
    "foodRule": "Keep daily Vitamin K intake (spinach, leafy greens) consistent."
  }
]
3.3 appointments (Array of Objects)
JSON
[
  {
    "id": "apt-1",
    "doctorName": "Dr. A. K. Sharma",
    "specialty": "Cardiology & INR Review",
    "date": "2026-11-22",
    "time": "10:30 AM",
    "location": "City Heart Clinic, Room 204",
    "notes": "Bring 30-day medication adherence brief and blood pressure log.",
    "reminderSent": false
  }
]
3.4 logs (Array of Objects)
JSON
[
  {
    "id": "log-1",
    "timestamp": "08:05 AM",
    "role": "Elder",
    "type": "dose",
    "severity": "normal",
    "message": "Took Metformin 500mg (Morning Dose)"
  }
]
3.5 emails (Array of Sent/Simulated Email Objects)
JSON
[
  {
    "id": "email-1",
    "timestamp": "08:30 AM",
    "stage": "Stage 2: Caretaker Missed-Dose Alert",
    "priority": "high",
    "to": "caretaker.shift@caresync.ai",
    "subject": "ACTION REQUIRED: Missed 08:00 AM Dose for Rameshwar Nath",
    "body": "Rameshwar Nath has not logged his 08:00 AM Metformin 500mg dose (30 mins overdue). Please verify adherence."
  }
]
3.6 Required Context Exports (useCare())
CareContext.jsx must export:

State: activeRole ("elder" | "caretaker" | "family"), elderProfile, medications, appointments, logs, emails, doubleDoseAlert (object or null).

Computed (useMemo): adherenceScore (0–100 integer), lowStockMedications (meds where remainingPills <= 5).

Actions (useCallback):

switchRole(role, pin)

addMedication(medObj)

updateMedication(id, updatedFields)

deleteMedication(id)

restockMedication(id, amount = 30)

markDoseTaken(medId, triggeredByRole = "Elder") -> IMPORTANT: If med.takenToday === true, do NOT decrement remainingPills; instead set doubleDoseAlert, log a "critical" event, and automatically trigger a Stage 3 Urgent Email!

clearDoubleDoseAlert()

addAppointment(aptObj)

deleteAppointment(id)

toggleAppointmentReminder(id)

addLog(role, type, severity, message)

triggerEscalatingEmail(stageType, customDetails)

resetDemoData()

4. Exact Utility & Service Function Signatures
4.1 Security Utility (src/utils/security.js)
sanitizeInput(str):

Strips <script>, HTML tags (/<[^>]*>?/gm), and dangerous attributes, returning a safe trimmed string.

verifyRolePin(inputPin, targetRole):

Validates 4-digit numeric format (/^\d{4}$/). Tracks failed attempts and locks out for 30 seconds after 5 failed attempts.

Maps "elder" -> "1111", "caretaker" -> "2222", "family" -> "3333" using salted/obfuscated hash comparison rather than raw strings.

(Alias export verifyPasscode = verifyRolePin so both names work seamlessly across tests).

Returns { success: boolean, role: string | null, error: string | null, lockedUntil: number | null }.

validatePrescriptionFile(file):

Checks strict allowlist (image/png, image/jpeg, image/jpg, application/pdf) and enforces file.size <= 5 * 1024 * 1024 (5MB).

(Alias export validateFileUpload = validatePrescriptionFile so both names work seamlessly across tests).

Returns { valid: boolean, error: string | null }.

4.2 AI Service (src/services/aiService.js)
Every function MUST try fetch to Gemini (import.meta.env.VITE_GEMINI_API_KEY) and always catch/fallback to a deterministic, realistic JSON payload so the app never fails offline or without an API key:

parsePrescriptionAndCheckInteractions(fileMeta, existingMedications, elderProfile):

Returns { extractedMedications: [...], interactionWarnings: [...], extractedAppointment: {...} }.

Default fallback extracts:

Atorvastatin 20mg (09:00 PM, After Dinner, 30 pills, Food Rule: "Avoid grapefruit juice; increases muscle toxicity risk").

Aspirin 75mg (01:00 PM, After Lunch, 15 pills, Interaction Warning: "SEVERE CONFLICT: Combining Aspirin 75mg with existing Warfarin 5mg significantly increases internal bleeding risk").

Follow-up Appointment: Dr. R. Baruah (Endocrinology & Lipid Review), Date: 14 days from today, Time: 11:00 AM, Notes: "Auto-extracted from prescription footer: Review lipid profile & blood sugar in 2 weeks".

parseElderVoiceCheckIn(transcript, medications):

Parses spoken input (e.g., "I took my morning Metformin pill, and I feel a little dizzy today").

Returns { matchedMedicationId: "med-1", matchedMedicationName: "Metformin", symptomReported: "Patient reported mild dizziness after morning dose", severity: "high", spokenResponse: "Good morning Rameshwar. I have marked your morning Metformin as taken and notified your caretaker that you are feeling a little dizzy. Please sit down and drink some water." }.

generateClinicalBrief(medications, logs, appointments, elderProfile):

Returns { shiftHandoverBullets: [string, string, string, string], doctorVisitSummary: { adherenceRate, criticalAlerts, activeInteractions, symptomTimeline, recommendation } }.

5. Component-Level Functional Requirements
5.1 Navbar.jsx & PasscodeGate.jsx
Display CareSync AI logo, patient name (Rameshwar Nath, 74y), blood group badge (O+), and live adherenceScore badge.

Provide Quick Role Switch Buttons (Elder (1111), Caretaker (2222), Family Admin (3333)) for 1-click judge testing AND a "PIN Lock Modal" button so judges can test the keypad security gate (PasscodeGate.jsx).

5.2 ElderDashboard.jsx (PIN 1111)
WCAG AAA High-Contrast UI: Large typography (text-xl to text-3xl), high-contrast cards, zero complex menus.

Giant Voice Check-In Banner: Single-tap microphone button (SpeechRecognition / webkitSpeechRecognition) + a "Simulate Voice Check-In (Demo)" button.

Medication Cards & Double-Dose Lockout:

Large "I Took This Pill" button (aria-label).

Once taken, displays "Taken Today at [lastTakenAt]" and a secondary "Test Accidental 2nd Dose (Lockout Demo)" button.

Clicking a taken dose triggers the Full-Screen Red Overdose Lockout Modal (role="alert", aria-live="assertive"), speaks an audio warning via window.speechSynthesis, logs a critical alert, and sends an immediate Stage 3 emergency email.

5.3 PrescriptionUploader.jsx (Used in Caretaker & Family Views)
Drag-and-drop file input (accept=".png,.jpg,.jpeg,.pdf") validated by validatePrescriptionFile.

Prominent "Load Sample Prescription (1-Click Demo)" button.

Displays extracted preview cards with high-visibility red/amber Drug-Drug & Food-Drug Interaction Guardrails and the auto-detected follow-up appointment.

Clicking "Approve & Sync Ecosystem" adds the medications, interaction flags, and appointment into CareContext.

5.4 EmailNotificationCenter.jsx
Interactive 3-Stage Escalating Email Trigger Panel:

"Stage 1: Upcoming Dose & Appointment Reminder"

"Stage 2: 30m Missed Dose -> Caretaker Alert Email"

"Stage 3: 60m Critical Missed Dose + Low Refill Link -> Family Urgent Email"

Automatically embeds a 1-Click Pharmacy Refill Reorder Link in the email body for any medication in lowStockMedications (remainingPills <= 5, such as Warfarin).

Includes a Live Sent Email Inbox Preview showing formatted HTML emails (To, Subject, Timestamp, Stage Badge, Body) right inside the dashboard.

5.5 ClinicalReports.jsx
AI 12-Hour Caretaker Shift Handover: Generates a 4-bullet summary of adherence, missed doses, voice-reported symptoms (dizziness), and upcoming tasks.

1-Click Printable Doctor Visit Brief: Opens a structured clinical report modal with a working "Print / Save PDF" (window.print()) button.

6. Automated Code Assessment & Leaderboard Rubric Rules (MANDATORY)
The platform uses an automated grader evaluating Code Quality, Security, Efficiency, Testing, Accessibility, and Problem Statement Alignment. Every file you generate MUST obey these rules:

Accessibility (WCAG AAA & ARIA Compliance):

Use semantic HTML5 tags (<header>, <nav>, <main>, <section>, <article>, <footer>).

Every interactive element (<button>, <input>, <select>) MUST have an explicit aria-label and id.

Alert modals and voice status banners MUST include role="alert" or aria-live="assertive".

All images/icons must have alt attributes or aria-hidden="true".

Security Best Practices:

NEVER hardcode API keys or secrets. Always access via import.meta.env.VITE_GEMINI_API_KEY or import.meta.env.VITE_EMAIL_WEBHOOK_URL.

Implement src/utils/security.js containing:

sanitizeInput(str): Strips HTML tags and prevents XSS injection on all form inputs.

verifyRolePin(inputPin, targetRole) (and alias verifyPasscode): Validates 4-digit numeric format (/^\d{4}$/), enforces rate-limiting (locks after 5 failed attempts for 30 seconds), and compares against salted role hashes rather than raw strings.

validatePrescriptionFile(file) (and alias validateFileUpload): Checks strict allowlist (image/png, image/jpeg, application/pdf) and enforces file.size <= 5 * 1024 * 1024 (5MB).

Never use eval(), dangerouslySetInnerHTML, or unvalidated window.open().

Efficiency & Code Quality:

Wrap expensive derived state (adherence percentage, filtered schedules, drug interaction checks) in useMemo and event handlers in useCallback.

Remove all debugging console.log statements. Use a clean JSDoc header on every exported function and component.

Wrap the entire application in src/components/ErrorBoundary.jsx so the deployed production build can NEVER crash to a white screen (preventing Top-10 disqualification).

Automated Testing Suite (src/__tests__/CareSync.test.js):

Include a complete, runnable Vitest test suite covering:

Passcode authentication & rate-limit lockout (verifyRolePin / verifyPasscode).

Input sanitization & file upload validation (sanitizeInput, validatePrescriptionFile).

Medication adherence calculation & Double-Dose Overdose Lockout logic.

Automated drug-interaction detection & escalating email queue generation.

Hardening & Deployment Tasks Checklist:

Audit all components for semantic HTML (<main>, <header>, <nav>, <section>), aria-label, and aria-live="assertive".

Add vercel.json and public/_redirects for SPA routing so the production deployment URL works on every refresh without 404 errors.

Add .env.example and a comprehensive README.md mapping every problem statement requirement to the built features.