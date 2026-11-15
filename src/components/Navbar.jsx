/**
 * CareSync AI — Navbar Component
 * Displays patient overview, live adherence percentage badge, active role indicator,
 * PIN security modal trigger, and 1-click evaluator quick-switch pills.
 */

import React, { useState } from "react";
import {
  HeartPulse,
  Lock,
  User,
  ShieldCheck,
  Users,
  RotateCcw,
  Activity,
  AlertTriangle,
  Cloud,
  CloudOff,
  HelpCircle,
} from "lucide-react";
import { useCare } from "../context/CareContext";
import PasscodeGate from "./PasscodeGate";
import ConsentModal from "./ConsentModal";
import PinInstructionModal from "./PinInstructionModal";
import { isDemoMode, getStoredConsent } from "../utils/security";

export default function Navbar() {
  const {
    activeRole,
    elderProfile,
    adherenceScore,
    lowStockMedications,
    switchRole,
    resetDemoData,
  } = useCare();

  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [isPinInstructionsOpen, setIsPinInstructionsOpen] = useState(false);
  const [consentStatus, setConsentStatus] = useState(() => getStoredConsent());

  // Role badges configuration (Light Theme)
  const roleConfig = {
    elder: {
      label: "Elderly View",
      color: "bg-sky-50 text-sky-700 border-sky-200",
      icon: User,
    },
    caretaker: {
      label: "Caretaker View",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: ShieldCheck,
    },
    family: {
      label: "Family Admin View",
      color: "bg-purple-50 text-purple-700 border-purple-200",
      icon: Users,
    },
  };

  const currentRole = roleConfig[activeRole] || roleConfig.elder;
  const RoleIcon = currentRole.icon;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm transition-colors">
      <nav
        aria-label="CareSync AI Primary Navigation"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4"
      >
        {/* Brand & Patient Overview */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-md shadow-blue-500/15 flex items-center justify-center">
            <HeartPulse className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg sm:text-xl tracking-tight text-slate-900">
                CareSync <span className="text-blue-600">AI</span>
              </span>
              <span className="hidden sm:inline-block px-2.5 py-0.5 text-[11px] font-bold bg-rose-50 border border-rose-200 text-rose-700 rounded-full">
                {elderProfile.bloodGroup || "O+"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-bold text-slate-800">
                {elderProfile.name}
              </span>
              <span className="text-slate-500">({elderProfile.age}y)</span>
            </div>
          </div>
        </div>

        {/* Live Metrics: Adherence & Low Refills */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Adherence Score Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-bold shadow-sm transition ${
              adherenceScore >= 80
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : adherenceScore >= 50
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
            title="Real-time adherence percentage based on today's logged doses"
          >
            <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Adherence: {adherenceScore}%</span>
          </div>

          {/* Low Stock Indicator */}
          {lowStockMedications.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold animate-pulse shadow-sm"
              title={`${lowStockMedications.length} medication(s) need refilling (<= 5 pills remaining)`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span className="hidden md:inline">Low Stock:</span>
              <span>{lowStockMedications.length} Med{lowStockMedications.length > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Role Switcher & Passcode Modal Trigger */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Current Active Role Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-sm ${currentRole.color}`}
          >
            <RoleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{currentRole.label}</span>
            <span className="sm:hidden capitalize">{activeRole}</span>
          </div>

          {/* 3 Quick Demo Switch Pills for Judges (Shown ONLY in Demo Mode) */}
          {isDemoMode() && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 shadow-inner">
              <button
                id="quick-switch-elder"
                type="button"
                aria-label="Elder [1111], quick switch to elder mode"
                onClick={() => switchRole("elder")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition active:scale-98 ${
                  activeRole === "elder"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                }`}
              >
                Elder [1111]
              </button>
              <button
                id="quick-switch-caretaker"
                type="button"
                aria-label="Caretaker [2222], quick switch to caretaker mode"
                onClick={() => switchRole("caretaker")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition active:scale-98 ${
                  activeRole === "caretaker"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                }`}
              >
                Caretaker [2222]
              </button>
              <button
                id="quick-switch-family"
                type="button"
                aria-label="Family [3333], quick switch to family admin mode"
                onClick={() => switchRole("family")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition active:scale-98 ${
                  activeRole === "family"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                }`}
              >
                Family [3333]
              </button>
            </div>
          )}

          {/* Cloud AI Consent Status Badge / Trigger */}
          <button
            id="btn-cloud-consent-status"
            type="button"
            aria-label={`${consentStatus === "granted" ? "Cloud AI: On" : consentStatus === "declined" ? "Offline Mode" : "Cloud Consent"}, view or update consent preferences`}
            onClick={() => setIsConsentModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition active:scale-95 shadow-sm ${
              consentStatus === "granted"
                ? "bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100"
                : consentStatus === "declined"
                ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                : "bg-amber-50 border-amber-200 text-amber-900 animate-pulse hover:bg-amber-100"
            }`}
            title="Click to view or adjust Cloud AI & Voice consent preferences"
          >
            {consentStatus === "granted" ? (
              <Cloud className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            )}
            <span className="hidden md:inline">
              {consentStatus === "granted"
                ? "Cloud AI: On"
                : consentStatus === "declined"
                ? "Offline Mode"
                : "Cloud Consent"}
            </span>
          </button>

          {/* Keypad Passcode Lock Modal Trigger */}
          <button
            id="btn-open-pin-modal"
            type="button"
            aria-label="Lock / Switch Role (PIN), open 4-digit PIN security keypad"
            onClick={() => setIsPasscodeModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl border border-slate-200 transition active:scale-95 shadow-sm"
          >
            <Lock className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            <span className="hidden lg:inline">Lock / Switch Role (PIN)</span>
            <span className="lg:hidden">PIN</span>
          </button>

          {/* PIN Instructions / Passcode Guide Button */}
          <button
            id="btn-pin-instructions"
            type="button"
            aria-label="Role Passcode Instructions, view demo PINs for Elder, Caretaker, and Family"
            onClick={() => setIsPinInstructionsOpen(true)}
            title="View Role PIN Passcodes (Elder 1111, Caretaker 2222, Family 3333)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 hover:text-indigo-900 text-xs font-bold rounded-xl border border-indigo-200 transition active:scale-95 shadow-sm"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
            <span className="hidden xl:inline">PIN Guide</span>
          </button>

          {/* Reset Demo Data */}
          <button
            id="btn-reset-demo"
            type="button"
            aria-label="Reset platform state to pristine initial demo data"
            onClick={resetDemoData}
            title="Reset platform demo data"
            className="p-2 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition active:scale-95 shadow-sm"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </nav>

      {/* Accessible Passcode Keypad Modal */}
      <PasscodeGate
        isOpen={isPasscodeModalOpen}
        onClose={() => setIsPasscodeModalOpen(false)}
      />

      {/* Role Passcode Instructions Guide Modal */}
      <PinInstructionModal
        isOpen={isPinInstructionsOpen}
        onClose={() => setIsPinInstructionsOpen(false)}
        onOpenKeypad={() => setIsPasscodeModalOpen(true)}
      />

      {/* Accessible Cloud AI Consent Preferences Modal */}
      <ConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        onConsentChange={(newStatus) => setConsentStatus(newStatus)}
      />
    </header>
  );
}
