# CareSync AI — 3-Minute Evaluator Click-by-Click Demo Script

This quick-start script guides evaluators and hackathon judges through a 3-minute walkthrough of CareSync AI's core capabilities, demonstrating cognitive accessibility, voice check-in, double-dose lockout, prescription AI, and proactive email escalation.

---

## ⏱️ Pre-Demo Setup (10 Seconds)

1. Open the application: [http://localhost:5173](http://localhost:5173) (or production URL).
2. Ensure browser audio is unmuted to hear the voice feedback and overdose alerts.
3. If running for the first time, click **"Allow Cloud AI & Voice"** on the privacy consent banner.

---

## 👵 Minute 1: Elder View & Voice Check-In (PIN `1111`)

*Target: Cognitive accessibility (WCAG AAA), bilingual voice logging, overdose lockout, and emergency SOS.*

1. **Verify Accessible Light UI**:
   - Notice the high-contrast light theme, extra-large typography (`18px–28px`), and live **Adherence Score Badge** in the header.
2. **Test Bilingual Voice Check-In ("Zero-UI")**:
   - Scroll to the **"Elder Voice Check-In"** banner.
   - Click the test button: **`English Demo (Dizziness)`**.
   - *Result*: The system transcribes the speech, marks Metformin as taken, speaks a reassuring audio confirmation, logs a mild dizziness symptom, and alerts the caretaker.
3. **Test Voice Negation Safety**:
   - Click the test button: **`Test: No Dizziness (Negation Safe)`**.
   - *Result*: The system detects that dizziness was preceded by "no", marks the dose taken, and reports **zero** symptoms.
4. **Test Unknown Medicine Rejection**:
   - Click the test button: **`Test: Lipitor (Not in List)`**.
   - *Result*: The system deterministically responds: *"Lipitor is not in your medicine list. Please ask your caretaker."* (Zero clinical hallucination).
5. **Test Double-Dose Overdose Lockout**:
   - Look at the **Metformin** card (now marked as taken).
   - Click the red button: **`Test Accidental 2nd Dose (Lockout Demo)`**.
   - *Result*: A full-screen emergency red modal blocks the screen, an urgent audio warning speaks (`"STOP! Rameshwar, you already took this medicine today!"`), a critical audit log is saved, and a Stage 3 emergency email is fired.
   - Click **"I Understand — Close Alert"** to dismiss the modal.
6. **Test Medicine Card Skip with Reason**:
   - On an untaken medicine card (e.g. **Amlodipine**), click **`Skip Dose`**.
   - Select reason: **`Felt unwell / nausea`** and confirm.
   - *Result*: Dose is marked skipped, logged for the caretaker, and cancelled from missed-dose alerts.
7. **Test Emergency SOS**:
   - Click the pulsing red **`EMERGENCY SOS`** button in the top-right banner.
   - Confirm the emergency dispatch.
   - *Result*: Immediate broadcast to family and caretaker; emergency contact numbers **112** and **102** are presented with direct dial links.

---

## 👩‍⚕️ Minute 2: Caretaker Shift Station & Prescription AI (PIN `2222`)

*Target: Shift dose tracking, vitals intake, prescription OCR vision, and 12-hour handover.*

1. **Switch Role**:
   - In the navigation bar, click the **`Caretaker (2222)`** pill.
2. **Log Vitals & Shift Observations**:
   - Scroll to the **"Shift Observation & Vitals Log"** section.
   - Enter:
     - Blood Pressure: `126/82`
     - Blood Sugar: `112`
     - Heart Rate: `74`
     - Shift Notes: `Patient in good spirits, completed 15-minute garden walk.`
   - Click **`Record Clinical Observations`**.
   - *Result*: Instant clinical triage badge (**Normal** range) appears and records to the permanent audit trail.
3. **Prescription Uploader & Interaction Screening**:
   - In the **"Upload New Prescription"** section, click **`Load Sample Prescription (1-Click Demo)`**.
   - *Result*: Google Gemini multimodal vision OCR extracts:
     - **Atorvastatin 20mg** (with food warning: *Avoid grapefruit juice*).
     - **Aspirin 75mg** with high-visibility red conflict alert:
       > 🚨 **CRITICAL INTERACTION**: Combining Aspirin 75mg with existing Warfarin 5mg dramatically escalates internal bleeding risk!
     - Auto-detected follow-up consultation with **Dr. R. Baruah** (14 days ahead).
   - Click **`Approve & Sync Ecosystem`** to merge into patient care records.
4. **Generate AI 12-Hour Shift Handover**:
   - Scroll to the Clinical Reports section and click **`Generate 12h Shift Handover`**.
   - *Result*: Instant 4-bullet clinical handover synthesized strictly from verified logs, listing real adherence score, skipped doses, and next shift instructions.

---

## 👨‍👩‍👧 Minute 3: Family Administration, Proactive Escalations & Doctor PDF (PIN `3333`)

*Target: Regimen CRUD, restock, printable doctor preparation brief, and time-travel email escalation.*

1. **Switch Role**:
   - In the navigation bar, click the **`Family (3333)`** pill.
2. **Medication Management & Low-Stock Restock**:
   - Under the **"Active Medications"** tab, notice the low-stock alert on **Warfarin** (only 4 pills left).
   - Click **`Restock (+30)`**.
   - *Result*: Warfarin count instantly increments to 34 pills, clearing the refill warning.
3. **Printable Doctor Visit Preparation Brief**:
   - Click the **`Reports`** tab in Family Dashboard.
   - Click **`Open Doctor Preparation Brief`**.
   - *Result*: A formatted clinical summary modal opens with adherence trends, active medication lists, and recorded symptoms.
   - Click **`Print / Save PDF`** to trigger the browser's native print preview.
4. **Proactive Reminder Engine & Time-Travel Demo**:
   - Click the **`Emails`** tab to view the **Email Notification Center**.
   - Observe the **Live Sent Emails Inbox** drawer listing all real-time emails triggered during the session (SOS, overdose attempt).
   - Now, locate the demo clock control in the navigation bar or top banner: click **`Fast-forward 1 hour`**.
   - *Result*: The reminder engine clock leaps forward 60 minutes:
     - Scheduled doses that were untaken now become 30 and 60 minutes overdue.
     - Look at the live email inbox: **Stage 2 (Caretaker 30m Overdue)** and **Stage 3 (Family 60m Critical)** emails have automatically generated!
     - Click to expand the Stage 3 email: notice the auto-embedded **1-Click Pharmacy Refill Link** (`https://pharmacy.caresync.ai/refill/...`).
   - Click **`Reset (+0m)`** to return to real-world time.

---

## 🏁 Evaluation Summary Checklist

- [x] **Role Switching & PIN Lockout**: Salted 4-digit PINs (`1111`, `2222`, `3333`) with 30s lockout after 5 failed attempts.
- [x] **Cognitive Accessibility**: WCAG AAA high contrast, large typography (`18px–28px`), zero complex navigation.
- [x] **Voice Check-In**: Web Speech STT, phonetic matcher, negation safety, and deterministic TTS audio output.
- [x] **Double-Dose Prevention**: Per-slot lockout blocking duplicate doses with audio alert and critical escalation.
- [x] **Clinical Guardrails**: Dual-layer screening detecting severe Warfarin + Aspirin bleeding risk and food rules.
- [x] **Escalating Reminders**: 15m upcoming, 30m caretaker alert, 60m family escalation with refill links, and appointment alerts.
- [x] **Shift Handover & PDF**: 4-bullet handover synthesis and 1-click printable doctor brief.
- [x] **Clean Production Code**: Zero `console.log`, zero `eval()`, zero `dangerouslySetInnerHTML`, 28/28 unit tests passing.
