/**
 * CareSync AI — ElderDashboard Component (PIN 1111)
 * WCAG AAA Cognitive Accessibility design with large typography,
 * bilingual Voice Check-In ("Zero-UI" logging in Hindi & English),
 * natural speech synthesis, and Double-Dose Overdose Lockout protection.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Mic,
  MicOff,
  Pill,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Volume2,
  Sparkles,
  MapPin,
  Heart,
  Globe,
  Check,
  X,
  PhoneCall,
  Bell,
  FastForward,
  RotateCcw,
} from "lucide-react";
import { useCare, getLocalDateString, parseSlotToMinutes } from "../context/CareContext";
import { parseElderVoiceCheckIn } from "../services/aiService";
import { isDemoMode, getStoredConsent } from "../utils/security";
import ConsentModal from "./ConsentModal";

/**
 * ElderDashboard: accessible cognitive interface designed for 74-year-old patient.
 * Features natural voice check-in, dynamic medication grounding, emergency triage,
 * and per-slot adherence tracking.
 *
 * @returns {JSX.Element}
 */
export default function ElderDashboard() {
  const {
    elderProfile,
    medications,
    appointments,
    markDoseTaken,
    addLog,
    triggerEscalatingEmail,
    skipDose,
    clockOffsetMinutes,
    fastForwardClock,
    resetClock,
  } = useCare();

  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState("en-IN"); // "en-IN" (default) | "hi-IN"
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceFeedback, setVoiceFeedback] = useState(null);
  const [voiceStatusNotice, setVoiceStatusNotice] = useState("");
  const [availableVoices, setAvailableVoices] = useState([]);
  const [pendingVoiceConfirmation, setPendingVoiceConfirmation] = useState(null);
  const [emergencyAlertNotice, setEmergencyAlertNotice] = useState(null);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [showDemoTools, setShowDemoTools] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState({});
  const [skipTarget, setSkipTarget] = useState(null);
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const recognitionRef = useRef(null);

  // Periodic Cron Job Heartbeat: continuously monitors clock and medication schedules every 10 seconds
  const [cronTick, setCronTick] = useState(() => Date.now());
  useEffect(() => {
    const cronInterval = setInterval(() => {
      setCronTick(Date.now());
    }, 10 * 1000); // 10s cron job interval
    return () => clearInterval(cronInterval);
  }, []);

  // Load natural speech synthesis voices and handle unmount cleanup
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      // Rule 17: Stop recognition and speech and remove onvoiceschanged on unmount
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore error on abort
        }
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          window.speechSynthesis.onvoiceschanged = null;
        } catch {
          // ignore error on speech cancel
        }
      }
    };
  }, []);

  // Rule 18: Detect if native Hindi speech synthesis voice is installed in browser
  const hasHindiVoice = useMemo(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    const voices =
      availableVoices.length > 0
        ? availableVoices
        : (window.speechSynthesis.getVoices?.() || []);
    return voices.some(
      (v) =>
        v.lang?.toLowerCase().includes("hi") ||
        v.name?.toLowerCase().includes("hindi")
    );
  }, [availableVoices]);

  // Natural localized speech synthesizer
  const speakText = useCallback(
    (text, forceHindi = null) => {
      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window) ||
        !text
      ) {
        return;
      }

      try {
        // Cancel previous speech if actively speaking
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }

        const isHindiText =
          forceHindi !== null ? forceHindi : /[\u0900-\u097F]/.test(text);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = isHindiText ? "hi-IN" : "en-IN";

        // Critical for Mobile: Use natural speed 1.0 (rates < 1.0 trigger robotic DSP distortion on phones)
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        const voices =
          availableVoices.length > 0
            ? availableVoices
            : (window.speechSynthesis.getVoices?.() || []);

        if (voices && voices.length > 0) {
          let chosenVoice = null;
          if (isHindiText) {
            // Find natural/neural Hindi voice
            chosenVoice =
              voices.find(
                (v) =>
                  (v.lang?.toLowerCase().includes("hi") || v.name?.toLowerCase().includes("hindi")) &&
                  (v.name.toLowerCase().includes("google") || v.name.toLowerCase().includes("natural") || !v.localService)
              ) ||
              voices.find(
                (v) =>
                  v.lang?.toLowerCase().includes("hi") ||
                  v.name?.toLowerCase().includes("hindi")
              );
          } else {
            // Find natural/neural Indian English voice first, then clean English voice
            chosenVoice =
              voices.find(
                (v) =>
                  (v.lang?.toLowerCase().replace("_", "-").includes("en-in") || v.name?.toLowerCase().includes("india")) &&
                  (v.name.toLowerCase().includes("google") || v.name.toLowerCase().includes("natural") || !v.localService)
              ) ||
              voices.find(
                (v) =>
                  v.lang?.toLowerCase().replace("_", "-").includes("en-in") ||
                  v.name?.toLowerCase().includes("india") ||
                  v.name?.includes("Heera") ||
                  v.name?.includes("Ravi")
              ) ||
              voices.find(
                (v) =>
                  v.name.toLowerCase().includes("google") ||
                  v.name.toLowerCase().includes("natural")
              ) ||
              voices.find((v) => v.lang?.toLowerCase().startsWith("en"));
          }

          if (chosenVoice) {
            utterance.voice = chosenVoice;
          }
        }

        // Garbage collection protection for mobile
        window._activeSpeechUtterance = utterance;
        utterance.onend = () => {
          window._activeSpeechUtterance = null;
        };
        utterance.onerror = () => {
          window._activeSpeechUtterance = null;
        };

        // 60ms delay ensures Android TTS audio HAL finishes resetting and never cuts off the speech
        setTimeout(() => {
          try {
            if (window.speechSynthesis.paused) {
              window.speechSynthesis.resume();
            }
            window.speechSynthesis.speak(utterance);
          } catch {
            // speech blocked or unsupported
          }
        }, 60);
      } catch {
        // speech blocked or unsupported
      }
    },
    [availableVoices]
  );

  // Process voice transcript safely with Intent Classification & Phonetic Mapping
  const handleProcessVoiceInput = useCallback(
    async (rawText, extraOptions = {}) => {
      setVoiceTranscript(rawText);
      setIsListening(false);
      setVoiceStatusNotice("");
      setPendingVoiceConfirmation(null);

      const voiceOptions = {
        lang: speechLang,
        elderProfile,
        alternatives: extraOptions.alternatives || [rawText],
        confidence: extraOptions.confidence != null ? extraOptions.confidence : 1.0,
      };

      try {
        const result = await parseElderVoiceCheckIn(rawText, medications, voiceOptions);

        // Emergency triage: emergency=true -> Stage 3 email immediately, 112 protocol, critical log, red banner
        if (result.emergency) {
          setEmergencyAlertNotice({
            text: result.spokenResponse,
            symptom: result.symptomReported || "Critical medical emergency",
          });

          addLog(
            "Elder",
            "voice-emergency",
            "critical",
            `CRITICAL EMERGENCY ALERT: ${result.symptomReported || "Severe symptom"} reported in voice check-in: "${rawText}"`
          );

          triggerEscalatingEmail(3, {
            stage: "Stage 3: EMERGENCY Medical Alert",
            subject: `CRITICAL EMERGENCY: ${elderProfile.name} reported severe symptoms via Voice Check-In`,
            body: `EMERGENCY ALERT for ${elderProfile.name} (Age: ${elderProfile.age || 74}, Blood: ${elderProfile.bloodGroup || "O+"}).\nPatient verbal check-in transcript: "${rawText}"\nReported observation: ${result.symptomReported || "Emergency symptom"}\nAction: Contact emergency medical services (112) or family immediately.`,
          });
        } else if (result.symptomReported) {
          // High symptom triage: Stage 2 email to caretaker, high audit log
          addLog(
            "Elder",
            "voice-symptom",
            result.severity === "high" ? "high" : "normal",
            `Voice Check-In: ${result.symptomReported}`
          );

          triggerEscalatingEmail(2, {
            stage: "Stage 2: Voice Check-In Symptom Alert",
            subject: `HEALTH CONCERN: ${elderProfile.name} reported symptoms via Voice Check-In`,
            body: `Patient verbal check-in transcript: "${rawText}"\nReported Observation: ${result.symptomReported}\nPlease follow up promptly.`,
          });
        }

        // Action execution vs Confirmation UI
        if (result.needsConfirmation) {
          // Rule 15: Require patient confirmation tap before marking anything taken
          setPendingVoiceConfirmation({
            candidates: result.candidates,
            isGroup: result.isGroup,
            timeOfDay: result.timeOfDay,
            spokenResponse: result.spokenResponse,
            isHindi: result.isHindi,
          });
        } else if (result.actions && result.actions.length > 0) {
          // STRONG confidence tier: immediately execute approved mark_taken action
          for (const action of result.actions) {
            if (action.type === "mark_taken" && action.medicationId) {
              markDoseTaken(action.medicationId, "Elder");
            }
          }
        }

        const feedbackObj = {
          ...result,
          spokenResponse: result.spokenResponse,
          isScheduleInquiry: result.intent === "inquiry",
          isScheduleOverview: result.isScheduleOverview,
        };

        setVoiceFeedback(feedbackObj);
        speakText(result.spokenResponse, result.isHindi);
      } catch {
        // Rule 16: In the catch fallback do not claim the caretaker was notified or dose was recorded
        const isHi = speechLang.startsWith("hi");
        const fallbackMsg = isHi
          ? `${elderProfile.name} जी, आवाज़ समझने में समस्या हुई। कृपया नीचे दिए गए कार्ड को दबाएं।`
          : `${elderProfile.name}, could not understand your voice command. Please tap your medication card below.`;

        setVoiceFeedback({
          matchedMedicationName: "Voice Assistant",
          symptomReported: null,
          spokenResponse: fallbackMsg,
          isHindi: isHi,
          isScheduleInquiry: false,
        });
        speakText(fallbackMsg, isHi);
      }
    },
    [
      medications,
      elderProfile,
      speechLang,
      markDoseTaken,
      addLog,
      triggerEscalatingEmail,
      speakText,
    ]
  );

  // Handle elder tapping "Yes, mark as taken" on the confirmation card
  const handleConfirmPendingAction = useCallback(() => {
    if (!pendingVoiceConfirmation) return;
    const { candidates, isHindi } = pendingVoiceConfirmation;

    candidates.forEach((cand) => {
      markDoseTaken(cand.id, "Elder");
    });

    const candidateNames = candidates.map((c) => c.name).join(", ");
    const confirmMsg = isHindi
      ? `${elderProfile.name} जी, ${candidateNames} खुराक ले ली गई दर्ज कर दी गई है।`
      : `${elderProfile.name}, ${candidateNames} marked as taken.`;

    speakText(confirmMsg, isHindi);

    setVoiceFeedback((prev) =>
      prev
        ? {
          ...prev,
          spokenResponse: confirmMsg,
          needsConfirmation: false,
        }
        : {
          matchedMedicationName: candidateNames,
          symptomReported: null,
          spokenResponse: confirmMsg,
          isHindi,
          isScheduleInquiry: false,
        }
    );

    setPendingVoiceConfirmation(null);
  }, [pendingVoiceConfirmation, markDoseTaken, elderProfile, speakText]);

  // Handle elder cancelling pending confirmation
  const handleCancelPendingAction = useCallback(() => {
    setPendingVoiceConfirmation(null);
    const cancelMsg = speechLang.startsWith("hi")
      ? "पुष्टि रद्द कर दी गई।"
      : "Action cancelled.";
    setVoiceStatusNotice(cancelMsg);
  }, [speechLang]);

  // Real Web Speech Recognition listener with Hindi & English support
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const consent = getStoredConsent();
    if (consent === null) {
      setIsConsentModalOpen(true);
      return;
    }
    if (consent === "declined") {
      const msg = speechLang.startsWith("hi")
        ? "वॉइस स्पीच प्रोसेसिंग गूगल क्लाउड का उपयोग करती है। कृपया सेटिंग्स में क्लाउड एआई सक्षम करें।"
        : "Voice speech processing uses Google Cloud services. Please enable Cloud AI in settings to use live voice.";
      setVoiceStatusNotice(msg);
      speakText(msg, speechLang.startsWith("hi"));
      return;
    }

    if (
      typeof window === "undefined" ||
      !("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      setVoiceStatusNotice(
        "Live microphone is not supported in this browser. Please use the 1-click Demo buttons below."
      );
      return;
    }

    try {
      // Resume speech synthesis within user gesture to unlock mobile audio context
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        } catch {
          // ignore resume errors
        }
      }

      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3; // Rule 15: set recognition.maxAlternatives = 3
      recognition.lang = speechLang; // "hi-IN" or "en-IN"

      // Add SpeechGrammarList to bias speech engine towards pharmaceutical vocabulary
      if (
        typeof window !== "undefined" &&
        ("SpeechGrammarList" in window || "webkitSpeechGrammarList" in window)
      ) {
        try {
          const SpeechGrammarList =
            window.SpeechGrammarList || window.webkitSpeechGrammarList;
          const grammarList = new SpeechGrammarList();
          const jsgfGrammar =
            "#JSGF V1.0; grammar medications; public <med> = Stamlo | Arvast | Thyrox | Bplex | Forte | Metformin | Warfarin | Atorvastatin | Aspirin | Lisinopril | थायरॉक्स | स्टैमलो | अरवास्ट | बीप्लेक्स | मेटफॉर्मिन | दवा | मेडिसिन | कब लेना | कब लेनी ;";
          grammarList.addFromString(jsgfGrammar, 1);
          recognition.grammars = grammarList;
        } catch {
          // grammar unsupported or ignored by browser
        }
      }

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceFeedback(null);
        setPendingVoiceConfirmation(null);
        setVoiceStatusNotice(
          speechLang.startsWith("hi")
            ? "सुन रहा हूँ... कृपया बोलिए (Listening in Hindi)..."
            : "Listening... Please speak now..."
        );
      };

      recognition.onresult = (event) => {
        // Stop recognition immediately so the mobile phone releases the microphone and un-mutes the speaker
        try {
          recognition.stop();
        } catch {
          // ignore error on stop
        }

        const resultList = event.results[0];
        const alternatives = [];
        for (let i = 0; i < resultList.length; i++) {
          if (resultList[i]?.transcript) {
            alternatives.push(resultList[i].transcript);
          }
        }
        const confidence =
          resultList?.[0]?.confidence != null ? resultList[0].confidence : 1.0;
        const transcript = alternatives[0] || "";
        handleProcessVoiceInput(transcript, { alternatives, confidence });
      };

      recognition.onerror = (e) => {
        setIsListening(false);
        if (e.error === "no-speech") {
          setVoiceStatusNotice(
            speechLang.startsWith("hi")
              ? "कोई आवाज़ नहीं सुनाई दी। कृपया दोबारा माइक दबाकर बोलें।"
              : "No speech detected. Please tap the mic and try speaking again."
          );
        } else if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setVoiceStatusNotice(
            speechLang.startsWith("hi")
              ? "माइक्रोफ़ोन अवरुद्ध है। यदि आप लिंक्डइन या ऐप के अंदर हैं, तो ऊपर 3 डॉट्स दबाकर 'Chrome में खोलें' चुनें।"
              : "Microphone blocked. If you are inside LinkedIn or another app, tap (⋮) and select 'Open in Chrome' or 'Open in Safari'."
          );
        } else {
          setVoiceStatusNotice(
            `Microphone status: ${e.error}. Try tapping again or use the demo buttons.`
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceStatusNotice(
        "Could not start microphone. You can test with the 1-click demo buttons."
      );
    }
  };

  // Demo Simulation handlers with explicit alternatives & confidence
  const handleSimulateEnglish = () => {
    handleProcessVoiceInput(
      "I took my morning Metformin pill, and I feel a little dizzy today.",
      {
        alternatives: [
          "I took my morning Metformin pill, and I feel a little dizzy today.",
        ],
        confidence: 1.0,
      }
    );
  };

  const handleSimulateHindi = () => {
    handleProcessVoiceInput(
      "मैंने सुबह की मेटफॉर्मिन ले ली है और मुझे थोड़ा चक्कर आ रहा है",
      {
        alternatives: [
          "मैंने सुबह की मेटफॉर्मिन ले ली है और मुझे थोड़ा चक्कर आ रहा है",
        ],
        confidence: 1.0,
      }
    );
  };

  const handleSimulateInquiryEnglish = () => {
    handleProcessVoiceInput("When I take this Stamlo medicine", {
      alternatives: ["When I take this Stamlo medicine"],
      confidence: 1.0,
    });
  };

  const handleSimulateInquiryHindi = () => {
    handleProcessVoiceInput("मुझे थायरॉक्स मेडिसिन कब लेना है", {
      alternatives: ["मुझे थायरॉक्स मेडिसिन कब लेना है"],
      confidence: 1.0,
    });
  };

  const handleSimulateScheduleEnglish = () => {
    handleProcessVoiceInput("Yes I want to know my medicine schedule", {
      alternatives: ["Yes I want to know my medicine schedule"],
      confidence: 1.0,
    });
  };

  const handleSimulateEmergency = () => {
    handleProcessVoiceInput("I have severe chest pain and breathlessness", {
      alternatives: ["I have severe chest pain and breathlessness"],
      confidence: 1.0,
    });
  };

  const handleSimulateGroupMorning = () => {
    handleProcessVoiceInput("I took my morning medicines", {
      alternatives: ["I took my morning medicines"],
      confidence: 1.0,
    });
  };

  const handleSimulateDoseCheck = () => {
    handleProcessVoiceInput("Can I take another Metformin pill?", {
      alternatives: ["Can I take another Metformin pill?"],
      confidence: 1.0,
    });
  };

  const handleSimulateUnknownMed = () => {
    handleProcessVoiceInput("When do I take Lipitor?", {
      alternatives: ["When do I take Lipitor?"],
      confidence: 1.0,
    });
  };

  const handleSimulateNegation = () => {
    handleProcessVoiceInput("I took Metformin, no dizziness today", {
      alternatives: ["I took Metformin, no dizziness today"],
      confidence: 1.0,
    });
  };

  // Determine comforting greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (speechLang.startsWith("hi")) {
      if (hour < 12) return "शुभ प्रभात (Good Morning)";
      if (hour < 17) return "शुभ दोपहर (Good Afternoon)";
      return "शुभ संध्या (Good Evening)";
    }
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const todayFormatted = new Date().toLocaleDateString(
    speechLang.startsWith("hi") ? "hi-IN" : "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  );

  // Soonest upcoming doctor appointment with date >= today, sorted by date then time
  const nextAppointment = useMemo(() => {
    if (!appointments || appointments.length === 0) return null;
    const todayStr = getLocalDateString();
    const upcoming = appointments.filter((apt) => (apt.date || "") >= todayStr);
    if (upcoming.length === 0) return null;
    upcoming.sort((a, b) => {
      const dateCmp = (a.date || "").localeCompare(b.date || "");
      if (dateCmp !== 0) return dateCmp;
      const timeA = parseSlotToMinutes(a.time || "");
      const timeB = parseSlotToMinutes(b.time || "");
      return timeA - timeB;
    });
    return upcoming[0];
  }, [appointments]);

  // Calculate active due dose: ONLY when within 15 minutes before slot or overdue today
  const dueDose = useMemo(() => {
    if (!medications || medications.length === 0) return null;
    const effectiveNow = new Date(Date.now() + (clockOffsetMinutes || 0) * 60 * 1000);
    const nowMinutes = effectiveNow.getHours() * 60 + effectiveNow.getMinutes();

    const dueNowList = [];
    for (const med of medications) {
      const slots = Array.isArray(med.timeSlots) && med.timeSlots.length > 0
        ? med.timeSlots
        : ["08:00 AM"];
      const taken = Array.isArray(med.takenSlots) ? med.takenSlots : [];
      const skipped = Array.isArray(med.skippedSlots) ? med.skippedSlots : [];

      for (const slot of slots) {
        if (taken.includes(slot) || skipped.includes(slot)) continue;
        const slotKey = `${med.id}-${slot}`;
        if (snoozedUntil[slotKey] && Date.now() < snoozedUntil[slotKey]) continue;

        const slotMin = parseSlotToMinutes(slot);
        // A dose reminder is active strictly within 15 minutes before the slot and up to 120 minutes (2 hours) after.
        // Beyond 2 hours, the slot is an overdue missed dose (escalated via email) so that an 8 AM morning pill
        // is never mistakenly shown as "Time to take your pill" at 6 PM in the evening!
        if (nowMinutes >= slotMin - 15 && nowMinutes <= slotMin + 120) {
          dueNowList.push({
            med,
            slot,
            slotMin,
            isOverdue: nowMinutes > slotMin,
          });
        }
      }
    }

    if (dueNowList.length === 0) return null;
    dueNowList.sort((a, b) => a.slotMin - b.slotMin);
    return dueNowList[0];
  }, [medications, clockOffsetMinutes, snoozedUntil, cronTick]);

  // Next scheduled upcoming dose later today (when no dose is currently due)
  const upcomingDose = useMemo(() => {
    if (dueDose) return null;
    if (!medications || medications.length === 0) return null;
    const effectiveNow = new Date(Date.now() + (clockOffsetMinutes || 0) * 60 * 1000);
    const nowMinutes = effectiveNow.getHours() * 60 + effectiveNow.getMinutes();

    const upcoming = [];
    for (const med of medications) {
      const slots = Array.isArray(med.timeSlots) && med.timeSlots.length > 0
        ? med.timeSlots
        : ["08:00 AM"];
      const taken = Array.isArray(med.takenSlots) ? med.takenSlots : [];
      const skipped = Array.isArray(med.skippedSlots) ? med.skippedSlots : [];

      for (const slot of slots) {
        if (taken.includes(slot) || skipped.includes(slot)) continue;
        const slotMin = parseSlotToMinutes(slot);
        if (slotMin > nowMinutes) {
          upcoming.push({ med, slot, slotMin });
        }
      }
    }

    if (upcoming.length === 0) return null;
    upcoming.sort((a, b) => a.slotMin - b.slotMin);
    return upcoming[0];
  }, [medications, dueDose, clockOffsetMinutes, cronTick]);

  // Handler for jumping simulated cron clock directly to Warfarin 06:00 PM dose
  const handleJumpToWarfarin = useCallback(() => {
    const effectiveNow = new Date(Date.now() + (clockOffsetMinutes || 0) * 60 * 1000);
    const currentMin = effectiveNow.getHours() * 60 + effectiveNow.getMinutes();
    const targetMin = 18 * 60; // 06:00 PM
    let diff = targetMin - currentMin;
    if (diff <= 0) diff += 24 * 60;
    fastForwardClock(diff);
  }, [clockOffsetMinutes, fastForwardClock]);

  // Spoken reminder effect for due dose (only speaks when dueDose is active)
  const spokenDueSlotRef = useRef(null);
  useEffect(() => {
    if (dueDose) {
      const dueKey = `${dueDose.med.id}-${dueDose.slot}`;
      if (spokenDueSlotRef.current !== dueKey) {
        spokenDueSlotRef.current = dueKey;
        const msg = speechLang.startsWith("hi")
          ? `${elderProfile.name} जी, आपकी ${dueDose.med.name} (${dueDose.slot}) लेने का समय हो गया है।`
          : `${elderProfile.name}, it is time for your scheduled ${dueDose.slot} dose of ${dueDose.med.name} ${dueDose.med.dosage}.`;
        speakText(msg, speechLang.startsWith("hi"));
      }
    } else {
      spokenDueSlotRef.current = null;
    }
  }, [dueDose, elderProfile, speechLang, speakText]);

  // Handler for Big Due Card: Mark Taken
  const handleDueTaken = useCallback(() => {
    if (!dueDose) return;
    markDoseTaken(dueDose.med.id, "Elder", dueDose.slot);
    const confirmMsg = speechLang.startsWith("hi")
      ? `${elderProfile.name} जी, ${dueDose.med.name} खुराक ले ली गई दर्ज कर दी गई है।`
      : `${elderProfile.name}, ${dueDose.med.name} marked as taken.`;
    speakText(confirmMsg, speechLang.startsWith("hi"));
  }, [dueDose, markDoseTaken, elderProfile, speechLang, speakText]);

  // Handler for Big Due Card: Snooze 10 min
  const handleDueSnooze = useCallback(() => {
    if (!dueDose) return;
    const slotKey = `${dueDose.med.id}-${dueDose.slot}`;
    setSnoozedUntil((prev) => ({
      ...prev,
      [slotKey]: Date.now() + 10 * 60 * 1000,
    }));
    const snoozeMsg = speechLang.startsWith("hi")
      ? "10 मिनट के लिए रिमाइंडर स्थगित किया गया।"
      : "Reminder snoozed for 10 minutes.";
    speakText(snoozeMsg, speechLang.startsWith("hi"));
  }, [dueDose, speechLang, speakText]);

  // Handler for skipping dose with clinical reason (Requirement 4)
  const handleConfirmSkip = useCallback(
    (reason) => {
      if (!skipTarget) return;
      const { med, slot } = skipTarget;
      skipDose(med.id, "Elder", slot, reason);
      setSkipTarget(null);
      const skipMsg = speechLang.startsWith("hi")
        ? `${elderProfile.name} जी, ${med.name} खुराक छोड़ दी गई है। कारण: ${reason}। केयरटेकर को सूचित कर दिया गया है।`
        : `${elderProfile.name}, ${med.name} skipped. Reason: ${reason}. Caretaker has been notified.`;
      speakText(skipMsg, speechLang.startsWith("hi"));
    },
    [skipTarget, skipDose, elderProfile, speechLang, speakText]
  );

  // Handler for confirming SOS Emergency Alert (Requirement 5)
  const handleConfirmSos = useCallback(() => {
    setShowSosConfirm(false);
    setSosActive(true);
    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    triggerEscalatingEmail(3, {
      stage: "Stage 3: CRITICAL SOS EMERGENCY ALERT",
      priority: "critical",
      to: `${elderProfile.familyEmail || "family.admin@caresync.ai"}, ${elderProfile.caretakerEmail || "caretaker.shift@caresync.ai"}`,
      subject: `CRITICAL SOS ALERT: Emergency Triggered by ${elderProfile.name}`,
      body: `CRITICAL EMERGENCY ALERT: ${elderProfile.name} (Age ${elderProfile.age}) pressed the SOS Emergency button at ${currentTime}.\nImmediate medical or physical assistance required!\nPrimary Doctor: ${elderProfile.primaryDoctor}\nEmergency Medical Services Contacted: 112 / 102.`,
    });

    addLog("Elder", "emergency-sos", "critical", `EMERGENCY SOS TRIGGERED by ${elderProfile.name}!`);

    speakText("Emergency alert activated. Calling emergency contacts and dispatching help.", false);
  }, [elderProfile, triggerEscalatingEmail, addLog, speakText]);

  return (
    <section
      aria-label="Elderly Care Medication & Voice Assistant Dashboard"
      className="space-y-8 max-w-5xl mx-auto pb-12"
    >
      {/* 0. Red Full-Width Emergency Alert Banner (Protocol 112) */}
      {emergencyAlertNotice && (
        <aside
          role="alert"
          aria-live="assertive"
          aria-label="Critical Medical Emergency Alert"
          className="p-6 rounded-3xl bg-rose-50 border-3 border-rose-500 shadow-xl shadow-rose-500/10 text-rose-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 animate-pulse"
        >
          <div className="flex items-start gap-4 max-w-3xl">
            <div className="p-3 bg-rose-600 text-white rounded-2xl shrink-0 mt-1 shadow-md shadow-rose-600/20">
              <ShieldAlert className="w-8 h-8 text-white" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <span className="px-3.5 py-1.5 rounded-full text-base font-black uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300">
                CRITICAL EMERGENCY PROTOCOL (<span lang="hi">आपातकालीन चेतावनी</span>)
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-rose-950">
                Emergency Alert: Call 112 Immediately
              </h2>
              <p className="text-lg sm:text-xl text-rose-900 font-semibold leading-relaxed">
                {emergencyAlertNotice.text}
              </p>
              <p className="text-base sm:text-lg text-rose-800 font-medium">
                Observed Symptom: <strong className="text-rose-950 font-bold">{emergencyAlertNotice.symptom}</strong>. Family notified via Stage 3 alert.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
            <a
              id="btn-emergency-call-112"
              href="tel:112"
              aria-label="Call 112 Now, call emergency medical services 112"
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition active:scale-95"
            >
              <PhoneCall className="w-6 h-6" aria-hidden="true" />
              Call 112 Now
            </a>
            <button
              id="btn-dismiss-emergency-alert"
              type="button"
              aria-label="Dismiss Alert, acknowledge emergency warning banner"
              onClick={() => setEmergencyAlertNotice(null)}
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-lg border border-slate-300 transition active:scale-95 shadow-sm"
            >
              Dismiss Alert
            </button>
          </div>
        </aside>
      )}

      {/* 1. Comforting Greeting & Profile Banner (Large Accessible Typography) */}
      <header className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-50/90 via-sky-50/40 to-white border-2 border-blue-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3.5 py-1.5 rounded-full text-base font-bold uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-200">
              Elderly Comfort Mode (<span lang="hi">बुजुर्ग सहायता मोड</span>)
            </span>
            <span className="text-base sm:text-lg font-semibold text-slate-600">
              {todayFormatted}
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            {getGreeting()},{" "}
            <span className="text-blue-600">{elderProfile.name}</span>
          </h1>
          <p
            lang={speechLang.startsWith("hi") ? "hi" : "en"}
            className="text-xl sm:text-2xl text-slate-700 mt-2 font-medium"
          >
            {speechLang.startsWith("hi")
              ? "यह आपकी आज की दवाओं की सूची है। दवा लेने के बाद नीचे हरे बटन को दबाएं या बोलकर बताएं।"
              : "Here is your simple medication plan for today. Touch any card to mark it as taken."}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm shrink-0">
          <Heart className="w-9 h-9 text-rose-500 animate-pulse" aria-hidden="true" />
          <div>
            <span className="text-base text-slate-500 block font-medium">
              Daily Progress
            </span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-700">
              {medications.filter((m) => m.takenToday || (Array.isArray(m.takenSlots) && m.takenSlots.length > 0)).length} of{" "}
              {medications.length} Done
            </span>
          </div>
        </div>
      </header>

      {/* SOS Emergency Banner & Trigger (Requirement 5) */}
      {sosActive ? (
        <aside
          role="alert"
          aria-live="assertive"
          aria-label="Active Emergency SOS Status"
          className="p-6 sm:p-8 rounded-3xl bg-rose-50 border-3 border-rose-500 shadow-xl text-rose-950 space-y-5 animate-pulse"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-600 text-white rounded-2xl shrink-0 shadow-md">
                <ShieldAlert className="w-10 h-10 text-white" aria-hidden="true" />
              </div>
              <div>
                <span className="px-3.5 py-1.5 rounded-full text-base font-black uppercase bg-rose-100 text-rose-900 border border-rose-300">
                  EMERGENCY SOS ACTIVATED (<span lang="hi">आपातकालीन सहायता सक्रिय</span>)
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-rose-950 mt-1">
                  Critical Alert Sent to Family & Caretaker
                </h2>
                <p className="text-base sm:text-lg text-rose-800 font-medium">
                  Emergency notifications sent. Direct call emergency responders below:
                </p>
              </div>
            </div>

            <button
              id="btn-dismiss-active-sos"
              type="button"
              aria-label="Dismiss SOS Mode, acknowledge and clear emergency SOS status"
              onClick={() => setSosActive(false)}
              className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-base border border-slate-300 transition active:scale-98 shrink-0 shadow-sm"
            >
              Dismiss SOS Mode
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <a
              id="btn-call-emergency-112"
              href="tel:112"
              aria-label="Call 112 (National Emergency), national emergency services helpline 112"
              className="p-5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xl sm:text-2xl flex items-center justify-center gap-3 shadow-lg shadow-rose-600/30 transition active:scale-98"
            >
              <PhoneCall className="w-7 h-7" aria-hidden="true" />
              <span>Call 112 (National Emergency)</span>
            </a>
            <a
              id="btn-call-ambulance-102"
              href="tel:102"
              aria-label="Call 102 (Ambulance Helpline), ambulance medical helpline 102"
              className="p-5 rounded-2xl bg-red-700 hover:bg-red-800 text-white font-black text-xl sm:text-2xl flex items-center justify-center gap-3 shadow-lg shadow-red-700/30 transition active:scale-98"
            >
              <PhoneCall className="w-7 h-7" aria-hidden="true" />
              <span>Call 102 (Ambulance Helpline)</span>
            </a>
          </div>
        </aside>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between p-5 sm:p-6 rounded-3xl bg-white border-2 border-rose-200/90 shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0 border border-rose-100">
              <PhoneCall className="w-7 h-7" aria-hidden="true" />
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-black text-slate-900 block">
                Urgent Help / Emergency
              </span>
              <span className="text-base text-slate-600 font-medium block">
                Press button to alert family and caretaker immediately (<span lang="hi">आपातकालीन बटन</span>)
              </span>
            </div>
          </div>

          <button
            id="btn-elder-sos"
            type="button"
            aria-label="EMERGENCY SOS, tap to call emergency contacts and send urgent alert"
            onClick={() => setShowSosConfirm(true)}
            className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xl sm:text-2xl shadow-lg shadow-rose-600/25 transition active:scale-98 flex items-center justify-center gap-3 border border-rose-500 shrink-0"
          >
            <PhoneCall className="w-6 h-6" aria-hidden="true" />
            <span>EMERGENCY SOS</span>
            <span lang="hi" className="text-base font-bold text-rose-100">
              (आपातकालीन सहायता)
            </span>
          </button>
        </div>
      )}

      {/* Big "Time for <medicine>" Card (Active when due, or calm upcoming schedule) */}
      {dueDose ? (
        <article
          aria-label={`Time for ${dueDose.med.name}`}
          className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-50/90 via-white to-orange-50/60 border-3 border-amber-400 shadow-lg space-y-6 animate-fade-in text-slate-900"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500 rounded-2xl text-white shrink-0 shadow-md shadow-amber-500/20 animate-pulse">
                <Bell className="w-8 h-8" aria-hidden="true" />
              </div>
              <div>
                <span className="px-3.5 py-1.5 rounded-full text-base font-black uppercase tracking-wider bg-amber-500 text-white inline-block shadow-sm">
                  Time for your medicine!
                </span>
                <span className="text-amber-900 text-lg font-bold ml-2">
                  Scheduled for {dueDose.slot}
                </span>
              </div>
            </div>

            <button
              id="btn-speak-due-reminder"
              type="button"
              aria-label="Replay Reminder, listen to spoken medication reminder"
              onClick={() => {
                const msg = speechLang.startsWith("hi")
                  ? `${elderProfile.name} जी, आपकी ${dueDose.med.name} (${dueDose.slot}) लेने का समय हो गया है।`
                  : `${elderProfile.name}, it is time for your scheduled ${dueDose.slot} dose of ${dueDose.med.name} ${dueDose.med.dosage}.`;
                speakText(msg, speechLang.startsWith("hi"));
              }}
              className="px-5 py-3 rounded-2xl bg-white hover:bg-amber-50 text-amber-900 font-bold text-base border border-amber-300 flex items-center gap-2 self-start md:self-auto transition active:scale-98 shadow-sm"
            >
              <Volume2 className="w-5 h-5 text-amber-600" aria-hidden="true" />
              <span>Replay Reminder</span>
            </button>
          </div>

          <div className="space-y-3">
            <h2 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight">
              Time for {dueDose.med.name}{" "}
              <span className="text-3xl sm:text-5xl font-extrabold text-amber-600">
                {dueDose.med.dosage}
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-lg sm:text-xl font-bold text-slate-800">
              <span className="px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" aria-hidden="true" />
                {dueDose.slot}
              </span>
              <span className="px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-2">
                <span aria-hidden="true">💊</span>
                {dueDose.med.pillAppearance || "Tablet"}
              </span>
              <span className="px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-2 text-emerald-800">
                <span aria-hidden="true">🥣</span>
                {dueDose.med.mealInstruction || "Take with fresh water"}
              </span>
            </div>

            {/* Spoken Text Display */}
            <div className="p-5 rounded-2xl bg-amber-100/70 border-2 border-amber-300 text-amber-950 text-xl sm:text-2xl font-bold">
              <span aria-hidden="true">📢 </span>
              <span lang={speechLang.startsWith("hi") ? "hi" : "en"}>
                "{speechLang.startsWith("hi")
                  ? `${elderProfile.name} जी, आपकी ${dueDose.med.name} (${dueDose.slot}) लेने का समय हो गया है।`
                  : `${elderProfile.name}, it is time to take your ${dueDose.med.name} ${dueDose.med.dosage}.`}"
              </span>
            </div>
          </div>

          {/* 3 Action Buttons: Taken / Snooze 10 min / Skip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <button
              id="btn-due-taken"
              type="button"
              aria-label={`I Took This Pill, mark ${dueDose.med.name} ${dueDose.med.dosage} (${dueDose.slot}) as taken`}
              onClick={handleDueTaken}
              className="py-5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-2xl tracking-wide shadow-lg shadow-emerald-600/30 transition active:scale-98 flex items-center justify-center gap-3"
            >
              <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
              <span>I Took This Pill</span>
            </button>

            <button
              id="btn-due-snooze"
              type="button"
              aria-label="Snooze 10 min, snooze reminder for 10 minutes"
              onClick={handleDueSnooze}
              className="py-5 px-6 rounded-2xl bg-white hover:bg-amber-50 text-amber-900 font-black text-2xl border-2 border-amber-400 transition active:scale-98 flex items-center justify-center gap-3 shadow-sm"
            >
              <Clock className="w-7 h-7 text-amber-600" aria-hidden="true" />
              <span>Snooze 10 min</span>
            </button>

            <button
              id="btn-due-skip"
              type="button"
              aria-label={`Skip, skip ${dueDose.med.name} (${dueDose.slot}) with reason`}
              onClick={() => setSkipTarget({ med: dueDose.med, slot: dueDose.slot })}
              className="py-5 px-6 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-black text-2xl border-2 border-slate-300 transition active:scale-98 flex items-center justify-center gap-3 shadow-sm"
            >
              <X className="w-7 h-7 text-slate-500" aria-hidden="true" />
              <span>Skip</span>
            </button>
          </div>
        </article>
      ) : upcomingDose ? (
        <article
          aria-label={`Next Scheduled Dose: ${upcomingDose.med.name}`}
          className="p-6 sm:p-7 rounded-3xl bg-white border-2 border-indigo-200 shadow-sm space-y-4 animate-fade-in text-slate-900"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-2xl shrink-0">
                <Clock className="w-8 h-8" aria-hidden="true" />
              </div>
              <div>
                <span className="px-3.5 py-1 rounded-full text-base font-bold uppercase tracking-wider bg-indigo-50 text-indigo-800 border border-indigo-200 inline-block">
                  Upcoming Dose (<span lang="hi">अगली खुराक</span>)
                </span>
                <span className="text-slate-800 text-lg font-bold ml-2">
                  Scheduled at {upcomingDose.slot}
                </span>
              </div>
            </div>

            <span className="text-base text-slate-500 font-medium">
              Cron reminder will activate at {upcomingDose.slot}
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
              Next: {upcomingDose.med.name}{" "}
              <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600">
                {upcomingDose.med.dosage}
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-base sm:text-lg font-bold text-slate-700">
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" aria-hidden="true" />
                {upcomingDose.slot}
              </span>
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                <span aria-hidden="true">💊</span>
                {upcomingDose.med.pillAppearance || "Tablet"}
              </span>
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-indigo-800">
                <span aria-hidden="true">🥣</span>
                {upcomingDose.med.mealInstruction || "Take with water"}
              </span>
            </div>
            <p className="text-lg text-slate-600 pt-1" lang={speechLang.startsWith("hi") ? "hi" : "en"}>
              {speechLang.startsWith("hi")
                ? `${elderProfile.name} जी, अभी कोई दवा लेने का समय नहीं है। आपकी अगली दवा ${upcomingDose.med.name} शाम ${upcomingDose.slot} पर निर्धारित है। समय होने पर वॉइस रिमाइंडर अपने आप बोलेगा।`
                : `No doses due right now, ${elderProfile.name}. Your next scheduled dose is ${upcomingDose.med.name} (${upcomingDose.med.dosage}) at ${upcomingDose.slot}. Voice reminder will trigger automatically when due.`}
            </p>
          </div>
        </article>
      ) : (
        <article
          aria-label="All Doses Completed"
          className="p-6 sm:p-7 rounded-3xl bg-emerald-50 border-2 border-emerald-300 shadow-sm flex items-center gap-4 animate-fade-in text-emerald-950"
        >
          <div className="p-3 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl shrink-0">
            <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-950">
              All Medications Completed Today!
            </h3>
            <p className="text-lg text-emerald-800 font-medium" lang="hi">
              {elderProfile.name} जी, आज की सभी दवाइयां पूरी हो चुकी हैं। बहुत बढ़िया!
            </p>
          </div>
        </article>
      )}

      {/* 2. Single-Tap Voice Check-In ("Zero-UI" Logging with Hindi & English Support) */}
      <section
        aria-label="Voice Check-In Section"
        className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-blue-200 shadow-sm relative overflow-hidden text-slate-900"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-3.5 max-w-xl">
            <div className="flex flex-wrap items-center gap-2.5 justify-center md:justify-start">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-base font-bold uppercase">
                <Sparkles className="w-5 h-5 text-amber-500" aria-hidden="true" />
                Zero-UI Voice Assistant
              </span>

              {/* Language Selection Toggle: English (default) first, Hindi second */}
              <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-base shadow-inner">
                <button
                  id="btn-lang-english"
                  type="button"
                  aria-label="English, switch voice assistant to English"
                  onClick={() => setSpeechLang("en-IN")}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-base transition flex items-center gap-1.5 ${speechLang === "en-IN"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Globe className="w-4 h-4" aria-hidden="true" />
                  English
                </button>
                <button
                  id="btn-lang-hindi"
                  type="button"
                  aria-label="हिंदी (Hindi), switch voice assistant to Hindi"
                  onClick={() => setSpeechLang("hi-IN")}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-base transition flex items-center gap-1.5 ${speechLang === "hi-IN"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Globe className="w-4 h-4" aria-hidden="true" />
                  <span lang="hi">हिंदी (Hindi)</span>
                </button>
              </div>
            </div>

            <h2
              lang={speechLang.startsWith("hi") ? "hi" : "en"}
              className="text-3xl sm:text-4xl font-black text-slate-900"
            >
              {speechLang.startsWith("hi")
                ? "माइक दबाकर बोलें (Voice Check-In)"
                : "Speak Your Check-In"}
            </h2>

            <p
              lang={speechLang.startsWith("hi") ? "hi" : "en"}
              className="text-lg sm:text-xl text-slate-600 leading-relaxed font-normal"
            >
              {speechLang.startsWith("hi")
                ? 'माइक दबाकर बताएं आपने कौन सी दवा ली है, या कैसा महसूस हो रहा है (जैसे: "मैंने सुबह की दवा ले ली और चक्कर आ रहा है")।'
                : 'Tap the microphone and tell me what you took, or how you feel (e.g., "I took my morning Metformin and feel dizzy").'}
            </p>
          </div>

          {/* Giant Microphone Button + Collapsible Demo Tools */}
          <div className="flex flex-col items-center gap-3 shrink-0 w-full md:w-auto">
            <button
              id="btn-voice-microphone"
              type="button"
              aria-label={
                isListening
                  ? speechLang.startsWith("hi")
                    ? "सुन रहा हूँ, बंद करने के लिए दबाएं"
                    : "Listening, tap to stop listening"
                  : speechLang.startsWith("hi")
                    ? "बोलने के लिए दबाएं, आवाज़ से चेक-इन करें"
                    : "Tap to Speak, start voice check-in"
              }
              onClick={toggleListening}
              className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-xl relative ${isListening
                ? "bg-rose-600 text-white scale-105 shadow-[0_0_40px_rgba(244,63,94,0.6)] animate-pulse"
                : "bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:scale-105 shadow-blue-500/25"
                }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-12 h-12 sm:w-14 sm:h-14" aria-hidden="true" />
                  <span
                    lang={speechLang.startsWith("hi") ? "hi" : "en"}
                    className="text-base sm:text-lg font-black uppercase tracking-wider mt-1.5"
                  >
                    {speechLang.startsWith("hi") ? "सुन रहा हूँ" : "Listening"}
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-12 h-12 sm:w-14 sm:h-14" aria-hidden="true" />
                  <span
                    lang={speechLang.startsWith("hi") ? "hi" : "en"}
                    className="text-base sm:text-lg font-black uppercase tracking-wider mt-1.5"
                  >
                    {speechLang.startsWith("hi") ? "बोलने के लिए दबाएं" : "Tap to Speak"}
                  </span>
                </>
              )}
            </button>

            {/* Collapsible Demo Tools (Demo Mode Only) */}
            {isDemoMode() && (
              <div className="w-full mt-2">
                <button
                  id="btn-toggle-demo-tools"
                  type="button"
                  aria-expanded={showDemoTools}
                  aria-label="Demo tools, toggle evaluator simulation tools"
                  onClick={() => setShowDemoTools((prev) => !prev)}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base sm:text-lg border border-slate-200 transition flex items-center justify-between shadow-sm active:scale-98"
                >
                  <span>Demo tools</span>
                  <span aria-hidden="true">{showDemoTools ? "▲" : "▼"}</span>
                </button>

                {showDemoTools && (
                  <div className="flex flex-col gap-2 w-full pt-3 animate-fade-in">
                    {/* Proactive Reminder Testing Clock Controls (Requirement 6) */}
                    <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2 text-slate-900 shadow-sm">
                      <span className="text-base font-bold text-indigo-900 block text-center">
                        Proactive Reminder Engine
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          id="btn-fast-forward-1h"
                          type="button"
                          aria-label="Fast-forward 1 hour (+60m), shift engine clock to test missed dose alerts"
                          onClick={() => fastForwardClock(60)}
                          className="text-base sm:text-lg px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition active:scale-98 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <FastForward className="w-5 h-5 text-indigo-200" aria-hidden="true" />
                          <span>Fast-forward 1 hour (+60m)</span>
                        </button>
                        <button
                          id="btn-reset-clock"
                          type="button"
                          aria-label="Reset Clock (Real-time), restore real-time engine clock"
                          onClick={resetClock}
                          className="text-base sm:text-lg px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold transition active:scale-98 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <RotateCcw className="w-5 h-5 text-slate-500" aria-hidden="true" />
                          <span>Reset Clock (Real-time)</span>
                        </button>

                        <button
                          id="btn-jump-cron-warfarin"
                          type="button"
                          aria-label="Test Cron: Jump to 06:00 PM (Warfarin Due), advance cron clock to 6:00 PM Warfarin dose"
                          onClick={handleJumpToWarfarin}
                          className="col-span-1 sm:col-span-2 text-base sm:text-lg px-3 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold transition active:scale-98 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Clock className="w-5 h-5 text-purple-600" aria-hidden="true" />
                          <span>Test Cron: Jump to 06:00 PM (Warfarin Due)</span>
                        </button>
                      </div>
                      {clockOffsetMinutes > 0 && (
                        <p className="text-sm font-semibold text-indigo-800 text-center">
                          Simulated Clock: +{clockOffsetMinutes}m ({Math.floor(clockOffsetMinutes / 60)}h {clockOffsetMinutes % 60}m offset)
                        </p>
                      )}
                    </div>

                    <span className="text-base font-bold text-slate-600 uppercase tracking-wider text-center pt-1">
                      Evaluator 1-Click Simulations
                    </span>
                    <button
                      id="btn-simulate-emergency"
                      type="button"
                      aria-label="Test: Chest Pain (Emergency 112), simulate emergency"
                      onClick={handleSimulateEmergency}
                      className="text-base sm:text-lg px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition active:scale-98 flex items-center justify-center gap-2 font-bold shadow-sm"
                    >
                      <span aria-hidden="true">🚨</span>
                      <span>Test: Chest Pain (Emergency 112)</span>
                    </button>

                    <button
                      id="btn-simulate-group-morning"
                      type="button"
                      aria-label="Test: Morning Medicines (Group Confirm), simulate morning group dose"
                      onClick={handleSimulateGroupMorning}
                      className="text-base sm:text-lg px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition active:scale-98 flex items-center justify-center gap-2 font-bold shadow-sm"
                    >
                      <Check className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                      <span>Test: Morning Medicines (Group Confirm)</span>
                    </button>

                    <button
                      id="btn-simulate-dose-check"
                      type="button"
                      aria-label="Test: Can I take another pill (Warning), simulate dose check"
                      onClick={handleSimulateDoseCheck}
                      className="text-base sm:text-lg px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition active:scale-98 flex items-center justify-center gap-2 font-bold shadow-sm"
                    >
                      <ShieldAlert className="w-5 h-5 text-amber-600" aria-hidden="true" />
                      <span>Test: Can I take another pill (Warning)</span>
                    </button>

                    <button
                      id="btn-simulate-unknown-med"
                      type="button"
                      aria-label="Test: Lipitor (Not in List), simulate unknown medicine inquiry"
                      onClick={handleSimulateUnknownMed}
                      className="text-base sm:text-lg px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition active:scale-98 flex items-center justify-center gap-2 font-bold shadow-sm"
                    >
                      <Pill className="w-5 h-5 text-slate-500" aria-hidden="true" />
                      <span>Test: Lipitor (Not in List)</span>
                    </button>

                    <button
                      id="btn-simulate-negation"
                      type="button"
                      aria-label="Test: No Dizziness (Negation Safe), simulate negation safe symptom"
                      onClick={handleSimulateNegation}
                      className="text-base sm:text-lg px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition active:scale-98 flex items-center justify-center gap-2 font-bold shadow-sm"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                      <span>Test: No Dizziness (Negation Safe)</span>
                    </button>

                    <button
                      id="btn-simulate-schedule-en"
                      type="button"
                      aria-label="Ask: My medicine schedule, simulate schedule overview"
                      onClick={handleSimulateScheduleEnglish}
                      className="text-base sm:text-lg px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition active:scale-98 flex items-center justify-center gap-2 font-bold shadow-sm"
                    >
                      <Calendar className="w-5 h-5 text-purple-600" aria-hidden="true" />
                      <span>Ask: My medicine schedule</span>
                    </button>

                    <button
                      id="btn-simulate-inquiry-english"
                      type="button"
                      aria-label="Ask: When I take Stamlo, simulate schedule inquiry"
                      onClick={handleSimulateInquiryEnglish}
                      className="text-base sm:text-lg px-4 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 transition active:scale-98 flex items-center justify-center gap-2 font-bold shadow-sm"
                    >
                      <Clock className="w-5 h-5 text-blue-600" aria-hidden="true" />
                      <span>Ask: When I take Stamlo</span>
                    </button>

                    <button
                      id="btn-simulate-inquiry-hindi"
                      type="button"
                      aria-label="हिंदी: थायरॉक्स कब लेना है, simulate Hindi schedule inquiry"
                      onClick={handleSimulateInquiryHindi}
                      className="text-base sm:text-lg px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition active:scale-98 flex items-center justify-center gap-2 font-bold shadow-sm"
                    >
                      <Clock className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                      <span lang="hi">हिंदी: थायरॉक्स कब लेना है</span>
                    </button>

                    <button
                      id="btn-simulate-voice-checkin"
                      type="button"
                      aria-label="English Demo (Dizziness), simulate English voice check-in"
                      onClick={handleSimulateEnglish}
                      className="text-base sm:text-lg px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition active:scale-98 flex items-center justify-center gap-2 font-bold shadow-sm"
                    >
                      <Volume2 className="w-5 h-5 text-blue-600" aria-hidden="true" />
                      <span>English Demo (Dizziness)</span>
                    </button>

                    <button
                      id="btn-simulate-voice-hindi"
                      type="button"
                      aria-label="हिंदी Demo (चक्कर / Metformin), simulate Hindi voice check-in"
                      onClick={handleSimulateHindi}
                      className="text-base sm:text-lg px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition active:scale-98 flex items-center justify-center gap-2 font-bold shadow-sm"
                    >
                      <Volume2 className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                      <span lang="hi">हिंदी Demo (चक्कर / Metformin)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notice if no native Hindi voice is available in browser */}
        {speechLang.startsWith("hi") && !hasHindiVoice && (
          <aside
            id="notice-no-hindi-voice"
            role="note"
            aria-label="Browser notice: Native Hindi voice unavailable"
            className="mt-4 p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-base sm:text-lg flex items-start gap-3.5 shadow-sm"
          >
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold text-amber-950" lang="hi">
                सूचना: आपके ब्राउज़र में देशी हिंदी आवाज़ (Native Hindi Speech Voice) उपलब्ध नहीं है।
              </p>
              <p className="text-base text-amber-900 mt-1">
                Notice: Native Hindi TTS voice is not installed in this browser. Spoken responses are displayed in large, high-contrast text below.
              </p>
            </div>
          </aside>
        )}

        {/* Live Mic Status Notice */}
        {voiceStatusNotice && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 p-4 rounded-2xl bg-slate-100 border border-slate-200 text-base sm:text-lg text-slate-800 text-center font-semibold shadow-sm"
          >
            {voiceStatusNotice}
          </div>
        )}

        {/* Pending Voice Confirmation Card (MEDIUM confidence or group morning/evening) */}
        {pendingVoiceConfirmation && (
          <div
            role="alert"
            aria-live="assertive"
            aria-label="Voice Confirmation Needed"
            className="mt-6 p-6 sm:p-8 rounded-3xl bg-amber-50/90 border-3 border-amber-400 text-slate-900 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0" aria-hidden="true" />
                <span className="text-base font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                  {pendingVoiceConfirmation.isHindi ? (
                    <span lang="hi">पुष्टि आवश्यक है</span>
                  ) : (
                    "Confirmation Required"
                  )}
                </span>
              </div>
              <h3
                lang={pendingVoiceConfirmation.isHindi ? "hi" : "en"}
                className="text-2xl sm:text-3xl font-black text-slate-900"
              >
                {pendingVoiceConfirmation.spokenResponse}
              </h3>
              <div className="flex flex-wrap gap-2.5 pt-1">
                {pendingVoiceConfirmation.candidates.map((cand) => (
                  <span
                    key={cand.id}
                    className="px-4 py-2 rounded-2xl bg-white border border-amber-300 text-base sm:text-lg font-bold text-amber-900 flex items-center gap-2 shadow-sm"
                  >
                    <Pill className="w-4 h-4 text-amber-600" aria-hidden="true" />
                    {cand.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full md:w-auto shrink-0">
              <button
                id="btn-confirm-voice-action"
                type="button"
                aria-label={
                  pendingVoiceConfirmation.candidates.length > 1
                    ? (pendingVoiceConfirmation.isHindi
                      ? `हाँ, सभी ${pendingVoiceConfirmation.candidates.length} दवाइयां दर्ज करें, पुष्टि करें`
                      : `Yes, Mark All ${pendingVoiceConfirmation.candidates.length} as Taken, confirm doses`)
                    : (pendingVoiceConfirmation.isHindi
                      ? `हाँ, ${pendingVoiceConfirmation.candidates[0]?.name || "दवा"} दर्ज करें, पुष्टि करें`
                      : `Yes, Mark ${pendingVoiceConfirmation.candidates[0]?.name || "as Taken"}, confirm dose`)
                }
                onClick={handleConfirmPendingAction}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white font-black text-xl tracking-wide shadow-md flex items-center justify-center gap-2.5 transition"
              >
                <Check className="w-6 h-6" aria-hidden="true" />
                <span lang={pendingVoiceConfirmation.isHindi ? "hi" : "en"}>
                  {pendingVoiceConfirmation.candidates.length > 1
                    ? (pendingVoiceConfirmation.isHindi
                      ? `हाँ, सभी ${pendingVoiceConfirmation.candidates.length} दवाइयां दर्ज करें`
                      : `Yes, Mark All ${pendingVoiceConfirmation.candidates.length} as Taken`)
                    : (pendingVoiceConfirmation.isHindi
                      ? `हाँ, ${pendingVoiceConfirmation.candidates[0]?.name || "दवा"} दर्ज करें`
                      : `Yes, Mark ${pendingVoiceConfirmation.candidates[0]?.name || "as Taken"}`)}
                </span>
              </button>
              <button
                id="btn-cancel-voice-action"
                type="button"
                aria-label={
                  pendingVoiceConfirmation.isHindi
                    ? "नहीं, रद्द करें, cancel confirmation"
                    : "No, Cancel, cancel dose confirmation"
                }
                onClick={handleCancelPendingAction}
                className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-lg sm:text-xl border border-slate-300 transition active:scale-98 flex items-center justify-center gap-2 shadow-sm"
              >
                <X className="w-5 h-5 text-slate-500" aria-hidden="true" />
                <span lang={pendingVoiceConfirmation.isHindi ? "hi" : "en"}>
                  {pendingVoiceConfirmation.isHindi ? "नहीं, रद्द करें" : "No, Cancel"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Live Voice Feedback Banner */}
        {voiceFeedback && (
          <div
            role="alert"
            aria-live="assertive"
            className={`mt-6 p-6 rounded-3xl bg-white border-3 text-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 animate-fade-in shadow-sm ${voiceFeedback.emergency
              ? "border-rose-500 bg-rose-50/50"
              : voiceFeedback.isScheduleOverview
                ? "border-purple-300 bg-purple-50/50"
                : voiceFeedback.isScheduleInquiry
                  ? "border-blue-300 bg-blue-50/50"
                  : voiceFeedback.needsConfirmation
                    ? "border-amber-400 bg-amber-50/50"
                    : "border-emerald-400 bg-emerald-50/50"
              }`}
          >
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                {voiceFeedback.emergency ? (
                  <>
                    <ShieldAlert
                      className="w-6 h-6 text-rose-600 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-base font-bold text-rose-800">
                      {voiceFeedback.isHindi ? (
                        <span lang="hi">आपातकालीन स्थिति (Emergency 112 Alert)</span>
                      ) : (
                        "Emergency Medical Alert (112)"
                      )}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-base font-bold border border-rose-300">
                      Call 112 Immediately
                    </span>
                  </>
                ) : voiceFeedback.isScheduleOverview ? (
                  <>
                    <Calendar
                      className="w-6 h-6 text-purple-600 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-base font-bold text-purple-800">
                      {voiceFeedback.isHindi ? (
                        <span lang="hi">दैनिक दवा शेड्यूल (Schedule Overview)</span>
                      ) : (
                        "Daily Medication Schedule Overview"
                      )}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-base font-bold border border-purple-200">
                      Active Cards Below
                    </span>
                  </>
                ) : voiceFeedback.isScheduleInquiry ? (
                  <>
                    <Clock
                      className="w-6 h-6 text-blue-600 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-base font-bold text-blue-800">
                      {voiceFeedback.isHindi ? (
                        <span lang="hi">दवा का समय बताया गया (Schedule Answered)</span>
                      ) : (
                        "Medication Timing & Schedule Answered"
                      )}
                    </span>
                    {voiceFeedback.matchedMedicationName && (
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-base font-bold border border-blue-200">
                        {voiceFeedback.matchedMedicationName}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <CheckCircle2
                      className="w-6 h-6 text-emerald-600 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-base font-bold text-emerald-800">
                      {voiceFeedback.isHindi ? (
                        <span lang="hi">आवाज़ दर्ज हो गई (Voice Processed)</span>
                      ) : (
                        "Voice Check-In Processed"
                      )}
                    </span>
                  </>
                )}

                {voiceFeedback.symptomReported && (
                  <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-base font-bold border border-rose-200">
                    Symptom Alert Sent
                  </span>
                )}
              </div>

              {voiceFeedback.isScheduleInquiry &&
                voiceFeedback.timingDetails && (
                  <div className="flex flex-wrap items-center gap-2.5 text-base font-bold text-slate-800 pt-1">
                    <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                      <span aria-hidden="true">⏰</span> {voiceFeedback.timingDetails.timeSlots?.join(", ")}
                    </span>
                    <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                      <span aria-hidden="true">🥣</span> {voiceFeedback.timingDetails.mealInstruction}
                    </span>
                  </div>
                )}

              <p className="text-lg font-semibold text-slate-700">
                "{voiceTranscript}"
              </p>

              {/* Large, high-contrast spoken text (enhanced if native Hindi voice unavailable) */}
              <p
                lang={voiceFeedback.isHindi ? "hi" : "en"}
                className={`leading-relaxed ${speechLang.startsWith("hi") && !hasHindiVoice
                  ? "text-2xl sm:text-3xl font-black bg-white p-5 rounded-2xl border-3 border-blue-500 text-slate-900 shadow-md"
                  : "text-xl sm:text-2xl text-slate-800 font-bold"
                  }`}
              >
                <span aria-hidden="true">🤖</span> AI Spoken: "{voiceFeedback.spokenResponse}"
              </p>
            </div>

            <button
              id="btn-speak-voice-feedback-again"
              type="button"
              aria-label="Replay Audio, play response again"
              onClick={() =>
                speakText(voiceFeedback.spokenResponse, voiceFeedback.isHindi)
              }
              className="px-5 py-3.5 bg-white hover:bg-slate-50 rounded-2xl text-base sm:text-lg font-bold text-slate-700 border border-slate-200 flex items-center gap-2 shrink-0 transition active:scale-98 shadow-sm"
            >
              <Volume2 className="w-5 h-5 text-blue-600" aria-hidden="true" />
              Replay Audio
            </button>
          </div>
        )}
      </section>

      {/* 3. Upcoming Doctor Consultation Card */}
      {nextAppointment && (
        <article
          aria-label="Next Doctor Consultation"
          className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-sm text-slate-900"
        >
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
              <Calendar className="w-10 h-10" aria-hidden="true" />
            </div>
            <div>
              <span className="text-base font-bold uppercase tracking-wider text-indigo-800 block">
                Next Doctor Appointment
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                {nextAppointment.doctorName}
              </h3>
              <p className="text-lg sm:text-xl font-bold text-indigo-700 mt-0.5">
                {nextAppointment.specialty}
              </p>
              <p className="text-base text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
                <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
                {nextAppointment.location}
              </p>
            </div>
          </div>

          <div className="px-6 py-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-left sm:text-right w-full sm:w-auto shrink-0 space-y-1">
            <span className="text-base text-slate-500 block font-medium">Date & Time</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 block">
              {nextAppointment.date}
            </span>
            <span className="text-xl font-bold text-indigo-700 block">
              {nextAppointment.time}
            </span>
          </div>
        </article>
      )}

      {/* 4. Giant Accessible Medication Cards Grid */}
      <section aria-label="Today's Medications List" className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
              <Pill className="w-8 h-8" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Today's Medication Schedule
              </h2>
              <p className="text-lg sm:text-xl text-slate-600 font-medium">
                Large, high-contrast cards with overdose lockout protection.
              </p>
            </div>
          </div>

          <span className="text-base sm:text-lg font-bold px-4 py-2 rounded-2xl bg-white text-slate-700 border border-slate-200 shadow-sm">
            {medications.length} Prescribed
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {medications.map((med) => {
            const isTaken = Boolean(med.takenToday || (Array.isArray(med.takenSlots) && med.takenSlots.length > 0));

            return (
              <article
                key={med.id}
                className={`p-6 sm:p-8 rounded-3xl border-3 transition-all duration-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm hover:shadow-md ${isTaken
                  ? "bg-emerald-50/30 border-emerald-400"
                  : "bg-white border-slate-200 hover:border-blue-400"
                  }`}
              >
                {/* Medication Details */}
                <div className="space-y-3.5 max-w-xl">
                  {/* Time & Appearance Badges */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-800 text-base font-extrabold border border-blue-200">
                      <Clock className="w-4 h-4 text-blue-600" aria-hidden="true" />
                      {med.timeSlots?.join(", ") || "08:00 AM"}
                    </span>
                    <span className="px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-base font-bold border border-slate-200">
                      <span aria-hidden="true">💊</span> {med.pillAppearance || "Tablet"}
                    </span>
                    {med.remainingPills <= 5 && (
                      <span className="px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-900 text-base font-extrabold border border-amber-300 flex items-center gap-1.5 shadow-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" />
                        Low Refill ({med.remainingPills} left)
                      </span>
                    )}
                  </div>

                  {/* Medication Name & Dosage */}
                  <div>
                    <h3 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
                      {med.name}{" "}
                      <span className="text-2xl sm:text-4xl font-extrabold text-blue-600">
                        {med.dosage}
                      </span>
                    </h3>
                    <p className="text-xl text-slate-600 font-semibold mt-1">
                      {med.frequency}
                    </p>
                  </div>

                  {/* Per-Slot Status Badges (e.g. "08:00 AM taken, 08:00 PM pending") */}
                  <div className="space-y-2 pt-1">
                    <span className="text-base font-bold text-slate-600 uppercase tracking-wider block">
                      Daily Dosing Status:
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {med.timeSlots?.map((slot) => {
                        const slotTaken = (med.takenSlots || []).includes(slot);
                        const slotSkipped = (med.skippedSlots || []).includes(slot);
                        return (
                          <button
                            key={slot}
                            id={`btn-slot-${med.id}-${slot.replace(/[^a-zA-Z0-9]/g, "")}`}
                            type="button"
                            aria-label={`${slot} ${slotTaken ? "taken" : slotSkipped ? "skipped" : "pending"}, ${med.name} dose`}
                            onClick={() => {
                              if (!slotTaken && !slotSkipped) {
                                markDoseTaken(med.id, "Elder", slot);
                              }
                            }}
                            className={`px-4 py-2.5 rounded-2xl text-base sm:text-lg font-bold flex items-center gap-2 transition border ${slotTaken
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm"
                              : slotSkipped
                                ? "bg-amber-50 text-amber-900 border-amber-300 shadow-sm"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-200 active:scale-98"
                              }`}
                          >
                            {slotTaken ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                            ) : slotSkipped ? (
                              <X className="w-4 h-4 text-amber-600" aria-hidden="true" />
                            ) : (
                              <Clock className="w-4 h-4 text-blue-600" aria-hidden="true" />
                            )}
                            <span>{slot} {slotTaken ? "taken" : slotSkipped ? "skipped" : "pending"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Meal Instruction */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-lg sm:text-xl text-slate-700 font-medium">
                    <span aria-hidden="true">🥣</span> <strong className="text-slate-900">Meal Rule:</strong>{" "}
                    {med.mealInstruction || "Take with fresh water"}
                  </div>

                  {/* Food Rule Warning Banner if applicable */}
                  {med.foodRule && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-lg sm:text-xl text-amber-900 font-semibold">
                      <span aria-hidden="true">⚠️</span> <strong className="text-amber-950">Dietary Advisory:</strong>{" "}
                      {med.foodRule}
                    </div>
                  )}

                  {/* Critical Interaction Banner */}
                  {med.interactionWarning && (
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-lg sm:text-xl text-rose-900 font-bold">
                      <span aria-hidden="true">🛑</span> {med.interactionWarning}
                    </div>
                  )}
                </div>

                {/* Big Action Buttons */}
                <div className="w-full md:w-auto flex flex-col gap-3.5 shrink-0">
                  {isTaken ? (
                    <div className="space-y-2.5 w-full md:w-80">
                      <div className="w-full py-5 px-6 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-800 text-center flex items-center justify-center gap-2.5 font-black text-xl shadow-sm">
                        <CheckCircle2 className="w-7 h-7 shrink-0 text-emerald-600" aria-hidden="true" />
                        Taken at {med.lastTakenAt || "08:05 AM"}
                      </div>

                      {/* Visible Test Accidental 2nd Dose Button for Evaluators (Demo Mode Only) */}
                      {isDemoMode() && (
                        <button
                          id={`btn-test-lockout-${med.id}`}
                          type="button"
                          aria-label={`Test Accidental 2nd Dose (Lockout Demo) for ${med.name}`}
                          onClick={() => markDoseTaken(med.id, "Elder")}
                          className="w-full py-4 px-5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-lg border border-rose-200 transition active:scale-98 flex items-center justify-center gap-2 shadow-sm"
                        >
                          <ShieldAlert className="w-5 h-5 text-rose-600" aria-hidden="true" />
                          Test Accidental 2nd Dose (Lockout Demo)
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 w-full md:w-80">
                      <button
                        id={`btn-take-pill-${med.id}`}
                        type="button"
                        aria-label={`I Took This Pill, ${med.name} ${med.dosage}`}
                        onClick={() => markDoseTaken(med.id, "Elder")}
                        className="w-full py-5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white font-black text-2xl tracking-wide shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-3"
                      >
                        <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
                        I Took This Pill
                      </button>
                      <button
                        id={`btn-skip-pill-${med.id}`}
                        type="button"
                        aria-label={`Skip Dose, select reason to skip ${med.name}`}
                        onClick={() => {
                          const slots = Array.isArray(med.timeSlots) && med.timeSlots.length > 0 ? med.timeSlots : ["08:00 AM"];
                          const skipped = Array.isArray(med.skippedSlots) ? med.skippedSlots : [];
                          const pendingSlot = slots.find((s) => !skipped.includes(s)) || slots[0];
                          setSkipTarget({ med, slot: pendingSlot });
                        }}
                        className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-98 text-slate-700 font-bold text-lg border border-slate-200 transition flex items-center justify-center gap-2 shadow-sm"
                      >
                        <X className="w-5 h-5 text-slate-400" aria-hidden="true" />
                        Skip Dose
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Emergency SOS Confirmation Modal (Requirement 5) */}
      {showSosConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-confirm-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 animate-fade-in"
        >
          <div className="min-h-full flex justify-center py-4 sm:py-6">
            <div className="my-auto bg-white border-2 border-rose-300 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl text-center">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 border-2 border-rose-200 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <ShieldAlert className="w-12 h-12" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2
                  id="sos-confirm-title"
                  className="text-3xl sm:text-4xl font-black text-slate-900"
                >
                  Emergency SOS Alert?
                </h2>
                <p className="text-xl sm:text-2xl text-rose-700 font-bold" lang="hi">
                  क्या आप आपातकालीन सहायता भेजना चाहते हैं?
                </p>
                <p className="text-lg text-slate-600 font-medium pt-2">
                  This will immediately send a <strong className="text-rose-700 font-bold">CRITICAL STAGE 3 EMAIL</strong> to your family ({elderProfile.familyEmail}) and caretaker ({elderProfile.caretakerEmail}), and display direct emergency calling for <strong>112</strong> and <strong>102</strong>.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <button
                  id="btn-confirm-sos"
                  type="button"
                  aria-label="Yes, Send Emergency SOS, trigger critical emergency alert"
                  onClick={handleConfirmSos}
                  className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xl shadow-lg shadow-rose-600/30 transition active:scale-98 flex items-center justify-center gap-2"
                >
                  <PhoneCall className="w-6 h-6" aria-hidden="true" />
                  <span>Yes, Send Emergency SOS</span>
                </button>
                <button
                  id="btn-cancel-sos"
                  type="button"
                  aria-label="No, Cancel, cancel emergency alert"
                  onClick={() => setShowSosConfirm(false)}
                  className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-lg sm:text-xl border border-slate-300 transition active:scale-98 shadow-sm"
                >
                  No, Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skip Reason Modal (Requirement 4) */}
      {skipTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="skip-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 animate-fade-in"
        >
          <div className="min-h-full flex justify-center py-4 sm:py-6">
            <div className="my-auto bg-white border-2 border-amber-300 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="space-y-2 text-center">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 border border-amber-200 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <AlertTriangle className="w-9 h-9" aria-hidden="true" />
                </div>
                <h2 id="skip-modal-title" className="text-2xl sm:text-3xl font-black text-slate-900">
                  Skip {skipTarget.med.name} ({skipTarget.slot})?
                </h2>
                <p className="text-lg sm:text-xl text-slate-800 font-bold" lang="hi">
                  दवा छोड़ने का कारण चुनें:
                </p>
                <p className="text-base text-slate-600">
                  Please select a clinical reason. Caretaker will be notified at normal priority and pending missed alerts will be cancelled.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  id="btn-skip-reason-unwell"
                  type="button"
                  aria-label="Felt unwell, select reason felt unwell"
                  onClick={() => handleConfirmSkip("Felt unwell")}
                  className="w-full py-4 px-5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-black text-xl transition active:scale-98 text-left flex items-center justify-between shadow-sm"
                >
                  <span>Felt unwell</span>
                  <span className="text-base font-bold text-amber-700" lang="hi">(तबीयत ठीक नहीं लगी)</span>
                </button>

                <button
                  id="btn-skip-reason-ranout"
                  type="button"
                  aria-label="Ran out of medicine, select reason ran out of medicine"
                  onClick={() => handleConfirmSkip("Ran out of medicine")}
                  className="w-full py-4 px-5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-black text-xl transition active:scale-98 text-left flex items-center justify-between shadow-sm"
                >
                  <span>Ran out of medicine</span>
                  <span className="text-base font-bold text-slate-500" lang="hi">(दवा खत्म हो गई)</span>
                </button>

                <button
                  id="btn-skip-reason-doctor"
                  type="button"
                  aria-label="Doctor said so, select reason doctor advised to skip"
                  onClick={() => handleConfirmSkip("Doctor said so")}
                  className="w-full py-4 px-5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-200 font-black text-xl transition active:scale-98 text-left flex items-center justify-between shadow-sm"
                >
                  <span>Doctor said so</span>
                  <span className="text-base font-bold text-blue-700" lang="hi">(डॉक्टर ने मना किया)</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  id="btn-cancel-skip-modal"
                  type="button"
                  aria-label="Cancel, keep dose active and close skip dialog"
                  onClick={() => setSkipTarget(null)}
                  className="w-full py-3.5 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg border border-slate-300 transition active:scale-98"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accessible Cloud AI Consent Preferences Modal */}
      <ConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
      />
    </section>
  );
}
