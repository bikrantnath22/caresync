/**
 * CareSync AI — CaretakerDashboard Component (PIN 2222)
 * Comprehensive Caretaker Shift Station featuring:
 * 1. Interactive Shift Checklist & Progress Tracking
 * 2. Clinical Vitals Logger with Real-Time Safety Ranges (BP, Glucose, HR, SpO2, Temp)
 * 3. Medication Administration Table with Double-Dose Overdose Lockout
 * 4. Embedded AI Prescription Scanner for New Orders
 * 5. AI 12-Hour Shift Handover Brief Generator
 * 6. Shift Audit Activity Feed
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  HeartPulse,
  Activity,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Send,
  ShieldAlert,
  Pill,
  Calendar,
  Thermometer,
  Droplets,
  ArrowUpRight,
  Check,
  RotateCcw,
  UserCheck,
} from "lucide-react";
import { useCare } from "../context/CareContext";
import { sanitizeInput, isDemoMode } from "../utils/security";
import PrescriptionUploader from "./PrescriptionUploader";
import ClinicalReports from "./ClinicalReports";

// Default shift checklist items for daily care routine
const INITIAL_SHIFT_TASKS = [
  {
    id: "task-1",
    text: "Verify & log morning Metformin (500mg) dose after breakfast",
    completed: true,
    time: "08:15 AM",
  },
  {
    id: "task-2",
    text: "Record morning fasting blood pressure and glucose readings",
    completed: true,
    time: "08:30 AM",
  },
  {
    id: "task-3",
    text: "Ensure elder hydration: provide 500ml warm water with morning meal",
    completed: false,
    time: "10:00 AM",
  },
  {
    id: "task-4",
    text: "Check SpO2 oxygen saturation and resting pulse",
    completed: false,
    time: "12:00 PM",
  },
  {
    id: "task-5",
    text: "Monitor for post-dose dizziness and assess fall hazards in walkway",
    completed: false,
    time: "02:00 PM",
  },
  {
    id: "task-6",
    text: "Prepare 12-hour handover summary for incoming evening caretaker",
    completed: false,
    time: "06:00 PM",
  },
];

/**
 * Evaluates clinical vitals and returns status label, color classes, and clinical alert level.
 * @param {object} vitals
 * @returns {{ bpStatus: object, glucoseStatus: object, hrStatus: object, spo2Status: object, isAnyCritical: boolean }}
 */
function evaluateVitals(vitals) {
  const sys = Number(vitals.systolic) || 0;
  const dia = Number(vitals.diastolic) || 0;
  const glu = Number(vitals.bloodGlucose) || 0;
  const hr = Number(vitals.heartRate) || 0;
  const spo2 = Number(vitals.spo2) || 0;

  // Blood Pressure Evaluation
  let bpStatus = { label: "Normal (<130/85)", color: "text-emerald-800 bg-emerald-50 border-emerald-200", severity: "normal" };
  if (sys >= 140 || dia >= 90) {
    bpStatus = { label: "High (Stage 2 Hypertension)", color: "text-rose-800 bg-rose-50 border-rose-300", severity: "critical" };
  } else if (sys >= 130 || dia >= 85) {
    bpStatus = { label: "Elevated / Pre-Hypertension", color: "text-amber-900 bg-amber-50 border-amber-300", severity: "high" };
  }

  // Blood Glucose Evaluation
  let glucoseStatus = { label: "Normal (70-140 mg/dL)", color: "text-emerald-800 bg-emerald-50 border-emerald-200", severity: "normal" };
  if (glu > 180) {
    glucoseStatus = { label: "Hyperglycemia Alert (>180 mg/dL)", color: "text-rose-800 bg-rose-50 border-rose-300", severity: "critical" };
  } else if (glu > 140) {
    glucoseStatus = { label: "Post-prandial Elevated (141-180)", color: "text-amber-900 bg-amber-50 border-amber-300", severity: "high" };
  } else if (glu < 70 && glu > 0) {
    glucoseStatus = { label: "Hypoglycemia Alert (<70 mg/dL)", color: "text-rose-800 bg-rose-50 border-rose-300", severity: "critical" };
  }

  // Heart Rate Evaluation
  let hrStatus = { label: "Normal (60-100 BPM)", color: "text-emerald-800 bg-emerald-50 border-emerald-200", severity: "normal" };
  if (hr > 100) {
    hrStatus = { label: "Tachycardia (>100 BPM)", color: "text-amber-900 bg-amber-50 border-amber-300", severity: "high" };
  } else if (hr < 60 && hr > 0) {
    hrStatus = { label: "Bradycardia (<60 BPM)", color: "text-amber-900 bg-amber-50 border-amber-300", severity: "high" };
  }

  // SpO2 Oxygen Saturation Evaluation
  let spo2Status = { label: "Normal (>=95%)", color: "text-emerald-800 bg-emerald-50 border-emerald-200", severity: "normal" };
  if (spo2 < 92 && spo2 > 0) {
    spo2Status = { label: "Critical Hypoxia (<92%)", color: "text-rose-800 bg-rose-50 border-rose-300", severity: "critical" };
  } else if (spo2 < 95 && spo2 > 0) {
    spo2Status = { label: "Low Saturation (92-94%)", color: "text-amber-900 bg-amber-50 border-amber-300", severity: "high" };
  }

  const isAnyCritical =
    bpStatus.severity === "critical" ||
    glucoseStatus.severity === "critical" ||
    spo2Status.severity === "critical";

  return { bpStatus, glucoseStatus, hrStatus, spo2Status, isAnyCritical };
}

