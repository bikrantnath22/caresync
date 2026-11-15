/**
 * CareSync AI — Root Application Component
 * Acts as the Role Router and renders active role views with global navigation.
 * Roles:
 * - Elder (PIN 1111): ElderDashboard (WCAG AAA high contrast, voice check-in, large touch targets)
 * - Caretaker (PIN 2222): CaretakerDashboard (Shift tasks, vitals logger, prescription scanner, handover)
 * - Family (PIN 3333): FamilyDashboard (Full CRUD for meds & appointments, email simulator, reports, activity)
 *
 * DoubleDoseModal is mounted globally so double-dose lockout protection works in every role.
 * useReminders() runs every 30s evaluating due notifications with dedupeKey tracking.
 */

import React, { useState, useEffect, useCallback } from "react";
import Navbar from "./components/Navbar";
import ElderDashboard from "./components/ElderDashboard";
import CaretakerDashboard from "./components/CaretakerDashboard";
import FamilyDashboard from "./components/FamilyDashboard";
import DoubleDoseModal from "./components/DoubleDoseModal";
import ConsentModal from "./components/ConsentModal";
import { useCare } from "./context/CareContext";
import { getStoredConsent } from "./utils/security";
import { checkDueReminders } from "./services/reminderEngine";

/**
 * useReminders Hook
 * Runs every 30s while the app is open. For each new dedupeKey, dispatches
 * triggerEscalatingEmail and addLog, persisting sent keys in localStorage.
 */
export function useReminders() {
  const {
    medications,
    appointments,
    elderProfile,
    triggerEscalatingEmail,
    addLog,
    clockOffsetMinutes,
  } = useCare();

  const evaluateReminders = useCallback(() => {
    try {
      const raw = localStorage.getItem("caresync_sent_reminder_keys");
      const sentKeys = new Set(raw ? JSON.parse(raw) : []);

      // Calculate effective time including demo fast-forward clock shift
      const effectiveNow = new Date(Date.now() + (clockOffsetMinutes || 0) * 60 * 1000);

      const due = checkDueReminders({
        medications,
        appointments,
        now: effectiveNow,
        elderProfile,
      });

      const newNotifications = due.filter((n) => !sentKeys.has(n.dedupeKey));

      if (newNotifications.length > 0) {
        newNotifications.forEach((n) => {
          sentKeys.add(n.dedupeKey);

          // Dispatch escalating email
          triggerEscalatingEmail(n.stage, {
            stage: n.stageLabel,
            priority: n.priority,
            to: n.to,
            subject: n.subject,
            body: n.body,
          });

          // Add audit log
          addLog("ReminderEngine", n.type, n.severity || "normal", n.logMessage);
        });

        localStorage.setItem(
          "caresync_sent_reminder_keys",
          JSON.stringify(Array.from(sentKeys))
        );
      }
    } catch {
      // ignore storage errors
    }
  }, [
    medications,
    appointments,
    elderProfile,
    triggerEscalatingEmail,
    addLog,
    clockOffsetMinutes,
  ]);

  useEffect(() => {
    // Immediate evaluation on mount or clock shift
    evaluateReminders();

    // Periodic evaluation every 30 seconds
    const interval = setInterval(evaluateReminders, 30 * 1000);
    return () => clearInterval(interval);
  }, [evaluateReminders]);
}

/**
 * Root App Component
 * @returns {JSX.Element}
 */
export default function App() {
  const { activeRole } = useCare();
  const [showFirstUseConsent, setShowFirstUseConsent] = useState(
    () => getStoredConsent() === null
  );

  // Proactive reminder engine hook
  useReminders();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Accessible Navigation */}
      <Navbar />

      {/* Main Content Area — Role Router */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeRole === "elder" ? (
          <ElderDashboard />
        ) : activeRole === "caretaker" ? (
          <CaretakerDashboard />
        ) : (
          <FamilyDashboard />
        )}
      </main>

      {/* Footer Landmark */}
      <footer className="mt-auto border-t border-slate-200/80 py-5 bg-white text-center text-xs text-slate-500 shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-medium text-slate-600">
            CareSync AI — Elderly Care & Medication Management Platform
          </p>
          <p className="text-slate-600 font-semibold">
            PromptWars x Catalyst Challenge • WCAG AAA Accessible
          </p>
        </div>
      </footer>

      {/* Global Accessible Clinical Overdose Lockout Modal — Shows in EVERY role */}
      <DoubleDoseModal />

      {/* First-Use Accessible Cloud AI & Voice Consent Modal */}
      <ConsentModal
        isOpen={showFirstUseConsent}
        onClose={() => setShowFirstUseConsent(false)}
      />
    </div>
  );
}
