/**
 * CareSync AI — PinInstructionModal Component
 * Accessible instructional dialog displaying 4-digit security passcodes
 * for Elder (1111), Caretaker (2222), and Family Admin (3333) roles,
 * explaining scope of access and rate-limiting lockout protections.
 */

import React, { useEffect, useRef } from "react";
import {
  KeyRound,
  User,
  ShieldCheck,
  Users,
  X,
  ShieldAlert,
  ArrowRight,
  Lock,
} from "lucide-react";

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onOpenKeypad?: () => void
 * }} props
 */
export default function PinInstructionModal({
  isOpen,
  onClose,
  onOpenKeypad,
}) {
  const modalRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const roles = [
    {
      id: "elder",
      name: "Elderly Patient",
      pin: "1111",
      badgeColor: "bg-sky-50 text-sky-800 border-sky-200",
      pinColor: "bg-sky-100 text-sky-950 border-sky-300",
      icon: User,
      iconColor: "text-sky-600 bg-sky-100",
      summary:
        "Large high-contrast typography, bilingual Voice Check-In (Hindi & English), daily dose logging, and Double-Dose Overdose Lockout protection.",
    },
    {
      id: "caretaker",
      name: "Caretaker Station",
      pin: "2222",
      badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
      pinColor: "bg-emerald-100 text-emerald-950 border-emerald-300",
      icon: ShieldCheck,
      iconColor: "text-emerald-600 bg-emerald-100",
      summary:
        "Daily shift checklist, clinical vitals & observations logging (BP, sugar, pulse), prescription OCR uploader, and 12-hour shift handover brief.",
    },
    {
      id: "family",
      name: "Family Admin",
      pin: "3333",
      badgeColor: "bg-purple-50 text-purple-800 border-purple-200",
      pinColor: "bg-purple-100 text-purple-950 border-purple-300",
      icon: Users,
      iconColor: "text-purple-600 bg-purple-100",
      summary:
        "Full medicine CRUD & restock (+30 pills), doctor appointment scheduling, printable doctor visit brief PDF, and 3-stage email escalation simulator.",
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-instructions-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 via-white to-sky-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <KeyRound className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="pin-instructions-title"
                className="text-lg sm:text-xl font-black text-slate-900 tracking-tight"
              >
                Role Passcode Instructions
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                4-digit security PINs to unlock and switch profiles
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close instructions modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Roles List */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-3.5">
          {roles.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${r.iconColor}`}>
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {r.name}
                      </h3>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${r.badgeColor}`}
                      >
                        Role PIN
                      </span>
                    </div>
                  </div>

                  {/* PIN Display Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-base sm:text-lg font-black tracking-widest px-3.5 py-1.5 rounded-xl border shadow-xs ${r.pinColor}`}
                      title={`4-digit PIN for ${r.name}`}
                    >
                      {r.pin}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {r.summary}
                </p>
              </div>
            );
          })}

          {/* Security Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold text-amber-950">
                Persistent Rate-Limiting Protection:
              </p>
              <p className="text-[11px] text-amber-800 leading-normal mt-0.5">
                Entering an invalid PIN 5 consecutive times triggers an automatic
                30-second security lockout persisted across browser reloads.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <p className="text-[11px] text-slate-500 font-medium text-center sm:text-left">
            Click <strong>Lock / Switch Role (PIN)</strong> to open keypad
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onOpenKeypad && (
              <button
                type="button"
                aria-label="Open PIN Keypad"
                onClick={() => {
                  onClose();
                  onOpenKeypad();
                }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Open Keypad</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              aria-label="Close guide dialog"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 active:scale-95"
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
