/**
 * CareSync AI — PasscodeGate Component
 * Accessible, secure 4-digit keypad modal supporting role authorization
 * with rate-limited lockout feedback, responsive viewport scaling, and keyboard accessibility.
 * Portaled to document.body to ensure it always renders at the top z-index layer.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Lock, Delete, X, ShieldAlert, CheckCircle } from "lucide-react";
import { useCare } from "../context/CareContext";
import { verifyRolePin, getLockoutExpiry, isDemoMode } from "../utils/security";

export default function PasscodeGate({ isOpen, onClose }) {
  const { switchRole } = useCare();
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [targetRole, setTargetRole] = useState(null); // null = auto-detect
  const [lockoutSec, setLockoutSec] = useState(() => {
    const expiry = getLockoutExpiry();
    const now = Date.now();
    return expiry > now ? Math.ceil((expiry - now) / 1000) : 0;
  });

  const modalRef = useRef(null);
  const openerRef = useRef(null);

  // Focus management: move focus into dialog on open, restore to opener on close
  useEffect(() => {
    if (isOpen) {
      openerRef.current = document.activeElement;
      setPin("");
      setSuccessMsg("");
      const expiry = getLockoutExpiry();
      const now = Date.now();
      if (expiry > now) {
        const remaining = Math.ceil((expiry - now) / 1000);
        setLockoutSec(remaining);
        setErrorMsg(
          `Security lockout active: Too many failed attempts. Try again in ${remaining}s.`
        );
      } else {
        setLockoutSec(0);
        setErrorMsg("");
      }

      // Move focus inside the dialog after portal mounts
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

  // Live timer interval to count down persisted lockout
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const expiry = getLockoutExpiry();
      const now = Date.now();
      if (expiry > now) {
        const remaining = Math.ceil((expiry - now) / 1000);
        setLockoutSec(remaining);
        setErrorMsg(
          `Security lockout active: Too many failed attempts. Try again in ${remaining}s.`
        );
      } else {
        setLockoutSec((prev) => {
          if (prev > 0) {
            setErrorMsg("");
          }
          return 0;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleDigit = useCallback(
    (digit) => {
      if (lockoutSec > 0) return;
      if (pin.length < 4) {
        setPin((prev) => prev + digit);
        setErrorMsg("");
      }
    },
    [pin, lockoutSec]
  );

  const handleBackspace = useCallback(() => {
    if (lockoutSec > 0) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg("");
  }, [lockoutSec]);

  const handleClear = useCallback(() => {
    if (lockoutSec > 0) return;
    setPin("");
    setErrorMsg("");
  }, [lockoutSec]);

  const handleVerify = useCallback(() => {
    if (lockoutSec > 0) {
      setErrorMsg(
        `Security lockout active: Too many failed attempts. Try again in ${lockoutSec}s.`
      );
      return;
    }
    if (pin.length !== 4) {
      setErrorMsg("Please enter a complete 4-digit PIN.");
      return;
    }

    const result = verifyRolePin(pin, targetRole);
    if (result.success && result.role) {
      setSuccessMsg(`Access granted for ${result.role.toUpperCase()} role.`);
      setTimeout(() => {
        switchRole(result.role);
        onClose();
      }, 400);
    } else {
      setErrorMsg(result.error || "Authentication failed. Incorrect PIN.");
      setPin("");
      if (result.lockedUntil && result.lockedUntil > Date.now()) {
        const remaining = Math.ceil((result.lockedUntil - Date.now()) / 1000);
        setLockoutSec(remaining);
      }
    }
  }, [pin, targetRole, switchRole, onClose, lockoutSec]);

  // Keyboard navigation & Tab focus trap
  useEffect(() => {
    if (!isOpen) return;

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

      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Enter") {
        handleVerify();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleDigit, handleBackspace, handleVerify, onClose]);

  if (!isOpen) return null;

  const modalMarkup = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="passcode-modal-title"
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-4"
    >
      <div className="min-h-full flex items-center justify-center py-2 sm:py-6">
        <div
          ref={modalRef}
          tabIndex={-1}
          className="bg-slate-900 border-2 border-sky-500/50 rounded-2xl p-5 sm:p-6 max-w-sm sm:max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.8)] relative text-white my-auto max-h-[92vh] overflow-y-auto flex flex-col focus:outline-none"
        >
          {/* Header Row with Close Button */}
          <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
                <Lock className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="passcode-modal-title"
                  className="text-lg font-bold text-white tracking-wide"
                >
                  Role Security Gate
                </h2>
                <p className="text-[11px] text-slate-400">
                  Enter 4-digit PIN to authenticate role
                </p>
              </div>
            </div>

            <button
              id="btn-close-passcode-modal"
              type="button"
              aria-label="Close passcode gate modal"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Role Pre-select Tabs */}
          <div className="flex gap-1.5 mb-3">
            {[
              { id: null, label: "Auto" },
              { id: "elder", label: isDemoMode() ? "Elder (1111)" : "Elder" },
              { id: "caretaker", label: isDemoMode() ? "Caretaker (2222)" : "Caretaker" },
              { id: "family", label: isDemoMode() ? "Family (3333)" : "Family" },
            ].map((item) => (
              <button
                key={item.label}
                id={`tab-role-${item.id || "auto"}`}
                type="button"
                aria-label={`${item.label}, select role`}
                disabled={lockoutSec > 0}
                onClick={() => {
                  setTargetRole(item.id);
                  setErrorMsg("");
                }}
                className={`flex-1 py-1 px-1.5 text-[11px] font-semibold rounded-lg transition border disabled:opacity-40 disabled:cursor-not-allowed ${
                  targetRole === item.id
                    ? "bg-sky-600 text-white border-sky-400 shadow-md"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* PIN Indicators Display */}
          <div className="flex justify-center items-center gap-4 py-2.5 mb-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full transition-all duration-200 border-2 ${
                  idx < pin.length
                    ? "bg-sky-400 border-sky-300 scale-110 shadow-[0_0_10px_rgba(56,189,248,0.7)]"
                    : "bg-slate-800 border-slate-600"
                }`}
              />
            ))}
          </div>

          {/* Live Status Messages */}
          {errorMsg && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-3 p-2.5 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2"
            >
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-3 p-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Keypad Grid (0-9) */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                id={`keypad-digit-${digit}`}
                type="button"
                aria-label={`${digit}, enter digit ${digit}`}
                disabled={lockoutSec > 0}
                onClick={() => handleDigit(String(digit))}
                className="py-2.5 sm:py-3 text-lg sm:text-xl font-bold rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition border border-slate-700/60 shadow-sm text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {digit}
              </button>
            ))}
            <button
              id="keypad-clear-btn"
              type="button"
              aria-label="CLEAR, delete all entered digits"
              disabled={lockoutSec > 0}
              onClick={handleClear}
              className="py-2.5 sm:py-3 text-xs font-semibold rounded-xl bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95 transition border border-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              CLEAR
            </button>
            <button
              id="keypad-digit-0"
              type="button"
              aria-label="0, enter digit 0"
              disabled={lockoutSec > 0}
              onClick={() => handleDigit("0")}
              className="py-2.5 sm:py-3 text-lg sm:text-xl font-bold rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition border border-slate-700/60 shadow-sm text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              0
            </button>
            <button
              id="keypad-backspace-btn"
              type="button"
              aria-label="Backspace, delete last digit"
              disabled={lockoutSec > 0}
              onClick={handleBackspace}
              className="py-2.5 sm:py-3 flex items-center justify-center rounded-xl bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95 transition border border-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Delete className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              id="btn-submit-pin"
              type="button"
              aria-label="Unlock & Switch Role, submit entered PIN"
              disabled={lockoutSec > 0}
              onClick={handleVerify}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 font-bold text-white shadow-lg shadow-sky-500/25 active:scale-98 transition flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              Unlock & Switch Role
            </button>
          </div>

          {/* Quick Reference Guide for Evaluators (Demo Mode Only) */}
          {isDemoMode() && (
            <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between items-center px-1">
              <span>Judge PIN Guide:</span>
              <span className="font-mono text-slate-300">
                Elder: <strong className="text-sky-300">1111</strong> | Caretaker:{" "}
                <strong className="text-emerald-300">2222</strong> | Family:{" "}
                <strong className="text-purple-300">3333</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalMarkup, document.body)
    : modalMarkup;
}