export default function CaretakerDashboard() {
  const {
    elderProfile,
    medications,
    appointments,
    logs,
    adherenceScore,
    lowStockMedications,
    markDoseTaken,
    doubleDoseAlert,
    clearDoubleDoseAlert,
    addLog,
    triggerEscalatingEmail,
  } = useCare();

  // Active sub-tab state
  const [activeTab, setActiveTab] = useState("tasks"); // "tasks" | "medications" | "scanner" | "handover" | "logs"

  // Shift Checklist State
  const [shiftTasks, setShiftTasks] = useState(() => {
    try {
      const saved = localStorage.getItem("caresync_caretaker_tasks");
      return saved ? JSON.parse(saved) : INITIAL_SHIFT_TASKS;
    } catch {
      return INITIAL_SHIFT_TASKS;
    }
  });
  const [newTaskText, setNewTaskText] = useState("");

  // Vitals Logger Form State
  const [vitalsForm, setVitalsForm] = useState({
    systolic: "126",
    diastolic: "82",
    heartRate: "74",
    bloodGlucose: "118",
    spo2: "98",
    temperature: "98.4",
    notes: "Patient well-rested, no acute distress noted.",
  });

  // Vitals History Log
  const [vitalsHistory, setVitalsHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("caresync_vitals_history");
      return saved
        ? JSON.parse(saved)
        : [
            {
              id: "vitals-init-1",
              timestamp: "08:30 AM",
              date: "Today",
              systolic: 126,
              diastolic: 82,
              heartRate: 74,
              bloodGlucose: 118,
              spo2: 98,
              temperature: 98.4,
              notes: "Morning routine vitals. Stable.",
              severity: "normal",
            },
          ];
    } catch {
      return [];
    }
  });

  const [vitalsSavedNotice, setVitalsSavedNotice] = useState("");

  // Save tasks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("caresync_caretaker_tasks", JSON.stringify(shiftTasks));
    } catch {
      // ignore storage errors
    }
  }, [shiftTasks]);

  // Save vitals to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("caresync_vitals_history", JSON.stringify(vitalsHistory));
    } catch {
      // ignore storage errors
    }
  }, [vitalsHistory]);

  // Task Toggle Handler
  const handleToggleTask = useCallback((taskId) => {
    setShiftTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  }, []);

  // Auto-complete medication task in shift checklist when Metformin is administered
  useEffect(() => {
    const metformin = medications.find((m) => m.id === "med-1");
    if (metformin && (metformin.takenToday || (Array.isArray(metformin.takenSlots) && metformin.takenSlots.length > 0))) {
      setShiftTasks((prev) =>
        prev.map((t) => (t.id === "task-1" ? { ...t, completed: true } : t))
      );
    }
  }, [medications]);

  // Add Task Handler
  const handleAddTask = useCallback(
    (e) => {
      e.preventDefault();
      const sanitized = sanitizeInput(newTaskText);
      if (!sanitized) return;

      const newTask = {
        id: `task-${Date.now()}`,
        text: sanitized,
        completed: false,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setShiftTasks((prev) => [...prev, newTask]);
      setNewTaskText("");
      addLog("Caretaker", "task", "normal", `Added shift task: "${sanitized}"`);
    },
    [newTaskText, addLog]
  );

  // Delete Task Handler
  const handleDeleteTask = useCallback((taskId) => {
    setShiftTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  // Reset Tasks Handler
  const handleResetTasks = useCallback(() => {
    setShiftTasks(INITIAL_SHIFT_TASKS);
  }, []);

  // Vitals Input Change
  const handleVitalsChange = (field, val) => {
    setVitalsForm((prev) => ({ ...prev, [field]: val }));
    setVitalsSavedNotice("");
  };

  // Submit Vitals Log
  const handleSaveVitals = (e) => {
    e.preventDefault();
    const evaluation = evaluateVitals(vitalsForm);
    const currentTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const newRecord = {
      id: `vitals-${Date.now()}`,
      timestamp: currentTime,
      date: "Today",
      systolic: Number(vitalsForm.systolic) || 0,
      diastolic: Number(vitalsForm.diastolic) || 0,
      heartRate: Number(vitalsForm.heartRate) || 0,
      bloodGlucose: Number(vitalsForm.bloodGlucose) || 0,
      spo2: Number(vitalsForm.spo2) || 0,
      temperature: Number(vitalsForm.temperature) || 98.6,
      notes: sanitizeInput(vitalsForm.notes || ""),
      severity: evaluation.isAnyCritical ? "critical" : "normal",
    };

    setVitalsHistory((prev) => [newRecord, ...prev]);

    const logMessage = `Vitals Logged: BP ${newRecord.systolic}/${newRecord.diastolic} mmHg, HR ${newRecord.heartRate} bpm, Glucose ${newRecord.bloodGlucose} mg/dL, SpO2 ${newRecord.spo2}%. ${newRecord.notes}`;
    addLog(
      "Caretaker",
      "vitals",
      evaluation.isAnyCritical ? "critical" : "normal",
      logMessage
    );

    // If critical, dispatch escalation email to family
    if (evaluation.isAnyCritical) {
      triggerEscalatingEmail(3, {
        stage: "Stage 3: Urgent Clinical Vitals Warning",
        subject: `CRITICAL VITALS ALERT for ${elderProfile.name}`,
        body: `Critical clinical parameters logged by caretaker during shift:\n` +
          `• Blood Pressure: ${newRecord.systolic}/${newRecord.diastolic} mmHg (${evaluation.bpStatus.label})\n` +
          `• Blood Sugar: ${newRecord.bloodGlucose} mg/dL (${evaluation.glucoseStatus.label})\n` +
          `• SpO2: ${newRecord.spo2}% (${evaluation.spo2Status.label})\n` +
          `• Notes: ${newRecord.notes}\n\nPlease review clinical protocol immediately.`,
      });
      setVitalsSavedNotice(
        "Critical vitals recorded! Emergency escalation email dispatched to family."
      );
    } else {
      setVitalsSavedNotice("Vitals successfully recorded and saved to clinical log.");
    }
  };

  // Computed Checklist Completion
  const completedTaskCount = shiftTasks.filter((t) => t.completed).length;
  const taskProgressPercent =
    shiftTasks.length > 0
      ? Math.round((completedTaskCount / shiftTasks.length) * 100)
      : 0;

  // Real-time evaluation of currently entered vitals
  const currentEvaluation = useMemo(() => evaluateVitals(vitalsForm), [vitalsForm]);

  return (
    <div className="space-y-6">
      {/* Caretaker Station Hero Banner */}
      <section
        aria-label="Caretaker Shift Station Banner"
        className="p-6 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/30 to-white border border-emerald-200/90 shadow-sm"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-3.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl shadow-sm">
              <ShieldCheck className="w-8 h-8" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Caretaker Station • PIN 2222
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                  Shift Active
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                Clinical Caretaker Dashboard
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Active shift for{" "}
                <strong className="text-slate-900 font-bold">{elderProfile.name}</strong> (Age{" "}
                {elderProfile.age}) • Primary:{" "}
                <span className="text-slate-700 font-medium">{elderProfile.primaryDoctor}</span>
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-center min-w-[105px] shadow-sm">
              <span className="text-[11px] block text-slate-500 font-semibold">
                Regimen Adherence
              </span>
              <span
                className={`text-xl font-black ${
                  adherenceScore >= 80 ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {adherenceScore}%
              </span>
            </div>

            <div className="px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-center min-w-[105px] shadow-sm">
              <span className="text-[11px] block text-slate-500 font-semibold">
                Shift Checklist
              </span>
              <span className="text-xl font-black text-blue-700">
                {completedTaskCount}/{shiftTasks.length}
              </span>
            </div>

            <div className="px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-center min-w-[105px] shadow-sm">
              <span className="text-[11px] block text-slate-500 font-semibold">
                Low Pill Stock
              </span>
              <span
                className={`text-xl font-black ${
                  lowStockMedications.length > 0 ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {lowStockMedications.length}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav
          aria-label="Caretaker Station Sections"
          className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-200/80 overflow-x-auto pb-1"
        >
          <button
            id="tab-caretaker-tasks"
            type="button"
            aria-label="Shift Tasks & Vitals Logger, view checklist and vitals"
            onClick={() => setActiveTab("tasks")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === "tasks"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm"
            }`}
          >
            <Activity className="w-4 h-4" aria-hidden="true" />
            Shift Tasks & Vitals Logger
          </button>

          <button
            id="tab-caretaker-medications"
            type="button"
            aria-label="Medication Dosing & Overdose Lockout, view medication administration"
            onClick={() => setActiveTab("medications")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === "medications"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm"
            }`}
          >
            <Pill className="w-4 h-4" aria-hidden="true" />
            Medication Dosing & Overdose Lockout
          </button>

          <button
            id="tab-caretaker-scanner"
            type="button"
            aria-label="Smart Prescription AI Scanner, scan and approve prescriptions"
            onClick={() => setActiveTab("scanner")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === "scanner"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
            Smart Prescription AI Scanner
          </button>

          <button
            id="tab-caretaker-handover"
            type="button"
            aria-label="AI 12-Hour Shift Handover, generate clinical summary"
            onClick={() => setActiveTab("handover")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === "handover"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm"
            }`}
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            AI 12-Hour Shift Handover
          </button>

          <button
            id="tab-caretaker-logs"
            type="button"
            aria-label={`Shift Activity Log (${logs.length}), view shift audit events`}
            onClick={() => setActiveTab("logs")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === "logs"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm"
            }`}
          >
            <Clock className="w-4 h-4" aria-hidden="true" />
            Shift Activity Log ({logs.length})
          </button>
        </nav>
      </section>

      {/* ========================================================================= */}
      {/* TAB 1: SHIFT TASKS & CLINICAL VITALS LOGGER                               */}
      {/* ========================================================================= */}
      {activeTab === "tasks" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Shift Tasks Checklist (7 cols) */}
          <section
            aria-label="Shift Tasks Checklist"
            className="lg:col-span-7 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                <h2 className="text-lg font-bold text-slate-900">Shift Care Checklist</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">
                  {completedTaskCount} of {shiftTasks.length} Completed ({taskProgressPercent}%)
                </span>
                <button
                  id="btn-reset-shift-tasks"
                  type="button"
                  aria-label="Reset shift tasks to initial template"
                  onClick={handleResetTasks}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                  title="Reset shift tasks"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 mb-6 overflow-hidden border border-slate-200">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${taskProgressPercent}%` }}
              />
            </div>

            {/* Task Items List */}
            <ul className="space-y-3 flex-1 mb-6">
              {shiftTasks.map((task) => (
                <li
                  key={task.id}
                  className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                    task.completed
                      ? "bg-emerald-50/50 border-emerald-200 text-slate-600"
                      : "bg-white border-slate-200 text-slate-900 hover:border-slate-300 shadow-sm"
                  }`}
                >
                  <label
                    htmlFor={`check-task-${task.id}`}
                    className="flex items-center gap-3 cursor-pointer flex-1"
                  >
                    <input
                      id={`check-task-${task.id}`}
                      type="checkbox"
                      aria-label={`Mark shift task complete: ${task.text}`}
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.id)}
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span
                        className={`text-sm font-semibold ${
                          task.completed ? "line-through text-slate-400" : "text-slate-800"
                        }`}
                      >
                        {task.text}
                      </span>
                      {task.time && (
                        <span className="block text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                          <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
                          Target: {task.time}
                        </span>
                      )}
                    </div>
                  </label>

                  <button
                    id={`btn-delete-task-${task.id}`}
                    type="button"
                    aria-label={`Delete task: ${task.text}`}
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            {/* Add Custom Task Form */}
            <form onSubmit={handleAddTask} className="flex gap-2 pt-4 border-t border-slate-200">
              <input
                id="input-new-shift-task"
                type="text"
                aria-label="Add a new custom shift duty or observation"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Add custom duty (e.g. Check INR test lab report)..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                id="btn-add-shift-task"
                type="submit"
                aria-label="Add Duty, submit new shift duty to checklist"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shrink-0 active:scale-98"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Add Duty
              </button>
            </form>
          </section>

          {/* Right Column: Clinical Vitals Logger (5 cols) */}
          <section
            aria-label="Clinical Vitals Logger"
            className="lg:col-span-5 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-rose-500" aria-hidden="true" />
                <h2 className="text-lg font-bold text-slate-900">Clinical Vitals Logger</h2>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono font-semibold">
                Real-Time Ranges
              </span>
            </div>

            {/* Live Range Feedback Banner */}
            <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
              <div
                className={`p-2.5 rounded-xl border flex flex-col justify-between shadow-xs ${currentEvaluation.bpStatus.color}`}
              >
                <span className="font-semibold text-[11px] opacity-80">Blood Pressure</span>
                <span className="font-bold mt-0.5">{currentEvaluation.bpStatus.label}</span>
              </div>
              <div
                className={`p-2.5 rounded-xl border flex flex-col justify-between shadow-xs ${currentEvaluation.glucoseStatus.color}`}
              >
                <span className="font-semibold text-[11px] opacity-80">Blood Glucose</span>
                <span className="font-bold mt-0.5">{currentEvaluation.glucoseStatus.label}</span>
              </div>
              <div
                className={`p-2.5 rounded-xl border flex flex-col justify-between shadow-xs ${currentEvaluation.hrStatus.color}`}
              >
                <span className="font-semibold text-[11px] opacity-80">Heart Rate</span>
                <span className="font-bold mt-0.5">{currentEvaluation.hrStatus.label}</span>
              </div>
              <div
                className={`p-2.5 rounded-xl border flex flex-col justify-between shadow-xs ${currentEvaluation.spo2Status.color}`}
              >
                <span className="font-semibold text-[11px] opacity-80">SpO2 Oxygen</span>
                <span className="font-bold mt-0.5">{currentEvaluation.spo2Status.label}</span>
              </div>
            </div>

            {/* Vitals Form */}
            <form onSubmit={handleSaveVitals} className="space-y-3.5 flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="input-systolic"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Systolic BP (mmHg)
                  </label>
                  <input
                    id="input-systolic"
                    type="number"
                    min="60"
                    max="260"
                    aria-label="Systolic blood pressure in millimeters of mercury"
                    value={vitalsForm.systolic}
                    onChange={(e) => handleVitalsChange("systolic", e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-diastolic"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Diastolic BP (mmHg)
                  </label>
                  <input
                    id="input-diastolic"
                    type="number"
                    min="40"
                    max="160"
                    aria-label="Diastolic blood pressure in millimeters of mercury"
                    value={vitalsForm.diastolic}
                    onChange={(e) => handleVitalsChange("diastolic", e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="input-glucose"
                    className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1"
                  >
                    <Droplets className="w-3 h-3 text-sky-500" aria-hidden="true" />
                    Glucose (mg/dL)
                  </label>
                  <input
                    id="input-glucose"
                    type="number"
                    min="30"
                    max="500"
                    aria-label="Blood glucose level in milligrams per deciliter"
                    value={vitalsForm.bloodGlucose}
                    onChange={(e) => handleVitalsChange("bloodGlucose", e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-heartrate"
                    className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1"
                  >
                    <HeartPulse className="w-3 h-3 text-rose-500" aria-hidden="true" />
                    Pulse (BPM)
                  </label>
                  <input
                    id="input-heartrate"
                    type="number"
                    min="40"
                    max="220"
                    aria-label="Heart rate in beats per minute"
                    value={vitalsForm.heartRate}
                    onChange={(e) => handleVitalsChange("heartRate", e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="input-spo2"
                    className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1"
                  >
                    <Activity className="w-3 h-3 text-teal-600" aria-hidden="true" />
                    SpO2 Saturation (%)
                  </label>
                  <input
                    id="input-spo2"
                    type="number"
                    min="70"
                    max="100"
                    aria-label="Blood oxygen saturation percentage"
                    value={vitalsForm.spo2}
                    onChange={(e) => handleVitalsChange("spo2", e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-temperature"
                    className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1"
                  >
                    <Thermometer className="w-3 h-3 text-amber-500" aria-hidden="true" />
                    Temp (°F)
                  </label>
                  <input
                    id="input-temperature"
                    type="number"
                    step="0.1"
                    min="94"
                    max="106"
                    aria-label="Body temperature in degrees Fahrenheit"
                    value={vitalsForm.temperature}
                    onChange={(e) => handleVitalsChange("temperature", e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="input-vitals-notes"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Clinical Observations & Subjective Symptoms
                </label>
                <textarea
                  id="input-vitals-notes"
                  rows={2}
                  aria-label="Clinical observations, elder mood, or dizziness complaints"
                  value={vitalsForm.notes}
                  onChange={(e) => handleVitalsChange("notes", e.target.value)}
                  placeholder="Record any complaints (e.g. mild dizziness, appetite)..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
              </div>

              {vitalsSavedNotice && (
                <div
                  role="status"
                  aria-live="polite"
                  className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>{vitalsSavedNotice}</span>
                </div>
              )}

              <button
                id="btn-submit-vitals"
                type="submit"
                aria-label="Record Vitals in Clinical Log, save clinical observations"
                className="w-full py-2.5 px-4 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 font-bold text-white text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-2 active:scale-98"
              >
                <HeartPulse className="w-4 h-4" aria-hidden="true" />
                Record Vitals in Clinical Log
              </button>
            </form>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MEDICATION ADMINISTRATION & OVERDOSE LOCKOUT TABLE                */}
      {/* ========================================================================= */}
      {activeTab === "medications" && (
        <section
          aria-label="Medication Administration Table"
          className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-blue-600" aria-hidden="true" />
                <h2 className="text-xl font-bold text-slate-900">
                  Prescription Regimen & Dose Administration
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Administer scheduled doses, verify clinical warnings, or test accidental duplicate dose lockout.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold shadow-xs">
                {medications.filter((m) => m.takenToday || (Array.isArray(m.takenSlots) && m.takenSlots.length > 0)).length} of {medications.length} Given Today
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {medications.map((med) => {
              const isTaken = Boolean(med.takenToday || (Array.isArray(med.takenSlots) && med.takenSlots.length > 0));
              return (
              <article
                key={med.id}
                className={`p-5 rounded-2xl border transition ${
                  isTaken
                    ? "bg-emerald-50/20 border-emerald-300 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 text-lg">
                        {med.name}
                      </h3>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                        {med.dosage}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 block mt-0.5 font-medium">
                      {med.pillAppearance} • {med.frequency}
                    </span>
                  </div>

                  {med.remainingPills <= 5 ? (
                    <span className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1 shadow-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                      {med.remainingPills} left (Low)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-xl bg-slate-50 text-slate-600 text-xs font-mono border border-slate-200">
                      {med.remainingPills} pills left
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-4 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                    <span>
                      Scheduled: <strong>{med.timeSlots.join(", ")}</strong>
                    </span>
                  </div>

                  <p className="text-slate-600 italic">
                    <span aria-hidden="true">🥣</span> {med.mealInstruction}
                  </p>

                  {/* Per-Slot Status Badges (e.g. "08:00 AM taken, 08:00 PM pending") */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Daily Slot Status:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {med.timeSlots?.map((slot) => {
                        const slotTaken = (med.takenSlots || []).includes(slot);
                        return (
                          <button
                            key={slot}
                            id={`btn-caretaker-slot-${med.id}-${slot.replace(/[^a-zA-Z0-9]/g, "")}`}
                            type="button"
                            aria-label={`${slot} ${slotTaken ? "taken" : "pending"}, administer for ${med.name}`}
                            onClick={() => markDoseTaken(med.id, "Caretaker", slot)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition border ${
                              slotTaken
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 active:scale-95"
                            }`}
                          >
                            {slotTaken ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                            ) : (
                              <Clock className="w-3 h-3 text-blue-600" aria-hidden="true" />
                            )}
                            <span>{slot} {slotTaken ? "taken" : "pending"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {med.foodRule && (
                    <p className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                      {med.foodRule}
                    </p>
                  )}

                  {med.interactionWarning && (
                    <p className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-medium">
                      <span aria-hidden="true">⚠️</span> {med.interactionWarning}
                    </p>
                  )}
                </div>

                {/* Administration Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                  {isTaken ? (
                    <>
                      <div className="flex-1 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        Administered at {med.lastTakenAt || "08:05 AM"}
                      </div>
                      {isDemoMode() && (
                        <button
                          id={`btn-caretaker-test-lockout-${med.id}`}
                          type="button"
                          aria-label={`Test Overdose Lockout, test accidental double-dose lockout for ${med.name}`}
                          onClick={() => markDoseTaken(med.id, "Caretaker")}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition active:scale-95"
                        >
                          Test Overdose Lockout
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      id={`btn-caretaker-administer-${med.id}`}
                      type="button"
                      aria-label={`Confirm Dose Administered, mark dose taken for ${med.name} ${med.dosage}`}
                      onClick={() => markDoseTaken(med.id, "Caretaker")}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-bold text-white text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-2 active:scale-98"
                    >
                      <Check className="w-4 h-4" aria-hidden="true" />
                      Confirm Dose Administered
                    </button>
                  )}
                </div>
              </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SMART PRESCRIPTION SCANNER (EMBEDDED)                              */}
      {/* ========================================================================= */}
      {activeTab === "scanner" && (
        <section
          aria-label="Smart Prescription Scanner Section"
          className="space-y-4"
        >
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <Sparkles className="w-5 h-5 text-blue-600" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Caretaker Prescription Ingestion Station
                </h3>
                <p className="text-xs text-slate-600">
                  Scan newly issued paper prescriptions or discharge summaries to auto-detect drugs, cross-check bleeding/toxicity conflicts, and auto-schedule appointments.
                </p>
              </div>
            </div>
          </div>

          <PrescriptionUploader
            onSyncComplete={() => {
              setActiveTab("medications");
            }}
          />
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CLINICAL REPORTS & AI 12-HOUR SHIFT HANDOVER                       */}
      {/* ========================================================================= */}
      {activeTab === "handover" && <ClinicalReports />}

      {/* ========================================================================= */}
      {/* TAB 5: SHIFT ACTIVITY & AUDIT LOG                                         */}
      {/* ========================================================================= */}
      {activeTab === "logs" && (
        <section
          aria-label="Shift Audit Activity Log"
          className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" aria-hidden="true" />
              <h2 className="text-lg font-bold text-slate-900">Shift Activity & Audit Log</h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {logs.length} logged events
            </span>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {logs.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                  item.severity === "critical"
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : item.severity === "high"
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 uppercase text-[10px] px-2 py-0.5 rounded bg-white border border-slate-200">
                      {item.role}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {item.timestamp}
                    </span>
                    {item.severity === "critical" && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-extrabold text-[10px]">
                        CRITICAL
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-slate-900">{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
