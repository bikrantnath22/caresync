# CareSync AI — Elderly Care & Clinical Medication Safety Platform

CareSync AI is an accessible, bilingual, clinical-grade medication management and adherence web platform designed for elderly polypharmacy patients and their care circles. Specifically tailored for 74-year-old patient Rameshwar Nath (managing Hypertension, Type 2 Diabetes, and Atrial Fibrillation), CareSync AI bridges the gap between elderly patients, rotating shift caretakers, and remote family members.

Built with **React 18**, **Vite 5**, and **Tailwind CSS**, CareSync AI prioritizes patient safety, zero clinical hallucination, and cognitive accessibility (WCAG AAA standards).

---

## 🩺 The Problem

Elderly polypharmacy patients face critical health and safety vulnerabilities:
1. **Accidental Double-Dosing & Overdose**: Cognitive decline and memory gaps often cause seniors to forget they took a pill earlier, leading to fatal overdoses (e.g. repeated doses of blood thinners like Warfarin or antihypertensives like Amlodipine).
2. **Harmful Drug-Drug & Food-Drug Interactions**: New prescriptions written during brief outpatient visits frequently clash with existing regimens (e.g. co-prescribing Aspirin with Warfarin dramatically escalates internal hemorrhage risk; grapefruit juice triggers statin toxicity).
3. **Complex Multi-Dose Regimens**: Seniors struggle with tiny pill bottles, confusing instructions ("1-0-1", "take with meals"), and complex smartphone interfaces with tiny fonts.
4. **Care Circle Disconnect**: Shift caretakers lack instant access to what happened during the previous shift, while remote family members only discover missed doses days later when complications occur.
5. **Delayed Escalation**: When a dose is missed, there is often no progressive alerting mechanism to notify caretakers first, then family members, and finally emergency contacts.

**CareSync AI** solves this with a role-partitioned, voice-enabled, guardrail-protected clinical ecosystem operating seamlessly online or offline.

---

## 📋 Challenge Sentence-to-Feature Mapping Table

The following table maps every core requirement and sentence of the challenge specification directly to the implemented feature and primary code artifact:

