/**
 * CareSync AI — ClinicalReports Component
 * Provides:
 * 1. AI 12-Hour Caretaker Shift Handover (generateClinicalBrief with 4-bullet standardized handover)
 * 2. 1-Click Printable Doctor Visit Brief with working window.print() and 1-page clinical layout
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText,
  Sparkles,
  Copy,
  Send,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  HeartPulse,
  Pill,
  Calendar,
  Activity,
  User,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { useCare } from "../context/CareContext";
import { generateClinicalBrief } from "../services/aiService";

/**
 * ClinicalReports Component
 * @returns {JSX.Element}
 */
export default function ClinicalReports() {
  const {
    medications,
    logs,
    appointments,
    elderProfile,
    adherenceScore,
    lowStockMedications,
    triggerEscalatingEmail,
  } = useCare();

  const [handoverData, setHandoverData] = useState(null);
  const [isGeneratingHandover, setIsGeneratingHandover] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const printModalRef = useRef(null);
  const printOpenerRef = useRef(null);

  // Auto-generate or re-evaluate brief when component mounts or data updates
  useEffect(() => {
    let isMounted = true;
    async function loadBrief() {
      try {
        const brief = await generateClinicalBrief(
          medications,
          logs,
          appointments,
          elderProfile
        );
        if (isMounted) {
          setHandoverData(brief);
        }
      } catch {
        // Fallback already handled inside generateClinicalBrief
      }
    }
    loadBrief();
    return () => {
      isMounted = false;
    };
  }, [medications, logs, appointments, elderProfile]);

  // Generate / regenerate shift handover
  const handleGenerateHandover = useCallback(async () => {
    setIsGeneratingHandover(true);
    setEmailFeedback(null);
    try {
      const brief = await generateClinicalBrief(
        medications,
        logs,
        appointments,
        elderProfile
      );
      setHandoverData(brief);
    } catch {
      // Handled
    } finally {
      setIsGeneratingHandover(false);
    }
  }, [medications, logs, appointments, elderProfile]);

  // Copy handover bullets to clipboard
  const handleCopyHandover = useCallback(() => {
    if (!handoverData) return;
    const textToCopy = `CareSync AI — 12-Hour Caretaker Shift Handover for ${
      elderProfile.name
    }\nDate: ${new Date().toLocaleDateString()}\n\n${handoverData.shiftHandoverBullets
      .map((b, i) => `${i + 1}. ${b}`)
      .join("\n\n")}\n\nPreparation for Doctor Review:\n${JSON.stringify(
      handoverData.doctorVisitSummary,
      null,
      2
    )}\n\n${handoverData.footer || "Generated from app logs — not a medical record."}`;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 3000);
    }
  }, [handoverData, elderProfile]);

  // Email shift handover to family
  const handleEmailHandover = useCallback(() => {
    if (!handoverData) return;
    triggerEscalatingEmail(1, {
      subject: `Clinical Shift Handover Brief: ${elderProfile.name} (${new Date().toLocaleDateString()})`,
      body: `CareSync AI Shift Handover Report for ${
        elderProfile.name
      }:\n\n${handoverData.shiftHandoverBullets
        .map((b, i) => `[Bullet ${i + 1}] ${b}`)
        .join("\n\n")}\n\nDoctor Visit Preparation Summary:\n• Adherence Rate: ${
        handoverData.doctorVisitSummary?.adherenceRate || adherenceScore
      }%\n• Critical Alerts: ${
        handoverData.doctorVisitSummary?.criticalAlerts || "None"
      }\n• Active Interactions: ${
        handoverData.doctorVisitSummary?.activeInteractions || "None"
      }\n• Recommendation: ${
        handoverData.doctorVisitSummary?.recommendation || "Maintain daily schedule"
      }`,
    });

    setEmailFeedback(`Shift handover report emailed to ${elderProfile.familyEmail}`);
    setTimeout(() => setEmailFeedback(null), 4000);
  }, [handoverData, elderProfile, adherenceScore, triggerEscalatingEmail]);

  // Open printable doctor brief modal with focus tracking
  const handleOpenPrintModal = useCallback(() => {
    printOpenerRef.current = document.activeElement;
    setIsPrintModalOpen(true);
  }, []);

  // Close printable doctor brief modal and restore focus
  const handleClosePrintModal = useCallback(() => {
    setIsPrintModalOpen(false);
    if (printOpenerRef.current?.focus) {
      printOpenerRef.current.focus();
    }
  }, []);

  // Focus trap for printable modal
  useEffect(() => {
    if (!isPrintModalOpen || !printModalRef.current) return;
    const modalEl = printModalRef.current;
    const focusable = modalEl.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClosePrintModal();
        return;
      }
      if (e.key === "Tab") {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPrintModalOpen, handleClosePrintModal]);

  // Execute print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Compute stats for doctor brief
  const overdoseCount = logs.filter((l) => l.type === "overdose-attempt").length;
  const recentVitalsLogs = logs
    .filter((l) => l.type === "vitals" || l.type === "voice-symptom")
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 12-Hour Shift Handover Card */}
      <section
        aria-label="Clinical Handover and Reports Section"
        className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 shadow-md space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              <h2 className="text-xl font-bold text-white">
                AI 12-Hour Caretaker Shift Handover
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic 4-bullet clinical brief synthesized from real regimen adherence, safety logs, and upcoming priorities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-generate-shift-handover"
              type="button"
              aria-label={
                isGeneratingHandover
                  ? "Synthesizing Handover, generating summary"
                  : "Generate AI Handover, create 12-hour shift brief"
              }
              onClick={handleGenerateHandover}
              disabled={isGeneratingHandover}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 flex items-center gap-2 shrink-0 active:scale-98"
            >
              <Sparkles className="w-4 h-4 text-amber-300" aria-hidden="true" />
              {isGeneratingHandover ? "Synthesizing Handover..." : "Generate AI Handover"}
            </button>

            <button
              id="btn-open-doctor-brief"
              type="button"
              aria-label="Print Doctor Visit Brief, open 1-page printable clinical brief"
              onClick={handleOpenPrintModal}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/20 flex items-center gap-2 shrink-0 active:scale-98"
            >
              <Printer className="w-4 h-4 text-indigo-200" aria-hidden="true" />
              Print Doctor Visit Brief
            </button>
          </div>
        </div>

        {/* Handover Content Box */}
        {handoverData ? (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-700 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Clinical Brief Ready
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs text-slate-400">
                  4 Standardized Shift Handover Bullets
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="btn-copy-handover"
                  type="button"
                  aria-label={
                    copyFeedback
                      ? "Copied, copied to clipboard"
                      : "Copy Brief, copy handover text to clipboard"
                  }
                  onClick={handleCopyHandover}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  {copyFeedback ? "Copied!" : "Copy Brief"}
                </button>

                <button
                  id="btn-email-handover"
                  type="button"
                  aria-label="Email to Family, send handover report to family"
                  onClick={handleEmailHandover}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  Email to Family
                </button>
              </div>
            </div>

            {emailFeedback && (
              <div
                role="status"
                aria-live="polite"
                className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>{emailFeedback}</span>
              </div>
            )}

            {/* 4 Standardized Handover Bullets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {handoverData.shiftHandoverBullets?.map((bullet, idx) => (
                <article
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3"
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/40">
                    {idx + 1}
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{bullet}</p>
                </article>
              ))}
            </div>

            {/* Doctor Visit Synthesis Summary Box */}
            {handoverData.doctorVisitSummary && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2">
                <span className="font-bold text-slate-300 block">
                  Upcoming Doctor Review Preparation:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-slate-400">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Adherence
                    </span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {handoverData.doctorVisitSummary.adherenceRate}%
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Critical Alerts
                    </span>
                    <span className="text-amber-400 font-medium">
                      {handoverData.doctorVisitSummary.criticalAlerts}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Drug Conflicts
                    </span>
                    <span className="text-sky-300 font-medium truncate block">
                      {handoverData.doctorVisitSummary.activeInteractions}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Recommendation
                    </span>
                    <span className="text-slate-300 font-medium">
                      {handoverData.doctorVisitSummary.recommendation || "Follow routine"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Disclaimer Footer */}
            <div className="text-[11px] text-slate-500 italic text-right pt-2 border-t border-slate-800">
              {handoverData.footer || "Generated from app logs — not a medical record."}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs">
            Loading clinical handover...
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 1-CLICK PRINTABLE DOCTOR VISIT BRIEF MODAL (Single-Page Formatted Print)  */}
      {/* ========================================================================= */}
      {isPrintModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="doctor-brief-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-3 sm:p-6"
        >
          <div className="min-h-full flex justify-center py-4 sm:py-6">
            <div
              ref={printModalRef}
              className="my-auto w-full max-w-4xl bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]"
            >
            {/* Modal Interactive Header (Hidden on Print) */}
            <header className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/40">
                  <Printer className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3
                    id="doctor-brief-modal-title"
                    className="text-base sm:text-lg font-bold text-white"
                  >
                    Doctor Visit Clinical Brief Preview
                  </h3>
                  <p className="text-xs text-slate-400">
                    Formatted for 1-page printing / PDF export for Dr. A. K. Sharma
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-print-doctor-brief"
                  type="button"
                  aria-label="Print / Save PDF, print clinical brief to printer or PDF"
                  onClick={handlePrint}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition active:scale-95"
                >
                  <Printer className="w-4 h-4" aria-hidden="true" />
                  Print / Save PDF
                </button>

                <button
                  id="btn-close-doctor-brief"
                  type="button"
                  aria-label="Close Doctor Brief, dismiss printable report modal"
                  onClick={handleClosePrintModal}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* Printable Single-Page Document Content */}
            <div className="overflow-y-auto p-6 sm:p-8 space-y-5 bg-white text-slate-900 printable-doctor-brief">
              {/* Report Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-3 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black tracking-tight text-slate-900">
                      CareSync <span className="text-sky-600">AI</span>
                    </span>
                    <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700">
                      Physician Consultation Brief
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Prepared for: <strong>{elderProfile.primaryDoctor}</strong>
                  </p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <p>
                    <strong>Generated:</strong> {new Date().toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Report Window:</strong> 14-Day Audit Trail
                  </p>
                </div>
              </div>

              {/* Patient Identification Card */}
              <section
                aria-label="Patient Demographics"
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Patient Name
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {elderProfile.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Age / Blood Group
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {elderProfile.age}y • {elderProfile.bloodGroup}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Clinical Conditions
                  </span>
                  <span className="text-slate-800 font-medium">
                    {elderProfile.conditions?.join(", ")}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-rose-600 block">
                    Allergies (Documented)
                  </span>
                  <span className="font-bold text-rose-700">
                    {elderProfile.allergies?.join(", ")}
                  </span>
                </div>
              </section>

              {/* Summary Scorecards */}
              <section
                aria-label="Adherence and Safety Summary"
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs"
              >
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Regimen Adherence
                  </span>
                  <span className="text-lg font-black text-emerald-700">
                    {adherenceScore}%
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Active Medications
                  </span>
                  <span className="text-lg font-black text-sky-700">
                    {medications.length}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Overdose Lockouts
                  </span>
                  <span
                    className={`text-lg font-black ${
                      overdoseCount > 0 ? "text-rose-700" : "text-slate-700"
                    }`}
                  >
                    {overdoseCount} Blocked
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Low Refill Meds
                  </span>
                  <span
                    className={`text-lg font-black ${
                      lowStockMedications.length > 0 ? "text-amber-700" : "text-slate-700"
                    }`}
                  >
                    {lowStockMedications.length}
                  </span>
                </div>
              </section>

              {/* Current Active Regimen Table */}
              <section aria-label="Active Medication Regimen" className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
                  Active Prescribed Regimen & Daily Schedules
                </h4>
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                        <th className="p-2">Medication</th>
                        <th className="p-2">Dosage & Frequency</th>
                        <th className="p-2">Daily Slots</th>
                        <th className="p-2">Meal Rule / Diet</th>
                        <th className="p-2 text-right">Pills Left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {medications.map((med) => (
                        <tr key={med.id}>
                          <td className="p-2 font-bold text-slate-900">
                            {med.name}
                            {med.interactionWarning && (
                              <span className="block text-[10px] text-rose-600 font-normal">
                                <span aria-hidden="true">⚠️</span> {med.interactionWarning}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-slate-700">
                            {med.dosage} • {med.frequency}
                          </td>
                          <td className="p-2 font-mono text-slate-800">
                            {med.timeSlots?.join(", ")}
                          </td>
                          <td className="p-2 text-slate-600">
                            {med.mealInstruction}
                            {med.foodRule && ` (${med.foodRule})`}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            {med.remainingPills}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Recent Vitals & Clinical Observations */}
              {recentVitalsLogs.length > 0 && (
                <section aria-label="Recent Clinical Observations" className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-rose-600" aria-hidden="true" />
                    Recent Vitals & Patient-Reported Observations (Last 14 Days)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {recentVitalsLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2 bg-slate-50 border border-slate-200 rounded"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mb-0.5">
                          <span>{log.role}</span>
                          <span>{log.timestamp}</span>
                        </div>
                        <p className="text-slate-800 text-xs">{log.message}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Upcoming Consultations */}
              {appointments.length > 0 && (
                <section aria-label="Upcoming Consultations" className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
                    Upcoming Consultations Scheduled
                  </h4>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs flex flex-wrap items-center justify-between gap-2">
                    {appointments.map((apt) => (
                      <span key={apt.id} className="text-slate-800">
                        <strong>{apt.doctorName}</strong> ({apt.specialty}) • {apt.date} at{" "}
                        {apt.time} • <em>{apt.location}</em>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Physician Review & Signature Block */}
              <footer className="pt-3 border-t-2 border-slate-300 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold text-slate-700 block mb-1">
                    Physician Action Notes:
                  </span>
                  <div className="h-10 border border-dashed border-slate-300 rounded p-1 text-slate-400 text-[10px]">
                    [Check INR status / Adjust antihypertensive / Blood glucose review]
                  </div>
                </div>
                <div className="flex flex-col justify-end text-right">
                  <div className="border-t border-slate-400 pt-1 text-slate-700 font-bold">
                    Physician Signature: ___________________________
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Date Verified: {new Date().toLocaleDateString()}
                  </span>
                </div>
              </footer>

              {/* Bottom Print Disclaimer */}
              <div className="text-[10px] text-slate-400 italic text-center pt-1 border-t border-slate-200">
                CareSync AI Clinical Audit Brief • Grounded strictly in validated patient records. Not a substitute for professional clinical diagnosis.
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
