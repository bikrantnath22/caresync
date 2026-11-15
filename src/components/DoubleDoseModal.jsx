/**
 * CareSync AI — DoubleDoseModal Component
 * Accessible, full-screen clinical overdose lockout modal.
 * Rendered globally in App.jsx so accidental double-dose attempts
 * are blocked and displayed with high-contrast alert styling across all roles
 * (Elder, Caretaker, Family).
 */

import React, { useCallback, useEffect, useRef } from "react";
import { ShieldAlert, Volume2, X } from "lucide-react";
import { useCare } from "../context/CareContext";

export default function DoubleDoseModal() {
  const { doubleDoseAlert, clearDoubleDoseAlert, elderProfile } = useCare();
  const modalRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (doubleDoseAlert) {
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
  }, [doubleDoseAlert]);

  // Trap Tab and Escape keys
  useEffect(() => {
    if (!doubleDoseAlert) return;

    const handleKeyDown = (e) => {
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

      if (e.key === "Escape") {
        clearDoubleDoseAlert();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [doubleDoseAlert, clearDoubleDoseAlert]);

  const handleSpeakWarning = useCallback(() => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !doubleDoseAlert
    ) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const patientName = elderProfile?.name || "Patient";
      const spokenText = `STOP! ${patientName}, you already took ${doubleDoseAlert.medicationName} at ${doubleDoseAlert.lastTakenAt}. Do not take another dose.`;
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch {
      // speech blocked or unsupported
    }
  }, [doubleDoseAlert, elderProfile]);

  if (!doubleDoseAlert) return null;

  const patientName = elderProfile?.name || "Patient";

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-label="Double-Dose Overdose Lockout Alert Modal"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-bounce-short"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-red-950 border-4 border-red-500 rounded-3xl p-6 sm:p-10 max-w-xl w-full text-center shadow-[0_0_80px_rgba(239,68,68,0.9)] text-white relative focus:outline-none"
      >
        {/* Top Close / Dismiss Icon Button */}
        <button
          id="btn-modal-close-lockout-icon"
          type="button"
          aria-label="Close overdose lockout modal"
          onClick={clearDoubleDoseAlert}
          className="absolute top-4 right-4 p-2 text-red-300 hover:text-white rounded-xl bg-red-900/60 hover:bg-red-800 transition"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Pulsing Shield Icon */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-5 bg-red-600 text-white rounded-3xl flex items-center justify-center border-4 border-white animate-pulse shadow-xl">
          <ShieldAlert className="w-12 h-12 sm:w-16 sm:h-16" aria-hidden="true" />
        </div>

        <span className="px-4 py-1.5 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-widest inline-block mb-3">
          Safety Lockout Engaged
        </span>

        <h2 className="text-2xl sm:text-4xl font-black mb-3 tracking-tight text-white">
          STOP! DO NOT TAKE ANOTHER PILL
        </h2>

        <p className="text-lg sm:text-2xl font-bold text-red-100 mb-6 leading-snug">
          {patientName}, you already took{" "}
          <strong className="text-white underline decoration-amber-300">
            {doubleDoseAlert.medicationName} {doubleDoseAlert.dosage}
          </strong>{" "}
          earlier today at{" "}
          <span className="text-amber-300 font-mono">
            {doubleDoseAlert.lastTakenAt}
          </span>
          . Taking a second dose is unsafe.
        </p>

        {/* Emergency Protocol Box */}
        <div className="bg-black/60 rounded-2xl p-4 mb-6 text-left text-xs sm:text-sm font-medium border border-red-500/40 space-y-2">
          <div className="flex justify-between py-1 border-b border-white/10">
            <span className="text-slate-300">Attempted At:</span>
            <span className="font-bold text-amber-300 font-mono">
              {doubleDoseAlert.triggeredAt}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-300">Emergency Protocol:</span>
            <span className="font-bold text-emerald-400">
              Stage 3 Emergency Alert Dispatched to Caretaker & Family
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            id="btn-modal-speak-lockout"
            type="button"
            aria-label="Read Aloud, speak clinical overdose warning"
            onClick={handleSpeakWarning}
            className="py-3.5 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl border border-red-500/50 flex items-center justify-center gap-2 text-sm sm:text-base transition active:scale-95"
          >
            <Volume2 className="w-5 h-5 text-amber-300" aria-hidden="true" />
            Read Aloud
          </button>

          <button
            id="btn-modal-dismiss-lockout"
            type="button"
            aria-label="I Understand — Dismiss, acknowledge overdose lockout"
            onClick={clearDoubleDoseAlert}
            className="flex-1 py-3.5 px-6 bg-white hover:bg-slate-100 text-red-950 text-base sm:text-xl font-black rounded-2xl shadow-2xl transition active:scale-95"
          >
            I Understand — Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
