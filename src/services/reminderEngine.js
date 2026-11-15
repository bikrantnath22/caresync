/**
 * CareSync AI — Proactive Reminder Engine
 * Pure deterministic notification engine that evaluates:
 * 1. dose-upcoming: 15 min before slot time
 * 2. dose-missed-30: 30 min after slot time (Stage 2 Caretaker alert)
 * 3. dose-missed-60: 60 min after slot time (Stage 3 Family urgent alert with refill links)
 * 4. appointment: 24h and 2h before scheduled doctor consultations
 * 5. refill: 5 or fewer pills remaining in dispenser
 *
 * Each notification has a unique, deterministic dedupeKey to prevent duplicate emails across reloads.
 */

/**
 * Parses a slot time string (e.g. "08:00 AM", "08:00 PM") into a Date object on referenceDate.
 * @param {string} slotStr
 * @param {Date} referenceDate
 * @returns {Date|null}
 */
export function parseSlotToDate(slotStr, referenceDate = new Date()) {
  if (!slotStr || typeof slotStr !== "string") return null;
  const match = slotStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = (match[3] || "").toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const d = new Date(referenceDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Returns formatted YYYY-MM-DD for a given Date in local time.
 * @param {Date} date
 * @returns {string}
 */
export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Pure function: calculates all due reminder notifications for the given snapshot.
 *
 * @param {object} params
 * @param {Array<object>} params.medications - Active medications list
 * @param {Array<object>} params.appointments - Scheduled appointments list
 * @param {Date} [params.now] - Current effective timestamp (allows fast-forwarding)
 * @param {object} [params.elderProfile] - Patient profile metadata
 * @returns {Array<object>} Array of due notification objects with unique dedupeKey
 */
export function checkDueReminders({
  medications = [],
  appointments = [],
  now = new Date(),
  elderProfile = {},
}) {
  const notifications = [];
  const currentDateStr = getLocalDateString(now);
  const patientName = elderProfile.name || "Rameshwar Nath";
  const familyEmail = elderProfile.familyEmail || "family.admin@caresync.ai";
  const caretakerEmail = elderProfile.caretakerEmail || "caretaker.shift@caresync.ai";

  // Compute low-stock items for embedding refill links in missed-dose alerts
  const lowStockMeds = (medications || []).filter(
    (m) => Number(m.remainingPills) <= 5
  );
  const refillSection =
    lowStockMeds.length > 0
      ? `\n\n[REFILL ALERT] The following medications have critical stock (<= 5 pills remaining):\n` +
        lowStockMeds
          .map(
            (m) =>
              `• ${m.name} (${m.dosage}) — ${m.remainingPills} pills left. [1-Click Order Link: https://pharmacy.caresync.ai/refill/${m.id}]`
          )
          .join("\n")
      : "";

  // =========================================================================
  // 1. MEDICATION DOSES: UPCOMING, MISSED 30m, MISSED 60m & REFILLS
  // =========================================================================
  medications.forEach((med) => {
    // A. Refill Alert (5 pills or fewer left)
    if (Number(med.remainingPills) <= 5) {
      notifications.push({
        dedupeKey: `refill-${med.id}-${currentDateStr}`,
        type: "refill",
        stage: 1,
        stageLabel: "Stage 1: Low-Stock Pharmacy Refill Alert",
        priority: "normal",
        severity: "high",
        to: familyEmail,
        subject: `Low Stock Refill Alert: ${med.name} (${med.remainingPills} pills left)`,
        body: `Inventory Alert: ${patientName}'s supply of ${med.name} (${med.dosage}) is critically low (${med.remainingPills} pills left, threshold <= 5).\n1-Click Order Link: https://pharmacy.caresync.ai/refill/${med.id}`,
        logMessage: `Refill warning: ${med.name} dispenser has only ${med.remainingPills} pills remaining.`,
        medicationId: med.id,
      });
    }

    // B. Per-Slot Schedule Checks
    const slots = Array.isArray(med.timeSlots) && med.timeSlots.length > 0
      ? med.timeSlots
      : ["08:00 AM"];
    const takenSlots = Array.isArray(med.takenSlots) ? med.takenSlots : [];
    const skippedSlots = Array.isArray(med.skippedSlots) ? med.skippedSlots : [];

    slots.forEach((slot) => {
      const slotDate = parseSlotToDate(slot, now);
      if (!slotDate) return;

      const isTaken = takenSlots.includes(slot) || (med.takenToday && slots.length === 1);
      const isSkipped = skippedSlots.includes(slot);

      // Diff in minutes: positive = now is after slot time, negative = now is before slot time
      const diffMinutes = (now.getTime() - slotDate.getTime()) / (60 * 1000);

      // (1) Dose Upcoming: within 15 minutes before slot time (-15 <= diffMinutes < 0)
      if (diffMinutes >= -15 && diffMinutes < 0 && !isTaken && !isSkipped) {
        notifications.push({
          dedupeKey: `dose-upcoming-${med.id}-${slot}-${currentDateStr}`,
          type: "dose-upcoming",
          stage: 1,
          stageLabel: "Stage 1: Upcoming Dose Reminder",
          priority: "normal",
          severity: "normal",
          to: familyEmail,
          subject: `Upcoming Dose Reminder: ${med.name} (${slot}) for ${patientName}`,
          body: `Gentle Reminder: ${patientName} is scheduled to take ${med.name} (${med.dosage}) in 15 minutes at ${slot}.\nMeal rule: ${med.mealInstruction || "Take with water"}.`,
          logMessage: `Upcoming dose reminder: ${med.name} (${slot}) is due in 15 minutes.`,
          medicationId: med.id,
          slot,
        });
      }

      // (2) Dose Missed 30m: 30 minutes after slot time without confirmation (diffMinutes >= 30)
      // Cancels if taken or skipped!
      if (diffMinutes >= 30 && !isTaken && !isSkipped) {
        notifications.push({
          dedupeKey: `dose-missed-30-${med.id}-${slot}-${currentDateStr}`,
          type: "dose-missed-30",
          stage: 2,
          stageLabel: "Stage 2: Caretaker Missed-Dose Alert",
          priority: "high",
          severity: "high",
          to: caretakerEmail,
          subject: `ACTION REQUIRED: Missed ${slot} Dose for ${patientName}`,
          body: `Caretaker Alert: ${patientName} has not logged the scheduled ${slot} dose of ${med.name} ${med.dosage} (30 minutes overdue).\nPlease verify adherence and assist patient.${refillSection}`,
          logMessage: `Stage 2 Alert: ${med.name} (${slot}) is 30 mins overdue.`,
          medicationId: med.id,
          slot,
        });
      }

      // (3) Dose Missed 60m: 60 minutes after slot time without confirmation (diffMinutes >= 60)
      // Cancels if taken or skipped! Includes refill links.
      if (diffMinutes >= 60 && !isTaken && !isSkipped) {
        notifications.push({
          dedupeKey: `dose-missed-60-${med.id}-${slot}-${currentDateStr}`,
          type: "dose-missed-60",
          stage: 3,
          stageLabel: "Stage 3: Family Urgent Escalation Alert",
          priority: "critical",
          severity: "critical",
          to: familyEmail,
          subject: `CRITICAL ESCALATION: 60m Overdue Dose for ${patientName}`,
          body: `EMERGENCY CARE ALERT: ${patientName} has missed the ${slot} dose of ${med.name} ${med.dosage} by more than 60 minutes.\nImmediate in-person check or telephone confirmation required!${refillSection}`,
          logMessage: `Stage 3 Critical Escalation: ${med.name} (${slot}) is 60+ mins overdue!`,
          medicationId: med.id,
          slot,
        });
      }
    });
  });

  // =========================================================================
  // 2. APPOINTMENTS: 24 HOURS & 2 HOURS BEFORE CONSULTATION
  // =========================================================================
  (appointments || []).forEach((apt) => {
    if (!apt.date || !apt.time) return;
    const aptDateTime = parseSlotToDate(apt.time, new Date(`${apt.date}T00:00:00`));
    if (!aptDateTime) return;

    // Diff in hours: positive = hours remaining until appointment
    const diffHours = (aptDateTime.getTime() - now.getTime()) / (3600 * 1000);

    // 24 hours before (within 24 hours and more than 2 hours)
    if (diffHours <= 24 && diffHours > 2) {
      notifications.push({
        dedupeKey: `apt-24h-${apt.id}-${apt.date}`,
        type: "appointment-24h",
        stage: 1,
        stageLabel: "Stage 1: 24h Consultation Reminder",
        priority: "normal",
        severity: "normal",
        to: familyEmail,
        subject: `Consultation Tomorrow: ${apt.doctorName} for ${patientName}`,
        body: `Appointment Reminder: ${patientName} has a consultation tomorrow (${apt.date} at ${apt.time}) with ${apt.doctorName} (${apt.specialty}) at ${apt.location}.\nPreparation Notes: ${apt.notes || "None"}.`,
        logMessage: `24-hour consultation reminder for ${apt.doctorName} on ${apt.date}.`,
        appointmentId: apt.id,
      });
    }

    // 2 hours before (within 2 hours and >= 0)
    if (diffHours <= 2 && diffHours >= 0) {
      notifications.push({
        dedupeKey: `apt-2h-${apt.id}-${apt.date}`,
        type: "appointment-2h",
        stage: 1,
        stageLabel: "Stage 1: 2h Consultation Reminder",
        priority: "high",
        severity: "high",
        to: familyEmail,
        subject: `Upcoming Consultation in 2 Hours: ${apt.doctorName}`,
        body: `Immediate Notice: Consultation with ${apt.doctorName} (${apt.specialty}) is scheduled today at ${apt.time} (${apt.location}). Please prepare patient for departure.`,
        logMessage: `2-hour immediate consultation reminder for ${apt.doctorName}.`,
        appointmentId: apt.id,
      });
    }
  });

  return notifications;
}

export default checkDueReminders;
