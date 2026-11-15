/**
 * CareSync AI — EmailNotificationCenter Component
 * Features:
 * 1. 3-Stage Escalating Email Simulator Trigger Buttons (Stage 1, Stage 2, Stage 3)
 * 2. 1-Click Pharmacy Refill Reorder Links in the body for lowStockMedications
 * 3. Live Sent Email Inbox Preview (To, Subject, Timestamp, Stage Badge, Formatted Body)
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  Mail,
  Send,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Bell,
  ExternalLink,
  Search,
  Filter,
  User,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useCare } from "../context/CareContext";
import { sanitizeInput } from "../utils/security";

/**
 * EmailNotificationCenter Component
 * @returns {JSX.Element}
 */
export default function EmailNotificationCenter() {
  const {
    emails,
    elderProfile,
    lowStockMedications,
    triggerEscalatingEmail,
    restockMedication,
  } = useCare();

  const [activeStageFilter, setActiveStageFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusNotice, setStatusNotice] = useState(null);
  const [customNotes, setCustomNotes] = useState("");

  // Handler for triggering stage 1
  const handleTriggerStage1 = useCallback(() => {
    const patientName = elderProfile.name || "Patient";
    const email = triggerEscalatingEmail(1, {
      body: customNotes.trim()
        ? `Upcoming schedule notification for ${patientName}.\nNote: ${sanitizeInput(
            customNotes
          )}`
        : undefined,
    });
    setStatusNotice(`Stage 1 Reminder sent to ${email.to}`);
    setTimeout(() => setStatusNotice(null), 3500);
  }, [elderProfile, customNotes, triggerEscalatingEmail]);

  // Handler for triggering stage 2
  const handleTriggerStage2 = useCallback(() => {
    const patientName = elderProfile.name || "Patient";
    const email = triggerEscalatingEmail(2, {
      body: customNotes.trim()
        ? `Caretaker Alert: ${patientName} has not confirmed a scheduled dose (30m overdue).\nObservation: ${sanitizeInput(
            customNotes
          )}`
        : undefined,
    });
    setStatusNotice(`Stage 2 Caretaker Missed-Dose Alert sent to ${email.to}`);
    setTimeout(() => setStatusNotice(null), 3500);
  }, [elderProfile, customNotes, triggerEscalatingEmail]);

  // Handler for triggering stage 3
  const handleTriggerStage3 = useCallback(() => {
    const patientName = elderProfile.name || "Patient";
    const email = triggerEscalatingEmail(3, {
      stage: "Stage 3: Family Urgent Missed-Dose & Overdose Alert",
      subject: `CRITICAL ESCALATION: 60m Missed Dose & Safety Alert for ${patientName}`,
      body: customNotes.trim()
        ? `Critical Escalation: 60 minutes overdue on medication dose for ${patientName}. Immediate in-person check required.\nPriority Notes: ${sanitizeInput(
            customNotes
          )}`
        : undefined,
    });
    setStatusNotice(`Stage 3 Family Urgent Alert dispatched to ${email.to}`);
    setTimeout(() => setStatusNotice(null), 3500);
  }, [elderProfile, customNotes, triggerEscalatingEmail]);

  // Filtered emails based on search query and stage filter
  const filteredEmails = useMemo(() => {
    return (emails || []).filter((email) => {
      const matchStage =
        activeStageFilter === "all" ||
        (activeStageFilter === "stage1" && email.stage?.includes("Stage 1")) ||
        (activeStageFilter === "stage2" && email.stage?.includes("Stage 2")) ||
        (activeStageFilter === "stage3" && email.stage?.includes("Stage 3"));

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (email.subject || "").toLowerCase().includes(q) ||
        (email.to || "").toLowerCase().includes(q) ||
        (email.body || "").toLowerCase().includes(q);

      return matchStage && matchSearch;
    });
  }, [emails, activeStageFilter, searchQuery]);

  // Quick 1-click refill order handler
  const handle1ClickRefill = useCallback(
    (medId) => {
      restockMedication(medId, 30);
      setStatusNotice(`Refill order placed! Restocked +30 pills for medication.`);
      setTimeout(() => setStatusNotice(null), 3500);
    },
    [restockMedication]
  );

  return (
    <div className="space-y-6">
      {/* 3-Stage Escalation Trigger Controls Card */}
      <section
        aria-label="3-Stage Escalating Email Simulator"
        className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" aria-hidden="true" />
              <h2 className="text-xl font-bold text-slate-900">
                3-Stage Escalating Email Notification Center
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Simulate proactive clinical email triggers across caregivers and family, with automated pharmacy refill links for low-stock medicines.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 font-semibold">
              {emails.length} Emails Logged
            </span>
          </div>
        </div>

        {/* Low Refill Alert Banner if any med has <= 5 pills */}
        {lowStockMedications.length > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <strong className="text-amber-950 font-bold">
                  Automated Refill Link Embedded:
                </strong>{" "}
                <span>
                  {lowStockMedications.length} medication(s) currently at critical stock (
                  {lowStockMedications.map((m) => `${m.name} [${m.remainingPills} left]`).join(", ")}
                  ). 1-Click order links will automatically be attached to all generated emails.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Custom Context / Notes Input for Evaluators */}
        <div>
          <label
            htmlFor="input-email-custom-notes"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Optional Custom Context / Clinical Observation (Included in Generated Email Body)
          </label>
          <input
            id="input-email-custom-notes"
            type="text"
            aria-label="Optional Custom Context, custom clinical note for email body"
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            placeholder="e.g. Mild morning nausea observed; morning walk skipped..."
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* 3 Stage Simulator Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Stage 1 Button */}
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 flex flex-col justify-between gap-3 shadow-xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  Stage 1 • Normal
                </span>
                <span className="text-[11px] text-slate-500 font-medium">To: Family</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Upcoming Dose & Appointment
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Gentle morning reminder sent to family with daily regimen schedule and routine clinic appointments.
              </p>
            </div>

            <button
              id="btn-trigger-stage-1"
              type="button"
              aria-label="Trigger Stage 1 Reminder, send upcoming dose reminder email"
              onClick={handleTriggerStage1}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              Trigger Stage 1 Reminder
            </button>
          </div>

          {/* Stage 2 Button */}
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 flex flex-col justify-between gap-3 shadow-xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  Stage 2 • High Priority
                </span>
                <span className="text-[11px] text-slate-500 font-medium">To: Caretaker</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                30m Overdue Missed-Dose
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Immediate alert to on-duty caretaker when a scheduled dose is 30 minutes past its slot without a confirmation.
              </p>
            </div>

            <button
              id="btn-trigger-stage-2"
              type="button"
              aria-label="Trigger Stage 2 Alert, send 30-minute missed-dose alert email"
              onClick={handleTriggerStage2}
              className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Bell className="w-3.5 h-3.5" aria-hidden="true" />
              Trigger Stage 2 Alert
            </button>
          </div>

          {/* Stage 3 Button */}
          <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 flex flex-col justify-between gap-3 shadow-xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                  Stage 3 • Critical Emergency
                </span>
                <span className="text-[11px] text-slate-500 font-medium">To: Family Admin</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                60m Critical Overdue / Overdose
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Urgent escalation dispatched to family administrators for 60m missed doses, low refills, or blocked overdose attempts.
              </p>
            </div>

            <button
              id="btn-trigger-stage-3"
              type="button"
              aria-label="Trigger Stage 3 Urgent Alert, send 60-minute critical escalation email"
              onClick={handleTriggerStage3}
              className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
              Trigger Stage 3 Urgent Alert
            </button>
          </div>
        </div>

        {/* Live Feedback Toast */}
        {statusNotice && (
          <div
            role="status"
            aria-live="polite"
            className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-fade-in font-medium"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>{statusNotice}</span>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* LIVE SENT EMAIL INBOX PREVIEW                                            */}
      {/* ========================================================================= */}
      <section
        aria-label="Live Email Inbox Preview"
        className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              Live Sent Email Inbox Preview ({filteredEmails.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulated real-time outbound email stream formatted with recipient, subject, stage tags, and body.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              id="btn-filter-emails-all"
              type="button"
              aria-label="All Emails, filter all emails"
              onClick={() => setActiveStageFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                activeStageFilter === "all"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({emails.length})
            </button>
            <button
              id="btn-filter-emails-stage1"
              type="button"
              aria-label="Stage 1, filter stage 1 reminder emails"
              onClick={() => setActiveStageFilter("stage1")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                activeStageFilter === "stage1"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              Stage 1
            </button>
            <button
              id="btn-filter-emails-stage2"
              type="button"
              aria-label="Stage 2, filter stage 2 alert emails"
              onClick={() => setActiveStageFilter("stage2")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                activeStageFilter === "stage2"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              Stage 2
            </button>
            <button
              id="btn-filter-emails-stage3"
              type="button"
              aria-label="Stage 3, filter stage 3 critical emails"
              onClick={() => setActiveStageFilter("stage3")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                activeStageFilter === "stage3"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              Stage 3
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <label htmlFor="input-search-emails" className="sr-only">
            Search sent emails by recipient or subject
          </label>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" aria-hidden="true" />
          <input
            id="input-search-emails"
            type="text"
            aria-label="Search sent emails, filter by recipient, subject, or message"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sent emails by recipient, subject or keyword..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Email Cards List */}
        <div className="space-y-4">
          {filteredEmails.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
              No simulated emails match the selected filters. Click any trigger button above to generate a notification.
            </div>
          ) : (
            filteredEmails.map((email) => {
              const isCritical =
                email.priority === "critical" || email.stage?.includes("Stage 3");
              const isHigh =
                email.priority === "high" || email.stage?.includes("Stage 2");

              return (
                <article
                  key={email.id}
                  className={`p-5 rounded-2xl border transition space-y-3 bg-white shadow-sm ${
                    isCritical
                      ? "border-rose-300 shadow-rose-500/5"
                      : isHigh
                      ? "border-amber-300 shadow-amber-500/5"
                      : "border-slate-200"
                  }`}
                >
                  {/* Top Bar: Recipient + Timestamp + Stage Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                          isCritical
                            ? "bg-rose-100 text-rose-800 border-rose-200"
                            : isHigh
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-blue-100 text-blue-800 border-blue-200"
                        }`}
                      >
                        {email.stage || "Notification"}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {email.timestamp}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                      <span className="text-slate-400">To:</span>
                      <strong className="text-slate-900 font-mono">{email.to}</strong>
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {email.subject}
                    </h4>
                  </div>

                  {/* Body Content with formatted paragraphs and 1-Click Refill Links */}
                  <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-mono">
                    {email.body}
                  </div>

                  {/* If email mentions refill links or lowStock, render interactive 1-click pill reorder button */}
                  {email.body?.includes("pharmacy.caresync.ai/refill") && (
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                        1-Click Refill Action Available:
                      </span>
                      {lowStockMedications.map((m) => (
                        <button
                          key={m.id}
                          id={`btn-order-refill-${email.id}-${m.id}`}
                          type="button"
                          aria-label={`Order Refill for ${m.name}, restock 30 pills`}
                          onClick={() => handle1ClickRefill(m.id)}
                          className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95"
                        >
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          Order Refill: {m.name} (+30 pills)
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
