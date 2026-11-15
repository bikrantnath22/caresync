/**
 * CareSync AI — FamilyDashboard Component (PIN 3333)
 * Full Administrative Station for Family Members featuring:
 * 1. Medication CRUD: Add, Edit, Delete, and Restock with strict input validation and sanitizeInput
 * 2. Appointment Management: Add, Delete, and Reminder Toggle
 * 3. Low-Refill Alerts with 1-click pharmacy replenishment
 * 4. Embedded Email Notification Center
 * 5. Embedded Clinical Reports (Shift Handover & Printable Doctor Visit Brief)
 * 6. Real-Time Audit Activity Log List
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  Pill,
  Calendar,
  Mail,
  FileText,
  Clock,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Bell,
  BellOff,
  Search,
  Filter,
  X,
  Check,
  Activity,
  HeartPulse,
  User,
  Users,
} from "lucide-react";
import { useCare } from "../context/CareContext";
import { sanitizeInput } from "../utils/security";
import EmailNotificationCenter from "./EmailNotificationCenter";
import ClinicalReports from "./ClinicalReports";

/**
 * FamilyDashboard Component
 * @returns {JSX.Element}
 */
export default function FamilyDashboard() {
  const {
    elderProfile,
    medications,
    appointments,
    logs,
    adherenceScore,
    lowStockMedications,
    addMedication,
    updateMedication,
    deleteMedication,
    restockMedication,
    addAppointment,
    deleteAppointment,
    toggleAppointmentReminder,
  } = useCare();

  // Active Tab: "medicines" | "appointments" | "emails" | "reports" | "activity"
  const [activeTab, setActiveTab] = useState("medicines");

  // Medication Form Modals
  const [isAddMedModalOpen, setIsAddMedModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null); // null or medication object
  const [medFormError, setMedFormError] = useState(null);
  const [medSuccessNotice, setMedSuccessNotice] = useState(null);

  // New / Edit Medication Form State
  const [medFormData, setMedFormData] = useState({
    name: "",
    dosage: "",
    frequency: "Once Daily (0-0-1)",
    timeSlots: "08:00 AM",
    mealInstruction: "Take with water after breakfast",
    pillAppearance: "White Tablet",
    remainingPills: "30",
    foodRule: "",
    interactionWarning: "",
  });

  // Appointment Form Modal
  const [isAddAptModalOpen, setIsAddAptModalOpen] = useState(false);
  const [aptFormError, setAptFormError] = useState(null);
  const [aptSuccessNotice, setAptSuccessNotice] = useState(null);
  const [aptFormData, setAptFormData] = useState({
    doctorName: "",
    specialty: "",
    date: "",
    time: "",
    location: "",
    notes: "",
  });

  // Activity Log Filter State
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logSeverityFilter, setLogSeverityFilter] = useState("all");

  // Open Add Medication Modal
  const handleOpenAddMedModal = useCallback(() => {
    setMedFormData({
      name: "",
      dosage: "",
      frequency: "Once Daily (0-0-1)",
      timeSlots: "08:00 AM",
      mealInstruction: "Take with water after meals",
      pillAppearance: "White Round Tablet",
      remainingPills: "30",
      foodRule: "",
      interactionWarning: "",
    });
    setEditingMed(null);
    setMedFormError(null);
    setIsAddMedModalOpen(true);
  }, []);

  // Open Edit Medication Modal
  const handleOpenEditMedModal = useCallback((med) => {
    setEditingMed(med);
    setMedFormData({
      name: med.name || "",
      dosage: med.dosage || "",
      frequency: med.frequency || "Once Daily",
      timeSlots: (med.timeSlots || []).join(", "),
      mealInstruction: med.mealInstruction || "",
      pillAppearance: med.pillAppearance || "White Tablet",
      remainingPills: String(med.remainingPills != null ? med.remainingPills : 30),
      foodRule: med.foodRule || "",
      interactionWarning: med.interactionWarning || "",
    });
    setMedFormError(null);
    setIsAddMedModalOpen(true);
  }, []);

  // Submit Medication Form (Create or Update)
  const handleSubmitMedForm = useCallback(
    (e) => {
      e.preventDefault();
      setMedFormError(null);

      const cleanName = sanitizeInput(medFormData.name).trim();
      const cleanDosage = sanitizeInput(medFormData.dosage).trim();

      if (!cleanName || !cleanDosage) {
        setMedFormError("Medication name and dosage are required.");
        return;
      }

      const parsedPills = parseInt(medFormData.remainingPills, 10);
      if (isNaN(parsedPills) || parsedPills < 0) {
        setMedFormError("Remaining pill count must be a non-negative number.");
        return;
      }

      const slots = medFormData.timeSlots
        .split(",")
        .map((s) => sanitizeInput(s).trim())
        .filter(Boolean);

      const payload = {
        name: cleanName,
        dosage: cleanDosage,
        frequency: sanitizeInput(medFormData.frequency).trim(),
        timeSlots: slots.length > 0 ? slots : ["08:00 AM"],
        mealInstruction: sanitizeInput(medFormData.mealInstruction).trim(),
        pillAppearance: sanitizeInput(medFormData.pillAppearance).trim(),
        remainingPills: parsedPills,
        foodRule: sanitizeInput(medFormData.foodRule).trim(),
        interactionWarning: sanitizeInput(medFormData.interactionWarning).trim() || null,
      };

      if (editingMed) {
        updateMedication(editingMed.id, payload);
        setMedSuccessNotice(`Updated ${payload.name} (${payload.dosage}) successfully.`);
      } else {
        addMedication(payload);
        setMedSuccessNotice(`Added ${payload.name} (${payload.dosage}) to regimen.`);
      }

      setIsAddMedModalOpen(false);
      setEditingMed(null);
      setTimeout(() => setMedSuccessNotice(null), 3500);
    },
    [medFormData, editingMed, addMedication, updateMedication]
  );

  // Submit Appointment Form
  const handleSubmitAptForm = useCallback(
    (e) => {
      e.preventDefault();
      setAptFormError(null);

      const cleanDoc = sanitizeInput(aptFormData.doctorName).trim();
      const cleanDate = sanitizeInput(aptFormData.date).trim();
      const cleanTime = sanitizeInput(aptFormData.time).trim();

      if (!cleanDoc || !cleanDate || !cleanTime) {
        setAptFormError("Doctor name, consultation date, and time are required.");
        return;
      }

      const payload = {
        doctorName: cleanDoc,
        specialty: sanitizeInput(aptFormData.specialty).trim() || "General Medicine",
        date: cleanDate,
        time: cleanTime,
        location: sanitizeInput(aptFormData.location).trim() || "Main Clinic",
        notes: sanitizeInput(aptFormData.notes).trim(),
        reminderSent: false,
      };

      addAppointment(payload);
      setAptSuccessNotice(`Scheduled consultation with ${payload.doctorName}.`);
      setIsAddAptModalOpen(false);
      setAptFormData({
        doctorName: "",
        specialty: "",
        date: "",
        time: "",
        location: "",
        notes: "",
      });
      setTimeout(() => setAptSuccessNotice(null), 3500);
    },
    [aptFormData, addAppointment]
  );

  // Filtered audit activity logs
  const filteredLogs = useMemo(() => {
    return (logs || []).filter((log) => {
      const matchSeverity =
        logSeverityFilter === "all" || log.severity === logSeverityFilter;
      const q = logSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (log.message || "").toLowerCase().includes(q) ||
        (log.role || "").toLowerCase().includes(q) ||
        (log.type || "").toLowerCase().includes(q);
      return matchSeverity && matchSearch;
    });
  }, [logs, logSeverityFilter, logSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner Overview */}
      <section
        aria-label="Family Administration Overview"
        className="p-6 rounded-2xl bg-gradient-to-r from-purple-50/80 via-slate-50 to-white border border-purple-200/90 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl border border-purple-200 shadow-sm">
              <Users className="w-7 h-7" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                  Role: Family Admin (PIN 3333)
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-[11px] text-slate-500 font-semibold">Full CRUD Permissions</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900">
                Family Care Administration Hub
              </h1>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                Overseeing medication regimen, scheduling appointments, configuring alerts, and monitoring clinical safety for{" "}
                <strong className="text-slate-900 font-bold">{elderProfile.name}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 bg-white rounded-xl border border-slate-200 text-center shadow-sm">
              <span className="text-[10px] block text-slate-500 font-bold uppercase">
                Adherence
              </span>
              <span className="text-lg font-black text-emerald-700">
                {adherenceScore}%
              </span>
            </div>
            <div className="px-3.5 py-2 bg-white rounded-xl border border-slate-200 text-center shadow-sm">
              <span className="text-[10px] block text-slate-500 font-bold uppercase">
                Active Meds
              </span>
              <span className="text-lg font-black text-blue-700">
                {medications.length}
              </span>
            </div>
            <div className="px-3.5 py-2 bg-white rounded-xl border border-slate-200 text-center shadow-sm">
              <span className="text-[10px] block text-slate-500 font-bold uppercase">
                Low Refills
              </span>
              <span
                className={`text-lg font-black ${
                  lowStockMedications.length > 0 ? "text-amber-700" : "text-slate-500"
                }`}
              >
                {lowStockMedications.length}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav
          aria-label="Family Hub Sections"
          className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-200/80 overflow-x-auto pb-1"
        >
          <button
            id="tab-family-medicines"
            type="button"
            aria-label={`Medicines (${medications.length}), manage prescriptions and inventory`}
            onClick={() => setActiveTab("medicines")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === "medicines"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm"
            }`}
          >
            <Pill className="w-4 h-4" aria-hidden="true" />
            Medicines ({medications.length})
          </button>

          <button
            id="tab-family-appointments"
            type="button"
            aria-label={`Appointments (${appointments.length}), manage doctor consultations`}
            onClick={() => setActiveTab("appointments")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === "appointments"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm"
            }`}
          >
            <Calendar className="w-4 h-4" aria-hidden="true" />
            Appointments ({appointments.length})
          </button>

          <button
            id="tab-family-emails"
            type="button"
            aria-label="Emails & Notifications, open 3-stage email simulator"
            onClick={() => setActiveTab("emails")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === "emails"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm"
            }`}
          >
            <Mail className="w-4 h-4" aria-hidden="true" />
            Emails & Notifications
          </button>

          <button
            id="tab-family-reports"
            type="button"
            aria-label="Clinical Reports, view shift handovers and printable briefs"
            onClick={() => setActiveTab("reports")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === "reports"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm"
            }`}
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            Clinical Reports
          </button>

          <button
            id="tab-family-activity"
            type="button"
            aria-label={`Activity Log (${logs.length}), view audit logs`}
            onClick={() => setActiveTab("activity")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === "activity"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm"
            }`}
          >
            <Clock className="w-4 h-4" aria-hidden="true" />
            Activity Log ({logs.length})
          </button>
        </nav>
      </section>

      {/* Global Success Feedback Banner */}
      {medSuccessNotice && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-fade-in font-medium shadow-xs"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>{medSuccessNotice}</span>
        </div>
      )}

      {aptSuccessNotice && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-fade-in font-medium shadow-xs"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>{aptSuccessNotice}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: MEDICINES CRUD & LOW REFILL ALERTS                                 */}
      {/* ========================================================================= */}
      {activeTab === "medicines" && (
        <div className="space-y-6">
          {/* Low Refill Alert Banner */}
          {lowStockMedications.length > 0 && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2 shadow-xs"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" aria-hidden="true" />
                <h3 className="font-bold text-amber-950 text-sm">
                  Critical Low-Stock Warnings ({lowStockMedications.length} Medication
                  {lowStockMedications.length > 1 ? "s" : ""})
                </h3>
              </div>
              <p className="text-slate-700">
                The following approved medicines have 5 or fewer pills remaining in the dispenser. Restock immediately to prevent missed doses.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {lowStockMedications.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-xl bg-white border border-amber-300 flex items-center gap-2 shadow-xs"
                  >
                    <span className="font-bold text-slate-900">
                      {m.name} ({m.dosage})
                    </span>
                    <span className="font-mono text-amber-700 text-xs font-bold">
                      {m.remainingPills} left
                    </span>
                    <button
                      id={`btn-quick-restock-${m.id}`}
                      type="button"
                      aria-label={`Restock +30 pills for ${m.name}`}
                      onClick={() => {
                        restockMedication(m.id, 30);
                        setMedSuccessNotice(`Restocked +30 pills for ${m.name}.`);
                        setTimeout(() => setMedSuccessNotice(null), 3000);
                      }}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg transition active:scale-95 ml-1 shadow-xs"
                    >
                      +30 Pills
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Pill className="w-5 h-5 text-blue-600" aria-hidden="true" />
                Active Medication Regimen ({medications.length})
              </h2>
              <p className="text-xs text-slate-500">
                Add, edit, restock, or remove approved medications for Rameshwar Nath.
              </p>
            </div>

            <button
              id="btn-open-add-med-modal"
              type="button"
              aria-label="Add New Medication, open prescription creation form"
              onClick={handleOpenAddMedModal}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition active:scale-98"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add New Medication
            </button>
          </div>

          {/* Medications Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {medications.map((med) => {
              const isLowStock = Number(med.remainingPills) <= 5;
              return (
                <article
                  key={med.id}
                  className={`p-5 rounded-2xl border transition space-y-3 bg-white shadow-sm ${
                    isLowStock
                      ? "border-amber-300 shadow-amber-500/10"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-slate-900 text-base">
                          {med.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-mono font-bold text-blue-700">
                          {med.dosage}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">
                          {med.frequency} • {med.pillAppearance}
                        </span>
                        {(med.takenToday || (Array.isArray(med.takenSlots) && med.takenSlots.length > 0)) ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold">
                            Taken Today ({med.lastTakenAt || "Logged"})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 text-[11px] font-medium">
                            Pending Today
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        id={`btn-edit-med-${med.id}`}
                        type="button"
                        aria-label={`Edit ${med.name} ${med.dosage}`}
                        onClick={() => handleOpenEditMedModal(med)}
                        className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                      >
                        <Edit2 className="w-4 h-4" aria-hidden="true" />
                      </button>

                      <button
                        id={`btn-delete-med-${med.id}`}
                        type="button"
                        aria-label={`Delete ${med.name} ${med.dosage}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to remove ${med.name} from the active regimen?`
                            )
                          ) {
                            deleteMedication(med.id);
                            setMedSuccessNotice(`Removed ${med.name} from regimen.`);
                            setTimeout(() => setMedSuccessNotice(null), 3000);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Scheduled Slots & Meal Rule */}
                  <div className="text-xs space-y-1.5 text-slate-700 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                      <span>
                        Daily Slots: <strong>{med.timeSlots?.join(", ")}</strong>
                      </span>
                    </div>

                    <p className="text-slate-500 italic">
                      <span aria-hidden="true">🥣</span> {med.mealInstruction}
                    </p>

                    {med.foodRule && (
                      <p className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                        <strong>Dietary Rule:</strong> {med.foodRule}
                      </p>
                    )}

                    {med.interactionWarning && (
                      <p className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium">
                        <span aria-hidden="true">⚠️</span> {med.interactionWarning}
                      </p>
                    )}
                  </div>

                  {/* Stock Level & Restock Action */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Stock:</span>
                      <span
                        className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full border ${
                          isLowStock
                            ? "bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {med.remainingPills} pills left {isLowStock ? "(Critical)" : ""}
                      </span>
                    </div>

                    <button
                      id={`btn-restock-${med.id}`}
                      type="button"
                      aria-label={`Restock 30 pills for ${med.name}`}
                      onClick={() => {
                        restockMedication(med.id, 30);
                        setMedSuccessNotice(`Restocked +30 pills for ${med.name}.`);
                        setTimeout(() => setMedSuccessNotice(null), 3000);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1 active:scale-95 border border-slate-200"
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      +30 Refill
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: APPOINTMENTS MANAGEMENT                                            */}
      {/* ========================================================================= */}
      {activeTab === "appointments" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                Specialist Consultations & Check-ups ({appointments.length})
              </h2>
              <p className="text-xs text-slate-500">
                Manage upcoming clinic reviews, toggle SMS/email reminders, and record clinic notes.
              </p>
            </div>

            <button
              id="btn-open-add-apt-modal"
              type="button"
              aria-label="Add Appointment, open consultation scheduling form"
              onClick={() => {
                setAptFormData({
                  doctorName: "",
                  specialty: "",
                  date: "",
                  time: "",
                  location: "",
                  notes: "",
                });
                setAptFormError(null);
                setIsAddAptModalOpen(true);
              }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition active:scale-98"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add Appointment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {appointments.map((apt) => (
              <article
                key={apt.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {apt.doctorName}
                    </h3>
                    <p className="text-xs text-indigo-700 font-semibold">
                      {apt.specialty}
                    </p>
                  </div>

                  <span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-50 text-slate-700 rounded-lg border border-slate-200">
                    {apt.date} • {apt.time}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p>
                    <span aria-hidden="true">📍</span> Location: <strong>{apt.location}</strong>
                  </p>
                  {apt.notes && (
                    <p className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 italic">
                      <span aria-hidden="true">📝</span> {apt.notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    id={`btn-toggle-reminder-${apt.id}`}
                    type="button"
                    aria-label={`${
                      apt.reminderSent ? "Reminder Active" : "Reminder Off"
                    }, toggle consultation reminder status for ${apt.doctorName}`}
                    onClick={() => toggleAppointmentReminder(apt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      apt.reminderSent
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                        : "bg-slate-50 text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {apt.reminderSent ? (
                      <>
                        <Bell className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                        Reminder Active
                      </>
                    ) : (
                      <>
                        <BellOff className="w-3.5 h-3.5" aria-hidden="true" />
                        Reminder Off
                      </>
                    )}
                  </button>

                  <button
                    id={`btn-delete-apt-${apt.id}`}
                    type="button"
                    aria-label={`Cancel appointment with ${apt.doctorName}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Cancel scheduled appointment with ${apt.doctorName}?`
                        )
                      ) {
                        deleteAppointment(apt.id);
                        setAptSuccessNotice(`Cancelled appointment with ${apt.doctorName}.`);
                        setTimeout(() => setAptSuccessNotice(null), 3000);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EMAILS & NOTIFICATIONS CENTER (EMBEDDED)                          */}
      {/* ========================================================================= */}
      {activeTab === "emails" && <EmailNotificationCenter />}

      {/* ========================================================================= */}
      {/* TAB 4: CLINICAL REPORTS (SHIFT HANDOVER & PRINTABLE BRIEF)               */}
      {/* ========================================================================= */}
      {activeTab === "reports" && <ClinicalReports />}

      {/* ========================================================================= */}
      {/* TAB 5: AUDIT ACTIVITY LOG LIST                                           */}
      {/* ========================================================================= */}
      {activeTab === "activity" && (
        <section
          aria-label="Audit Activity Log Section"
          className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                Comprehensive Care Audit Trail ({filteredLogs.length})
              </h2>
              <p className="text-xs text-slate-500">
                Timestamped records of dose confirmations, vitals, AI interactions, safety lockouts, and doctor appointments.
              </p>
            </div>

            {/* Severity Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                id="btn-filter-log-all"
                type="button"
                aria-label="All Severities, filter all log entries"
                onClick={() => setLogSeverityFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  logSeverityFilter === "all"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                id="btn-filter-log-normal"
                type="button"
                aria-label="Normal Severity, filter normal log entries"
                onClick={() => setLogSeverityFilter("normal")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  logSeverityFilter === "normal"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                Normal
              </button>
              <button
                id="btn-filter-log-high"
                type="button"
                aria-label="High Severity, filter high priority log entries"
                onClick={() => setLogSeverityFilter("high")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  logSeverityFilter === "high"
                    ? "bg-amber-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                High
              </button>
              <button
                id="btn-filter-log-critical"
                type="button"
                aria-label="Critical Severity, filter critical safety log entries"
                onClick={() => setLogSeverityFilter("critical")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  logSeverityFilter === "critical"
                    ? "bg-rose-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                Critical
              </button>
            </div>
          </div>

          {/* Search Logs */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" aria-hidden="true" />
            <input
              id="input-search-logs"
              type="text"
              aria-label="Search activity logs, filter by keyword or role"
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              placeholder="Search activity by message, role, or action..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          {/* Logs List */}
          <div className="space-y-2.5">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
                No activity logs match the selected filter.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isCrit = log.severity === "critical";
                const isHigh = log.severity === "high";

                return (
                  <article
                    key={log.id}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs transition ${
                      isCrit
                        ? "bg-rose-50 border-rose-200 text-rose-900"
                        : isHigh
                        ? "bg-amber-50 border-amber-200 text-amber-900"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase font-mono ${
                            isCrit
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : isHigh
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-white text-slate-700 border border-slate-200"
                          }`}
                        >
                          {log.role}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {log.timestamp}
                        </span>
                      </div>
                      <p className="text-slate-900 font-semibold">{log.message}</p>
                    </div>

                    <span
                      className={`text-[10px] uppercase font-bold shrink-0 px-2 py-0.5 rounded ${
                        isCrit
                          ? "text-rose-700"
                          : isHigh
                          ? "text-amber-700"
                          : "text-slate-500"
                      }`}
                    >
                      {log.severity}
                    </span>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT MEDICATION                                             */}
      {/* ========================================================================= */}
      {isAddMedModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="med-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
        >
          <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <header className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl border border-purple-200">
                  <Pill className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="med-modal-title" className="text-base font-bold text-slate-900">
                    {editingMed ? `Edit Medication: ${editingMed.name}` : "Add New Approved Medication"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Input validated & sanitized with XSS protection
                  </p>
                </div>
              </div>

              <button
                id="btn-close-med-modal"
                type="button"
                aria-label="Close Medication Modal, cancel medication entry"
                onClick={() => setIsAddMedModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </header>

            <form onSubmit={handleSubmitMedForm} className="p-6 space-y-4 text-xs">
              {medFormError && (
                <div
                  role="alert"
                  className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800"
                >
                  {medFormError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="input-family-med-name" className="block text-slate-700 font-bold mb-1">
                    Medication Name *
                  </label>
                  <input
                    id="input-family-med-name"
                    type="text"
                    required
                    aria-label="Medication Name, trade or generic drug title"
                    value={medFormData.name}
                    onChange={(e) => setMedFormData({ ...medFormData, name: e.target.value })}
                    placeholder="e.g. Atorvastatin"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="input-family-med-dosage" className="block text-slate-700 font-bold mb-1">
                    Dosage *
                  </label>
                  <input
                    id="input-family-med-dosage"
                    type="text"
                    required
                    aria-label="Dosage, clinical strength in mg or ml"
                    value={medFormData.dosage}
                    onChange={(e) => setMedFormData({ ...medFormData, dosage: e.target.value })}
                    placeholder="e.g. 20mg"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="input-family-med-frequency" className="block text-slate-700 font-bold mb-1">
                    Frequency
                  </label>
                  <input
                    id="input-family-med-frequency"
                    type="text"
                    aria-label="Frequency, daily administration frequency"
                    value={medFormData.frequency}
                    onChange={(e) => setMedFormData({ ...medFormData, frequency: e.target.value })}
                    placeholder="e.g. Twice Daily (1-0-1)"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="input-family-med-slots" className="block text-slate-700 font-bold mb-1">
                    Daily Slots (Comma-separated)
                  </label>
                  <input
                    id="input-family-med-slots"
                    type="text"
                    aria-label="Daily Slots, comma-separated daily administration hours"
                    value={medFormData.timeSlots}
                    onChange={(e) => setMedFormData({ ...medFormData, timeSlots: e.target.value })}
                    placeholder="08:00 AM, 08:00 PM"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="input-family-med-appearance" className="block text-slate-700 font-bold mb-1">
                    Pill Appearance
                  </label>
                  <input
                    id="input-family-med-appearance"
                    type="text"
                    aria-label="Pill Appearance, visual shape and color description"
                    value={medFormData.pillAppearance}
                    onChange={(e) => setMedFormData({ ...medFormData, pillAppearance: e.target.value })}
                    placeholder="e.g. White Round Tablet"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="input-family-med-pills" className="block text-slate-700 font-bold mb-1">
                    Initial Pill Stock Count *
                  </label>
                  <input
                    id="input-family-med-pills"
                    type="number"
                    min="0"
                    required
                    aria-label="Initial Pill Stock Count, quantity of pills currently in stock"
                    value={medFormData.remainingPills}
                    onChange={(e) => setMedFormData({ ...medFormData, remainingPills: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="input-family-med-meal" className="block text-slate-700 font-bold mb-1">
                  Meal Instruction
                </label>
                <input
                  id="input-family-med-meal"
                  type="text"
                  aria-label="Meal Instruction, dietary timing relative to breakfast, lunch, or dinner"
                  value={medFormData.mealInstruction}
                  onChange={(e) => setMedFormData({ ...medFormData, mealInstruction: e.target.value })}
                  placeholder="e.g. Take 15 mins after dinner"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="input-family-med-food" className="block text-slate-700 font-bold mb-1">
                  Dietary / Food Caution (Optional)
                </label>
                <input
                  id="input-family-med-food"
                  type="text"
                  aria-label="Dietary or Food Caution, dietary warnings like avoid grapefruit"
                  value={medFormData.foodRule}
                  onChange={(e) => setMedFormData({ ...medFormData, foodRule: e.target.value })}
                  placeholder="e.g. Avoid grapefruit juice; increases toxicity"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="input-family-med-warning" className="block text-slate-700 font-bold mb-1">
                  Critical Drug Interaction Flag (Optional)
                </label>
                <input
                  id="input-family-med-warning"
                  type="text"
                  aria-label="Critical Drug Interaction Flag, high-risk drug-drug warnings"
                  value={medFormData.interactionWarning}
                  onChange={(e) => setMedFormData({ ...medFormData, interactionWarning: e.target.value })}
                  placeholder="e.g. High bleeding risk if combined with NSAIDs"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  id="btn-cancel-med-form"
                  type="button"
                  aria-label="Cancel, dismiss medication modal"
                  onClick={() => setIsAddMedModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                >
                  Cancel
                </button>

                <button
                  id="btn-save-med-form"
                  type="submit"
                  aria-label="Save Medication, commit medication to platform care records"
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-sm transition active:scale-95"
                >
                  {editingMed ? "Update Medication" : "Save Medication"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD APPOINTMENT                                                    */}
      {/* ========================================================================= */}
      {isAddAptModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="apt-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
        >
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <header className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200">
                  <Calendar className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="apt-modal-title" className="text-base font-bold text-slate-900">
                    Schedule Doctor Consultation
                  </h3>
                  <p className="text-xs text-slate-500">
                    Input validated & sanitized with XSS protection
                  </p>
                </div>
              </div>

              <button
                id="btn-close-apt-modal"
                type="button"
                aria-label="Close Appointment Modal, cancel appointment entry"
                onClick={() => setIsAddAptModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </header>

            <form onSubmit={handleSubmitAptForm} className="p-6 space-y-4 text-xs">
              {aptFormError && (
                <div
                  role="alert"
                  className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800"
                >
                  {aptFormError}
                </div>
              )}

              <div>
                <label htmlFor="input-family-apt-doctor" className="block text-slate-700 font-bold mb-1">
                  Physician Name *
                </label>
                <input
                  id="input-family-apt-doctor"
                  type="text"
                  required
                  aria-label="Physician Name, doctor full title"
                  value={aptFormData.doctorName}
                  onChange={(e) => setAptFormData({ ...aptFormData, doctorName: e.target.value })}
                  placeholder="e.g. Dr. A. K. Sharma"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="input-family-apt-specialty" className="block text-slate-700 font-bold mb-1">
                  Medical Specialty
                </label>
                <input
                  id="input-family-apt-specialty"
                  type="text"
                  aria-label="Medical Specialty, clinical department"
                  value={aptFormData.specialty}
                  onChange={(e) => setAptFormData({ ...aptFormData, specialty: e.target.value })}
                  placeholder="e.g. Cardiology & INR Review"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="input-family-apt-date" className="block text-slate-700 font-bold mb-1">
                    Date *
                  </label>
                  <input
                    id="input-family-apt-date"
                    type="date"
                    required
                    aria-label="Consultation Date, appointment date"
                    value={aptFormData.date}
                    onChange={(e) => setAptFormData({ ...aptFormData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="input-family-apt-time" className="block text-slate-700 font-bold mb-1">
                    Time *
                  </label>
                  <input
                    id="input-family-apt-time"
                    type="text"
                    required
                    aria-label="Consultation Time, appointment time"
                    value={aptFormData.time}
                    onChange={(e) => setAptFormData({ ...aptFormData, time: e.target.value })}
                    placeholder="e.g. 10:30 AM"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="input-family-apt-location" className="block text-slate-700 font-bold mb-1">
                  Location / Clinic Room
                </label>
                <input
                  id="input-family-apt-location"
                  type="text"
                  aria-label="Clinic Location, hospital or consultation room"
                  value={aptFormData.location}
                  onChange={(e) => setAptFormData({ ...aptFormData, location: e.target.value })}
                  placeholder="e.g. City Heart Clinic, Room 204"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="input-family-apt-notes" className="block text-slate-700 font-bold mb-1">
                  Preparation Notes / Instructions
                </label>
                <textarea
                  id="input-family-apt-notes"
                  rows={2}
                  aria-label="Preparation Notes, items to bring or lab instructions"
                  value={aptFormData.notes}
                  onChange={(e) => setAptFormData({ ...aptFormData, notes: e.target.value })}
                  placeholder="e.g. Bring 30-day medication adherence brief and blood pressure log..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  id="btn-cancel-apt-form"
                  type="button"
                  aria-label="Cancel, dismiss appointment modal"
                  onClick={() => setIsAddAptModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                >
                  Cancel
                </button>

                <button
                  id="btn-save-apt-form"
                  type="submit"
                  aria-label="Schedule Appointment, commit appointment to platform records"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition active:scale-95"
                >
                  Schedule Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
