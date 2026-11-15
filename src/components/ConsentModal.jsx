/**
 * CareSync AI — ConsentModal Component
 * First-use and on-demand modal explaining Google Cloud AI & Speech Recognition data transmission.
 * Allows the user or clinical caregiver to explicitly grant or decline cloud processing,
 * enabling pure offline deterministic modes when declined.
 * Portaled to document.body for accessible top z-index rendering.
 */

import React, { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ShieldCheck,
  Cloud,
  Mic,
  FileText,
  Lock,
  X,
  CheckCircle2,
  HardDriveDownload,
  AlertCircle,
} from "lucide-react";
import {
  getStoredConsent,
  setStoredConsent,
  hasCloudConsent,
} from "../utils/security";

/**
 * ConsentModal handles first-use disclosure and user control for external cloud APIs.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onConsentChange?: (newStatus: "granted" | "declined") => void,
 *   canDismissWithoutChoice?: boolean
 * }} props
 * @returns {JSX.Element|null}
 */
export default function ConsentModal({
  isOpen,
  onClose,
  onConsentChange,
  canDismissWithoutChoice = true,
}) {
  const currentStatus = getStoredConsent();
  const modalRef = useRef(null);
  const openerRef = useRef(null);

  // Focus management & Tab trapping
  useEffect(() => {
    if (isOpen) {
      openerRef.current = document.activeElement;
      const timer = setTimeout(() => {
        if (modalRef.current) {
          const focusables = modalRef.current.querySelectorAll(
            'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusables.length > 0) {
            focusables[0].focus();
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      if (openerRef.current && typeof openerRef.current.focus === "function") {
        openerRef.current.focus();
      }
    }
  }, [isOpen]);

  // Escape key & Tab trapping support
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Tab") {
        if (!modalRef.current) return;
        const focusables = Array.from(
          modalRef.current.querySelectorAll(
            'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

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
        return;
      }

      if (e.key === "Escape" && canDismissWithoutChoice) {
        onClose();
      }
    },
    [canDismissWithoutChoice, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleChoose = (status) => {
    setStoredConsent(status);
    if (typeof onConsentChange === "function") {
      onConsentChange(status);
    }
    onClose();
  };

  const modalMarkup = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
      aria-describedby="consent-modal-desc"
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-4"
    >
      <div className="min-h-full flex items-center justify-center py-4 sm:py-6">
        <div
          ref={modalRef}
          tabIndex={-1}
          className="bg-slate-900 border-2 border-sky-500/50 rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-[0_0_60px_rgba(0,0,0,0.85)] relative text-white my-auto max-h-[92vh] overflow-y-auto flex flex-col focus:outline-none"
        >
          {/* Header Row */}
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-sky-500 to-indigo-600 text-white rounded-xl shadow-md shadow-sky-500/20">
                <Cloud className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="consent-modal-title"
                  className="text-lg font-bold text-white tracking-wide"
                >
                  Cloud AI & Voice Processing Consent
                </h2>
                <p className="text-xs text-slate-400">
                  Data Transmission & Patient Privacy Disclosure
                </p>
              </div>
            </div>

            {canDismissWithoutChoice && (
              <button
                id="btn-close-consent-modal"
                type="button"
                aria-label="Close consent preferences dialog"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Description Body */}
          <div id="consent-modal-desc" className="space-y-3.5 text-xs text-slate-300 mb-5">
            <p className="leading-relaxed">
              CareSync AI integrates multimodal clinical artificial intelligence to assist
              with medication adherence. To perform these advanced capabilities, certain
              patient data is transmitted to <strong>Google Cloud APIs</strong>:
            </p>

            {/* Service Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1">
                <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
                  <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Spoken Voice Check-In</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Voice audio and transcripts are streamed to Google Speech Recognition and
                  Gemini API for intent classification and dosage verification.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
                  <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Prescription Vision OCR</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Prescription images or PDFs are sent to Google Gemini Multimodal API to
                  transcribe medications and screen potential drug interactions.
                </p>
              </div>
            </div>

            {/* Privacy & Guardrails Notice */}
            <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/30 flex items-start gap-2.5 text-sky-200">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <span className="font-semibold block text-[11px]">
                  Clinical Privacy & Zero Key Leakage Architecture
                </span>
                <p className="text-[11px] text-sky-200/90 leading-relaxed">
                  All requests are proxied securely through serverless endpoints. No API
                  keys exist in the browser bundle. Your medical records remain encrypted in
                  local storage on this device.
                </p>
              </div>
            </div>

            {/* Offline Mode Alternative */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5 text-slate-300">
              <HardDriveDownload className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5">
                <span className="font-semibold block text-[11px] text-slate-200">
                  Prefer Complete Offline Privacy?
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Choosing "Use Offline Mode Only" disables cloud network requests. Voice check-in
                  will utilize local phonetic matching, and prescriptions can be entered manually
                  without sending any bytes off your machine.
                </p>
              </div>
            </div>

            {/* Current Status Badge if already set */}
            {currentStatus && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-[11px]">
                <span className="text-slate-400">Current Setting:</span>
                <span
                  className={`font-bold uppercase tracking-wider ${
                    currentStatus === "granted"
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {currentStatus === "granted" ? "Cloud AI Enabled" : "Offline Mode Only"}
                </span>
              </div>
            )}
          </div>

          {/* Action Decision Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              id="btn-consent-allow"
              type="button"
              aria-label="Allow Cloud AI & Voice, grant permissions"
              onClick={() => handleChoose("granted")}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-500/25 active:scale-98 transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              Allow Cloud AI & Voice
            </button>

            <button
              id="btn-consent-decline"
              type="button"
              aria-label="Use Offline Mode Only, decline cloud processing"
              onClick={() => handleChoose("declined")}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 active:scale-98 transition flex items-center justify-center gap-2"
            >
              <HardDriveDownload className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              Use Offline Mode Only
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalMarkup, document.body)
    : modalMarkup;
}