| # | Challenge Requirement / Text | Built Feature | Implementation File(s) |
|---|-----------------------------|---------------|------------------------|
| 1 | **Shared Ecosystem with Passcode Access**<br>"Shared ecosystem where elderly users, caretakers, and family members manage profiles via secure passcode-based access (`1111`, `2222`, `3333`)." | Salted 4-digit PIN authentication with persistent 30s rate-limiting lockout after 5 failed attempts, role-based screen routing, and 1-click evaluator quick-switch bar. | [PasscodeGate.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/PasscodeGate.jsx)<br>[security.js](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/utils/security.js)<br>[Navbar.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/Navbar.jsx) |
| 2 | **WCAG AAA Cognitive Accessibility & High-Contrast Elder View**<br>"Accessible cognitive interface designed for elderly patient with large typography and zero complex menus." | WCAG AAA compliant light-theme layout, high-contrast text (`#0f172a`), oversized font sizes (`18px–28px`), giant touch targets ($\ge 48$px), and screen-reader `role="alert"` live regions. | [ElderDashboard.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/ElderDashboard.jsx)<br>[index.css](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/index.css) |
| 3 | **Bilingual Voice Check-In ("Zero-UI")**<br>"Bilingual Voice Check-In in Hindi & English with natural speech recognition and deterministic responses." | Web Speech API speech-to-text, phonetic matcher with dialect variants, negation safety ("no dizziness" records 0 symptoms), and deterministic synthesized voice responses (`SpeechSynthesis`). | [ElderDashboard.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/ElderDashboard.jsx)<br>[intent.js](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/services/voice/intent.js)<br>[matcher.js](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/services/voice/matcher.js)<br>[responses.js](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/services/voice/responses.js) |
| 4 | **Double-Dose Overdose Lockout Protection**<br>"Prevent accidental double doses: if a dose was already recorded today, block intake with full-screen lockout and audio warning." | Per-slot intake locking. If an already-taken slot is clicked, an immediate full-screen red warning modal locks the screen, plays a high-volume audio warning, logs a critical audit entry, and fires a Stage 3 emergency email. | [DoubleDoseModal.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/DoubleDoseModal.jsx)<br>[CareContext.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/context/CareContext.jsx) |
| 5 | **Elder Control: Taken / Snooze / Skip with Reason**<br>"Elder screen shows Time for `<medicine>` card with buttons Taken / Snooze 10 min / Skip with reason." | Prominent interactive medicine callout with 1-tap "Taken", "Snooze 10m" timer, and "Skip" with clinical reasons (felt unwell, ran out, doctor advised) which logs normally and cancels pending missed alerts. | [ElderDashboard.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/ElderDashboard.jsx)<br>[CareContext.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/context/CareContext.jsx) |
| 6 | **Emergency SOS Button**<br>"SOS button on elder screen: confirm tap -> critical email to family and caretaker, and show emergency numbers 112 and 102." | 2-step confirmation SOS modal that broadcasts immediate critical emergency alerts to caretaker & family inboxes while displaying direct call buttons for 112 (National Emergency) and 102 (Ambulance). | [ElderDashboard.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/ElderDashboard.jsx)<br>[CareContext.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/context/CareContext.jsx) |
| 7 | **Prescription File Upload & OCR Extraction**<br>"File upload (PNG/JPG/PDF) with 1-click sample demo, AI interaction screening, and auto-sync to ecosystem." | Drag-and-drop file uploader with 5MB validation, Google Gemini multimodal vision OCR with 100% reliable deterministic fallback, extracting Atorvastatin, Aspirin, and Dr. Baruah follow-up appointment. | [PrescriptionUploader.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/PrescriptionUploader.jsx)<br>[aiService.js](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/services/aiService.js)<br>[security.js](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/utils/security.js) |
| 8 | **Dual-Layer Drug-Drug & Food-Drug Interaction Guardrails**<br>"Detect severe drug conflicts (e.g. Warfarin + Aspirin) and food rules (grapefruit juice, vitamin K)." | Deterministic rule engine (`interactionRules.js`) + AI multimodal screening highlighting critical bleeding risks (Warfarin + Aspirin) and dietary guidelines (Atorvastatin avoid grapefruit; Warfarin consistent Vitamin K). | [interactionRules.js](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/utils/interactionRules.js)<br>[PrescriptionUploader.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/PrescriptionUploader.jsx) |
| 9 | **Proactive Reminder Engine & Escalating Alerts**<br>"Pure function reminder engine: upcoming (15 min), missed-30 (caretaker Stage 2), missed-60 (family Stage 3 with refill links), appointment (24h, 2h), and low-refill." | Pure deterministic engine evaluating snapshots with unique `dedupeKey`s persisted in `localStorage` to prevent duplicate emails across reloads; automatic 30s background evaluation hook. | [reminderEngine.js](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/services/reminderEngine.js)<br>[App.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/App.jsx) |
| 10 | **Caretaker Shift Station & Vitals Logger**<br>"Caretaker dashboard: today's doses per slot with Mark taken, vitals log (BP, sugar, pulse, notes), and handover section." | Complete shift station featuring interactive checklist, vital sign intake with clinical range categorization (Normal/Elevated/High), and integrated prescription uploader. | [CaretakerDashboard.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/CaretakerDashboard.jsx)<br>[CareContext.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/context/CareContext.jsx) |
| 11 | **AI 12-Hour Shift Handover Brief**<br>"Generate 4-bullet clinical handover brief synthesized from real regimen adherence, safety logs, and upcoming priorities." | Zero-hallucination clinical brief derived strictly from real state logs: adherence rate, missed doses, recorded vitals/symptoms, and upcoming doctor appointments. | [ClinicalReports.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/ClinicalReports.jsx)<br>[aiService.js](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/services/aiService.js) |
| 12 | **Printable Doctor Visit Preparation Brief**<br>"Doctor visit preparation modal with a working Print / Save PDF button." | Formatted clinical document summarizing 30-day adherence, active medications, allergy flags, and vitals trend, printable via native `window.print()` with clean print CSS rules. | [ClinicalReports.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/ClinicalReports.jsx)<br>[index.css](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/index.css) |
| 13 | **Family Administration & Medicine CRUD**<br>"Family dashboard: medicine CRUD (add, edit, delete, restock) with form validation and sanitizeInput, appointment management, and activity log." | Full management suite for family admins: Add/Edit/Delete medications, +30 pill restock button, appointment scheduling, low-refill alerts, and complete chronological audit log. | [FamilyDashboard.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/FamilyDashboard.jsx)<br>[CareContext.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/context/CareContext.jsx) |
| 14 | **Email Notification Center & Live Inbox Preview**<br>"Email center: 3 stage trigger buttons, refill link in email body for lowStockMedications, and live inbox preview." | Interactive simulation panel with 3 stage escalation triggers, auto-embedded 1-click pharmacy reorder links for medications $\le 5$ pills, and a live in-app inbox preview drawer. | [EmailNotificationCenter.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/EmailNotificationCenter.jsx)<br>[CareContext.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/context/CareContext.jsx) |
| 15 | **Demo Time-Travel: Fast-Forward 1 Hour**<br>"In demo mode only, add a Fast-forward 1 hour control that shifts the engine clock so judges can see missed-dose emails without waiting." | Clock-offset state manipulator (`clockOffsetMinutes`) allowing evaluators to jump forward in time by 1 hour, immediately tripping Stage 2 and Stage 3 alerts, with a 1-click reset control. | [CareContext.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/context/CareContext.jsx)<br>[ElderDashboard.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/ElderDashboard.jsx)<br>[Navbar.jsx](file:///c:/Users/bikra/OneDrive/Desktop/ElderWomen/src/components/Navbar.jsx) |

---

## 🔑 Demo Passcodes & Role Routing

CareSync AI features distinct operational views protected by 4-digit PINs:

| Role | PIN | Capabilities & Scope |
|------|:---:|----------------------|
| **Elder View** | `1111` | Simplified large-type UI, bilingual voice check-in ("Zero-UI"), per-slot dose logging, snooze & skip with reason, SOS emergency alert, and Double-Dose Overdose Lockout. |
| **Caretaker View** | `2222` | Today's dose administration grid, vitals & observation logging (BP, sugar, pulse, notes), Prescription Uploader, and 12-Hour Shift Handover Brief. |
| **Family Admin View** | `3333` | Full Medication CRUD (Add, Edit, Delete, Restock +30), Appointment scheduling, 3-Stage Email Notification Center with Live Sent Inbox, and full Audit Trail. |

> Evaluator Tip: In **Demo Mode** (`VITE_DEMO_MODE=true`), quick-switch pills in the navigation bar allow instant 1-click role navigation without entering the PIN keypad on every transition. The keypad can be opened anytime via the **"PIN Lock Modal"** button.

---

## ⚙️ Environment Variables

CareSync AI requires zero external configuration to run in full demo mode. To enable live Google Gemini Multimodal Vision and Speech Classification via the serverless proxy, configure `.env`:

```env
# Server-side Gemini API key used by the Vercel serverless proxy (/api/gemini).
# Do NOT prefix with VITE_ to prevent leaking the secret key into client-side JS bundles.
GEMINI_API_KEY=your_gemini_api_key_here

# Configurable Gemini Model (Default to stable Flash model; re-check periodically on https://ai.google.dev/models)
GEMINI_MODEL=gemini-2.5-flash

# Demo Mode Toggle ("true" | "false")
# When "true": enables quick-switch role buttons, judge PIN guide, voice simulation buttons, and lockout demo buttons.
# When "false": switching roles strictly requires entering the PIN on the keypad.
VITE_DEMO_MODE=true
```

---

## 🚀 Setup & Local Execution

### Prerequisites
- Node.js `v18.0.0` or higher
- npm `v9.0.0` or higher

### 1. Installation
```bash
git clone <repo-url>
cd ElderWomen
npm install
```

### 2. Running Locally (Standard Vite Dev Server)
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. All features (voice check-in, prescription parsing, reminder engine, and double-dose lockout) operate immediately with 100% deterministic local rules.

### 3. Running with Vercel Serverless Proxy (Live Gemini OCR & AI)
```bash
# Install Vercel CLI if not present
npm install -g vercel

# Run development server with /api/gemini proxy:
vercel dev
```
Open [http://localhost:3000](http://localhost:3000) to test live cloud vision OCR.

### 4. Running the Automated Test Suite
```bash
npm test
```
Executes all 28 automated unit tests via **Vitest**, covering PIN security & rate-limit lockouts, XSS input sanitization, prescription file validation, adherence scoring, per-slot double-dose lockout, reminder engine time travel, and phonetic voice parsing.

### 5. Production Build
```bash
npm run build
```
Generates an optimized, tree-shaken static production bundle in `dist/`.

---

## 🔒 Security & Privacy Architecture

- **Server-Side Secret Isolation**: `GEMINI_API_KEY` is loaded exclusively inside the serverless function `/api/gemini`. `vite.config.js` restricts exposed client variables via `envPrefix: ['VITE_DEMO_']`. The secret key is never bundled into `dist/`.
- **First-Use Privacy Consent**: A clear privacy disclosure modal gates all external cloud communication. If the user declines cloud consent, all operations fallback to zero-latency local deterministic algorithms.
- **XSS Sanitization**: All form inputs are sanitized using `sanitizeInput`, which strips malicious HTML (`<script>`, inline handlers, `javascript:`) while strictly preserving clinical comparison operators like `BP < 90 and > 60`.
- **File Upload Guardrails**: Prescription uploads are restricted to `image/png`, `image/jpeg`, and `application/pdf` with a strict 5MB maximum file size limit.
- **Zero Forbidden Primitives**: Clean codebase containing zero `console.log`, zero `eval()`, and zero `dangerouslySetInnerHTML`.

---

## ⚠️ Known Limitations

1. **Single-Device Demo Mode**: In compliance with the single-page application prototype specification, application state is managed in React state synchronized with browser `localStorage`. Data persists across reloads on the same browser instance but does not sync across separate physical devices.
2. **Simulated Email Notifications**: Outgoing emails (Stage 1 Reminders, Stage 2 Caretaker Overdue Alerts, Stage 3 Family Urgent Escalations, and SOS Emergency Dispatches) are rendered in a high-fidelity in-browser **Live Inbox Preview Drawer** rather than dispatched via external SMTP/SendGrid servers, avoiding external network rate limits during judging.
3. **Client-Side PIN Security**: The 4-digit PIN system (`1111`, `2222`, `3333`) and 30-second lockout in `PasscodeGate` are designed as client-side demo security for hackathon evaluation. In a production healthcare deployment, this must be backed by authenticated server sessions, OAuth 2.0 / OIDC with healthcare identity providers, biometric WebAuthn, and HIPAA-compliant audit logs.

---

## ⚖️ Medical Safety Disclaimer

> [!CAUTION]
> **MEDICAL SAFETY DISCLAIMER**: CareSync AI is an assistive technology prototype designed for demonstration, hackathon evaluation, and research purposes only. It is **not** a certified medical device, diagnostic tool, or clinical prescription platform. It is not intended to diagnose, treat, cure, or prevent any medical condition.
> 
> Spoken responses, drug interaction alerts, and clinical briefs generated by this software must **never** supersede the clinical judgment of a licensed healthcare physician or pharmacist. In any medical emergency, patients and caregivers must immediately contact national emergency services (**112** or **102** in India, **911** in the US) or proceed to the nearest hospital emergency department.
