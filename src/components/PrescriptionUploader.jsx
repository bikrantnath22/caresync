/**
 * CareSync AI — PrescriptionUploader Component
 * Optical/document prescription uploader with AI-powered extraction,
 * multimodal image OCR vision, deterministic rule-based interaction guardrails,
 * mandatory clinical review editing, and ecosystem synchronization.
 */

import React, { useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  FileText,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Calendar,
  Pill,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Image as ImageIcon,
  Trash2,
  Info,
  Cloud,
} from "lucide-react";
import { useCare } from "../context/CareContext";
import {
  validatePrescriptionFile,
  getStoredConsent,
  setStoredConsent,
} from "../utils/security";
import { parsePrescriptionAndCheckInteractions } from "../services/aiService";
import { INTERACTION_DISCLAIMER } from "../utils/interactionRules";

/**
 * PrescriptionUploader: handles prescription file uploads, 1-click sample demo,
 * multi-field review editing with "Assumed — please verify" badges, and ecosystem sync.
 *
 * @param {{ onSyncComplete?: Function }} props
 * @returns {JSX.Element}
 */
export default function PrescriptionUploader({ onSyncComplete }) {
  const {
    medications,
    elderProfile,
    addMedication,
    addAppointment,
    addLog,
  } = useCare();

  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [validationError, setValidationError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [editableMeds, setEditableMeds] = useState([]);
  const [editableAppointment, setEditableAppointment] = useState(null);
  const [syncAppointment, setSyncAppointment] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  // Core processing function for both uploaded file and 1-click sample
  const processPrescription = useCallback(
    async (fileOrSampleMeta) => {
      setValidationError("");
      setIsSynced(false);
      setIsAnalyzing(true);
      setExtractedData(null);
      setEditableMeds([]);
      setEditableAppointment(null);
      setSyncAppointment(false);

      try {
        const result = await parsePrescriptionAndCheckInteractions(
          fileOrSampleMeta,
          medications,
          elderProfile
        );
        setExtractedData(result);
        setEditableMeds(
          Array.isArray(result.extractedMedications)
            ? result.extractedMedications.map((m) => ({ ...m }))
            : []
        );
        setEditableAppointment(
          result.extractedAppointment ? { ...result.extractedAppointment } : null
        );
        setSyncAppointment(Boolean(result.extractedAppointment));
      } catch (err) {
        setValidationError(
          err?.message ||
            "Failed to analyze prescription. Please retry or enter medications manually."
        );
        setExtractedData(null);
        setEditableMeds([]);
        setEditableAppointment(null);
        setSyncAppointment(false);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [medications, elderProfile]
  );

  // Unified file processor with client-side optimization for Gemini Vision OCR
  const handleProcessFile = (file) => {
    const validation = validatePrescriptionFile(file);
    if (!validation.valid) {
      setValidationError(validation.error);
      setSelectedFile(null);
      setImagePreviewUrl(null);
      return;
    }

    // Auto-grant cloud consent for this intentional user file upload if not explicitly declined
    if (getStoredConsent() !== "declined") {
      setStoredConsent("granted");
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawUrl = event.target?.result;
      if (typeof rawUrl === "string") {
        if (file.type.startsWith("image/")) {
          const img = new Image();
          img.onload = () => {
            const maxDim = 1400;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedUrl = canvas.toDataURL("image/jpeg", 0.88);
            setImagePreviewUrl(optimizedUrl);
            const base64Data = optimizedUrl.split(",")[1];
            processPrescription({
              isSample: false,
              base64Data,
              mimeType: "image/jpeg",
              fileName: file.name,
              fileSize: file.size,
            });
          };
          img.src = rawUrl;
        } else {
          setImagePreviewUrl(null);
          const base64Data = rawUrl.split(",")[1];
          processPrescription({
            isSample: false,
            base64Data,
            mimeType: file.type || "application/pdf",
            fileName: file.name,
            fileSize: file.size,
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // File selection handler
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessFile(file);
  };

  // 1-Click Sample Demonstration Button handler (allows offline sample fallback)
  const handleLoadSample = () => {
    setImagePreviewUrl(null);
    setSelectedFile({
      name: "Dr_Sharma_Official_Prescription_Cardiology.pdf",
      size: 142050,
      type: "application/pdf",
    });
    processPrescription({
      isSample: true,
      fileName: "Dr_Sharma_Official_Prescription_Cardiology.pdf",
      doctor: "Dr. A. K. Sharma",
      clinic: "City Heart Care Clinic",
      rxDate: new Date().toISOString().split("T")[0],
      rawRxText:
        "Rx:\n1. Atorvastatin 20mg - 1 tab at bedtime (0-0-1), 30 days. Advice: Avoid grapefruit juice.\n2. Aspirin 75mg - 1 tab after lunch (0-1-0), 15 days.\nAdvice: Follow up with Dr. R. Baruah (Endocrinology & Lipid Review) in 14 days at 11:00 AM.",
    });
  };

  // Medication field edit handler for review step
  const handleUpdateMedField = (index, field, value) => {
    setEditableMeds((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  // Remove a medication from review
  const handleRemoveMed = (index) => {
    setEditableMeds((prev) => prev.filter((_, i) => i !== index));
  };

  // Update appointment field
  const handleUpdateAppointmentField = (field, value) => {
    setEditableAppointment((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  // Approve & Sync with CareContext (uses user-reviewed data)
  const handleApproveAndSync = () => {
    if (!editableMeds || editableMeds.length === 0) return;

    // 1. Add reviewed & edited medications to CareContext (persisted via CareContext)
    editableMeds.forEach((med) => {
      const timeSlots = Array.isArray(med.timeSlots)
        ? med.timeSlots
        : typeof med.timeSlots === "string"
        ? med.timeSlots.split(",").map((s) => s.trim()).filter(Boolean)
        : ["08:00 AM"];

      addMedication({
        ...med,
        timeSlots,
        remainingPills: Number(med.remainingPills) || 30,
      });
    });

    // 2. Add follow-up appointment ONLY if present and user explicitly opted in
    if (syncAppointment && editableAppointment) {
      addAppointment(editableAppointment);
    }

    // 3. Log event
    const apptText =
      syncAppointment && editableAppointment
        ? " and 1 follow-up appointment"
        : "";
    addLog(
      "Prescription AI",
      "ecosystem-sync",
      "high",
      `Synchronized ${editableMeds.length} medications${apptText} from verified prescription review.`
    );

    setIsSynced(true);

    if (typeof onSyncComplete === "function") {
      onSyncComplete({
        extractedMedications: editableMeds,
        extractedAppointment: syncAppointment ? editableAppointment : null,
        interactionWarnings: extractedData?.interactionWarnings || [],
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setExtractedData(null);
    setEditableMeds([]);
    setEditableAppointment(null);
    setSyncAppointment(false);
    setValidationError("");
    setIsSynced(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <section
      aria-label="Smart Prescription Uploader & AI Interaction Guardrail"
      className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-sky-500/20">
            <Sparkles className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Smart Prescription Scanner & Multimodal Guardrail AI
            </h2>
            <p className="text-xs text-slate-400">
              Upload prescription images or PDFs for Gemini Vision OCR extraction, drug-drug conflict checks, and clinical review.
            </p>
          </div>
        </div>

        <button
          id="btn-load-sample-prescription"
          type="button"
          aria-label="Load Sample Prescription (1-Click Demo), load pre-built clinical prescription"
          onClick={handleLoadSample}
          disabled={isAnalyzing}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-sky-500/20 transition active:scale-95 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          Load Sample Prescription (1-Click Demo)
        </button>
      </div>

      {/* Permanent Clinical Advisory Note (Rule 7) */}
      <div
        role="note"
        aria-label="Clinical interaction disclaimer"
        className="p-3.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-slate-300 flex items-center gap-2.5"
      >
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
        <span>
          <strong className="text-amber-300">Clinical Verification Note:</strong>{" "}
          {INTERACTION_DISCLAIMER}
        </span>
      </div>

      {/* Validation Error Message */}
      {validationError && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 rounded-xl bg-red-950/90 border border-red-500 text-red-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
            <span className="font-semibold">{validationError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {validationError.includes("Cloud AI consent") && (
              <button
                id="btn-enable-cloud-consent"
                type="button"
                aria-label="Enable Cloud AI Now, grant cloud AI consent"
                onClick={() => {
                  setStoredConsent("granted");
                  setValidationError("");
                  if (selectedFile) {
                    handleProcessFile(selectedFile);
                  }
                }}
                className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
              >
                <Cloud className="w-4 h-4" aria-hidden="true" />
                Enable Cloud AI Now
              </button>
            )}
            <button
              id="btn-retry-upload"
              type="button"
              aria-label="Clear & Retry, reset prescription upload"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg bg-red-900/80 hover:bg-red-800 text-white text-xs font-bold transition"
            >
              Clear & Retry
            </button>
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Zone + Image Thumbnail Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer flex flex-col justify-center items-center ${
            imagePreviewUrl ? "md:col-span-2" : "md:col-span-3"
          } ${
            isDragging
              ? "border-sky-400 bg-sky-500/10 scale-[1.01]"
              : "border-slate-700 bg-slate-950/60 hover:border-slate-500 hover:bg-slate-950/80"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            id="prescription-file-input"
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            aria-label="Upload prescription file (PNG, JPG, JPEG, PDF up to 5MB)"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-14 h-14 mb-3 rounded-2xl bg-slate-800/80 text-sky-400 flex items-center justify-center border border-slate-700">
            <UploadCloud className="w-7 h-7" aria-hidden="true" />
          </div>

          <p className="text-sm font-semibold text-white mb-1">
            {selectedFile ? (
              <span className="text-sky-300 font-mono flex items-center justify-center gap-1.5">
                <FileText className="w-4 h-4" aria-hidden="true" />
                {selectedFile.name}
              </span>
            ) : (
              "Drag & drop doctor prescription here, or click to browse"
            )}
          </p>

          <p className="text-xs text-slate-400">
            Multimodal AI reads handwriting & printed Rx (PNG, JPG, JPEG, PDF up to 5MB)
          </p>
        </div>

        {/* Thumbnail Preview if an Image is Uploaded */}
        {imagePreviewUrl && (
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center justify-center relative">
            <span className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              Uploaded Prescription
            </span>
            <img
              src={imagePreviewUrl}
              alt="Uploaded doctor prescription preview"
              className="max-h-40 rounded-xl object-contain border border-slate-700 shadow-md"
            />
          </div>
        )}
      </div>

      {/* AI Processing Status */}
      {isAnalyzing && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-6 rounded-2xl bg-sky-950/50 border border-sky-500/40 text-center flex flex-col items-center justify-center gap-3 animate-pulse"
        >
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" aria-hidden="true" />
          <h3 className="text-base font-bold text-white">
            CareSync Vision OCR Analyzing Prescription...
          </h3>
          <p className="text-xs text-sky-200 max-w-md">
            Reading handwritten medications, dosages, lab tests, and running deterministic clinical interaction rules.
          </p>
        </div>
      )}

      {/* AI Extraction Preview Results with Mandatory Review Editing (Rule 5) */}
      {extractedData && !isAnalyzing && (
        <div className="space-y-6 animate-fade-in">
          {/* Success Banner if Synced */}
          {isSynced && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-sm font-semibold flex items-center justify-between gap-3 shadow-lg shadow-emerald-950/50"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>
                  Prescription Approved! Medications, interaction alerts, and selected appointments synchronized with CareSync AI.
                </span>
              </div>
              <button
                id="btn-scan-another"
                type="button"
                aria-label="Scan Another, process another prescription"
                onClick={handleReset}
                className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition"
              >
                Scan Another
              </button>
            </div>
          )}

          {/* Clinical Guardrails Warning Cards (Amber / Red with Rule-Based vs LLM badges) */}
          {extractedData.interactionWarnings &&
            extractedData.interactionWarnings.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" aria-hidden="true" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-red-300">
                    Clinical Interaction Guardrails Detected ({extractedData.interactionWarnings.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {extractedData.interactionWarnings.map((warn) => {
                    const isCrit = warn.severity === "critical";
                    return (
                      <article
                        key={warn.id}
                        role="alert"
                        aria-live="assertive"
                        className={`p-4 rounded-xl border-2 flex flex-col justify-between gap-3 shadow-md ${
                          isCrit
                            ? "bg-red-950/80 border-red-500/70 text-red-100"
                            : "bg-amber-950/80 border-amber-500/70 text-amber-100"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              {isCrit ? (
                                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
                              ) : (
                                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
                              )}
                              <span
                                className={`text-xs font-black uppercase px-2 py-0.5 rounded-full ${
                                  isCrit
                                    ? "bg-red-500 text-white"
                                    : "bg-amber-500 text-slate-900"
                                }`}
                              >
                                {warn.type}
                              </span>
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                warn.source === "rule-based"
                                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                  : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                              }`}
                            >
                              {warn.source === "rule-based" ? "Rule-based" : "AI-detected"}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-white mt-1">
                            {warn.title}
                          </h4>

                          <p className="text-xs leading-relaxed text-slate-200 mt-1">
                            {warn.warning}
                          </p>
                        </div>

                        <div className="text-[11px] pt-2 border-t border-white/10 font-medium text-slate-300">
                          <strong className="text-white">Action Required: </strong>
                          {warn.action}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Interactive Review & Edit Step for Medications (Rule 5) */}
          {editableMeds.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill className="w-5 h-5 text-sky-400" aria-hidden="true" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-sky-300">
                    Review Extracted Medications ({editableMeds.length})
                  </h3>
                </div>
                <span className="text-xs text-slate-400">
                  Verify or edit names, dosages, time slots, and pill counts before saving.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editableMeds.map((med, idx) => (
                  <article
                    key={med.id || idx}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-700 space-y-3 shadow-md"
                  >
                    {/* Header: Medication Name + Remove Button */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <label
                          htmlFor={`edit-med-name-${idx}`}
                          className="text-xs font-bold text-slate-300 block mb-1"
                        >
                          Medication Name
                        </label>
                        <input
                          id={`edit-med-name-${idx}`}
                          type="text"
                          aria-label={`Edit medication name for medicine ${idx + 1}`}
                          value={med.name}
                          onChange={(e) =>
                            handleUpdateMedField(idx, "name", e.target.value)
                          }
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-bold focus:border-sky-500 focus:outline-none"
                        />
                        {/* Generic Name Label (Rule 9: AI-suggested generic — verify) */}
                        {med.genericName && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[11px] text-slate-400">
                              Active: {med.genericName}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                              AI-suggested generic — verify
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        id={`btn-remove-med-${idx}`}
                        type="button"
                        aria-label={`Remove ${med.name} from sync review`}
                        onClick={() => handleRemoveMed(idx)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-900 transition"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>

                    {/* Dosage & Pill Count with Assumed Badges (Rule 4) */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            htmlFor={`edit-med-dosage-${idx}`}
                            className="text-xs font-bold text-slate-300"
                          >
                            Dosage
                          </label>
                          {med.sources?.dosage === "assumed" && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Assumed — verify
                            </span>
                          )}
                        </div>
                        <input
                          id={`edit-med-dosage-${idx}`}
                          type="text"
                          aria-label={`Edit dosage for ${med.name}`}
                          value={med.dosage}
                          onChange={(e) =>
                            handleUpdateMedField(idx, "dosage", e.target.value)
                          }
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-sky-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            htmlFor={`edit-med-pills-${idx}`}
                            className="text-xs font-bold text-slate-300"
                          >
                            Pill Count
                          </label>
                          {med.sources?.remainingPills === "assumed" && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Assumed — verify
                            </span>
                          )}
                        </div>
                        <input
                          id={`edit-med-pills-${idx}`}
                          type="number"
                          aria-label={`Edit remaining pill count for ${med.name}`}
                          value={med.remainingPills}
                          onChange={(e) =>
                            handleUpdateMedField(idx, "remainingPills", e.target.value)
                          }
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-sky-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Time Slots with Assumed Badge (Rule 4) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor={`edit-med-times-${idx}`}
                          className="text-xs font-bold text-slate-300"
                        >
                          Time Slots (e.g. 08:00 AM, 08:00 PM)
                        </label>
                        {med.sources?.timeSlots === "assumed" && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            Assumed — verify
                          </span>
                        )}
                      </div>
                      <input
                        id={`edit-med-times-${idx}`}
                        type="text"
                        aria-label={`Edit scheduled time slots for ${med.name}`}
                        value={
                          Array.isArray(med.timeSlots)
                            ? med.timeSlots.join(", ")
                            : med.timeSlots || ""
                        }
                        onChange={(e) =>
                          handleUpdateMedField(idx, "timeSlots", e.target.value)
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    {/* Meal Instruction */}
                    <div>
                      <label
                        htmlFor={`edit-med-meal-${idx}`}
                        className="text-xs font-bold text-slate-300 block mb-1"
                      >
                        Meal Instruction
                      </label>
                      <input
                        id={`edit-med-meal-${idx}`}
                        type="text"
                        aria-label={`Edit meal instruction for ${med.name}`}
                        value={med.mealInstruction || ""}
                        onChange={(e) =>
                          handleUpdateMedField(idx, "mealInstruction", e.target.value)
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    {/* Food Rule / Dietary Warning if applicable */}
                    {med.foodRule && (
                      <div className="text-[11px] bg-slate-900 p-2 rounded-lg border border-slate-800 text-amber-200/90 font-medium">
                        <span aria-hidden="true">⚠️</span> <strong>Dietary:</strong> {med.foodRule}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up Appointment Review (Rule 5: Optional, synced ONLY if present) */}
          {editableAppointment && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" aria-hidden="true" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-300">
                  Follow-up Doctor Consultation
                </h3>
              </div>

              <article className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-white">
                    <input
                      id="chk-sync-appointment"
                      type="checkbox"
                      aria-label="Include follow-up appointment in synchronization"
                      checked={syncAppointment}
                      onChange={(e) => setSyncAppointment(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                    />
                    <span>
                      Include Follow-up with {editableAppointment.doctorName}
                    </span>
                  </label>

                  {editableAppointment.dateSource === "assumed" && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Date Assumed — please verify
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="edit-apt-doctor"
                      className="text-xs font-bold text-slate-300 block mb-1"
                    >
                      Doctor / Clinic
                    </label>
                    <input
                      id="edit-apt-doctor"
                      type="text"
                      aria-label="Edit follow-up doctor name"
                      value={editableAppointment.doctorName || ""}
                      onChange={(e) =>
                        handleUpdateAppointmentField("doctorName", e.target.value)
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-apt-date"
                      className="text-xs font-bold text-slate-300 block mb-1"
                    >
                      Follow-up Date
                    </label>
                    <input
                      id="edit-apt-date"
                      type="date"
                      aria-label="Edit appointment date"
                      value={editableAppointment.date || ""}
                      onChange={(e) =>
                        handleUpdateAppointmentField("date", e.target.value)
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-apt-time"
                      className="text-xs font-bold text-slate-300 block mb-1"
                    >
                      Time
                    </label>
                    <input
                      id="edit-apt-time"
                      type="text"
                      aria-label="Edit appointment time"
                      value={editableAppointment.time || "10:00 AM"}
                      onChange={(e) =>
                        handleUpdateAppointmentField("time", e.target.value)
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {editableAppointment.notes && (
                  <p className="text-xs text-slate-300 italic">
                    <span aria-hidden="true">📝</span> {editableAppointment.notes}
                  </p>
                )}
              </article>
            </div>
          )}

          {/* Approve & Synchronize Button (Rule 5: accurate count, no fake +1 appointment) */}
          {!isSynced && (
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                id="btn-approve-sync-ecosystem"
                type="button"
                disabled={editableMeds.length === 0}
                aria-label={`Approve & Sync Ecosystem, synchronize ${editableMeds.length} medications and records`}
                onClick={handleApproveAndSync}
                className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 transition active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                Approve & Sync Ecosystem ({editableMeds.length} Med
                {editableMeds.length === 1 ? "" : "s"}
                {syncAppointment && editableAppointment
                  ? " + 1 Appointment"
                  : ""}
                )
                <ArrowRight className="w-4 h-4 ml-1" aria-hidden="true" />
              </button>

              <button
                id="btn-discard-preview"
                type="button"
                aria-label="Discard, discard prescription preview"
                onClick={handleReset}
                className="py-3.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-sm transition border border-slate-700"
              >
                Discard
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
