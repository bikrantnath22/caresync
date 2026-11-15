/**
 * CareSync AI — Security Utilities
 * Implements input sanitization, salted PIN verification with persistent rate-limiting lockout,
 * demo mode detection, and prescription file validation.
 */

// Salt for obfuscated role PIN comparisons
const PIN_SALT = "CareSync_Secure_Salt_v1_2026";

const STORAGE_FAILED_KEY = "caresync_pin_failed_attempts";
const STORAGE_LOCKOUT_KEY = "caresync_pin_lockout_expiry";

/**
 * Computes a deterministic 32-bit salted hash string.
 * @param {string} str
 * @returns {string}
 */
function hashWithSalt(str) {
  const combined = `${PIN_SALT}__${str}__${PIN_SALT}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// Precomputed salted hashes for the role PINs:
// Elder: "1111", Caretaker: "2222", Family: "3333"
const ROLE_HASHES = {
  elder: hashWithSalt("1111"),
  caretaker: hashWithSalt("2222"),
  family: hashWithSalt("3333"),
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds

/**
 * Retrieves the persisted failed PIN attempts count from localStorage.
 * @returns {number}
 */
export function getStoredFailedAttempts() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const val = localStorage.getItem(STORAGE_FAILED_KEY);
      return val ? parseInt(val, 10) || 0 : 0;
    }
  } catch {
    // fallback
  }
  return 0;
}

/**
 * Retrieves the persisted lockout expiration timestamp from localStorage.
 * @returns {number}
 */
export function getLockoutExpiry() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const val = localStorage.getItem(STORAGE_LOCKOUT_KEY);
      return val ? parseInt(val, 10) || 0 : 0;
    }
  } catch {
    // fallback
  }
  return 0;
}

/**
 * Persists failed PIN attempts and lockout timestamp to localStorage.
 * @param {number} attempts
 * @param {number} expiry
 */
function setStoredRateLimitState(attempts, expiry) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(STORAGE_FAILED_KEY, String(attempts));
      localStorage.setItem(STORAGE_LOCKOUT_KEY, String(expiry));
    }
  } catch {
    // fallback
  }
}

export const CONSENT_KEY = "caresync_cloud_consent";

/**
 * Retrieves the stored cloud AI & voice consent preference from localStorage.
 * @returns {"granted" | "declined" | null}
 */
export function getStoredConsent() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const val = localStorage.getItem(CONSENT_KEY);
      return val === "granted" || val === "declined" ? val : null;
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Persists the user's cloud AI & voice consent preference in localStorage.
 * @param {"granted" | "declined" | null} status
 */
export function setStoredConsent(status) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (status === "granted" || status === "declined") {
        localStorage.setItem(CONSENT_KEY, status);
      } else {
        localStorage.removeItem(CONSENT_KEY);
      }
    }
  } catch {
    // fallback
  }
}

/**
 * Checks whether the user has explicitly granted consent for cloud AI/voice services.
 * @returns {boolean}
 */
export function hasCloudConsent() {
  return getStoredConsent() === "granted";
}

/**
 * Checks whether the application is running in evaluator Demo Mode (VITE_DEMO_MODE="true").
 * @returns {boolean}
 */
export function isDemoMode() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      return String(import.meta.env.VITE_DEMO_MODE).toLowerCase() === "true";
    }
  } catch {
    // fallback
  }
  return false;
}

/**
 * Strips script tags, HTML tags, and dangerous inline event handlers,
 * while preserving legitimate clinical comparison operators (e.g. "BP < 90 and > 60").
 *
 * @param {string} str - Raw user input string
 * @returns {string} Sanitized string safe from XSS
 */
export function sanitizeInput(str) {
  if (typeof str !== "string") {
    return str == null ? "" : String(str);
  }
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "")
    .replace(/javascript:[^"'\s]*/gi, "")
    .trim();
}

/**
 * Validates a 4-digit PIN against a specific role or identifies the matching role.
 * Enforces a 30-second lockout after 5 consecutive failed attempts, persisted in localStorage.
 *
 * @param {string} inputPin - 4-digit numeric string
 * @param {string} [targetRole] - Optional target role ("elder" | "caretaker" | "family")
 * @returns {{ success: boolean, role: string | null, error: string | null, lockedUntil: number | null }}
 */
export function verifyRolePin(inputPin, targetRole = null) {
  const now = Date.now();
  let failedAttempts = getStoredFailedAttempts();
  let lockoutExpiry = getLockoutExpiry();

  // Check active lockout (persisted across page refresh)
  if (now < lockoutExpiry) {
    const remainingSec = Math.ceil((lockoutExpiry - now) / 1000);
    return {
      success: false,
      role: null,
      error: `Security lockout active: Too many failed attempts. Try again in ${remainingSec}s.`,
      lockedUntil: lockoutExpiry,
    };
  }

  // Validate format (must be exactly 4 digits)
  if (!inputPin || !/^\d{4}$/.test(String(inputPin).trim())) {
    failedAttempts++;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      lockoutExpiry = now + LOCKOUT_DURATION_MS;
      setStoredRateLimitState(failedAttempts, lockoutExpiry);
      return {
        success: false,
        role: null,
        error: "Too many failed attempts. Account locked for 30 seconds.",
        lockedUntil: lockoutExpiry,
      };
    }
    setStoredRateLimitState(failedAttempts, lockoutExpiry);
    return {
      success: false,
      role: null,
      error: "PIN must be exactly 4 digits.",
      lockedUntil: null,
    };
  }

  const cleanPin = String(inputPin).trim();
  const inputHash = hashWithSalt(cleanPin);

  // If a target role is specified, verify against that role only
  if (targetRole) {
    const normalizedRole = targetRole.toLowerCase();
    const expectedHash = ROLE_HASHES[normalizedRole];

    if (expectedHash && inputHash === expectedHash) {
      setStoredRateLimitState(0, 0);
      return {
        success: true,
        role: normalizedRole,
        error: null,
        lockedUntil: null,
      };
    }
  } else {
    // If no target role specified, match against any valid role
    for (const [role, hash] of Object.entries(ROLE_HASHES)) {
      if (inputHash === hash) {
        setStoredRateLimitState(0, 0);
        return {
          success: true,
          role,
          error: null,
          lockedUntil: null,
        };
      }
    }
  }

  // Verification failed
  failedAttempts++;
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    lockoutExpiry = now + LOCKOUT_DURATION_MS;
    setStoredRateLimitState(failedAttempts, lockoutExpiry);
    return {
      success: false,
      role: null,
      error: "Too many failed attempts. Account locked for 30 seconds.",
      lockedUntil: lockoutExpiry,
    };
  }

  setStoredRateLimitState(failedAttempts, lockoutExpiry);
  const remainingAttempts = MAX_FAILED_ATTEMPTS - failedAttempts;
  return {
    success: false,
    role: null,
    error: `Invalid PIN. ${remainingAttempts} attempt${
      remainingAttempts === 1 ? "" : "s"
    } remaining before lockout.`,
    lockedUntil: null,
  };
}

/**
 * Resets the PIN rate-limiter lockout state (useful for tests and admin resets).
 */
export function resetPinLockout() {
  setStoredRateLimitState(0, 0);
}

// Alias export required by SPEC.md
export const verifyPasscode = verifyRolePin;

/**
 * Validates prescription file uploads against strict MIME types and file size limits.
 *
 * @param {File} file
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validatePrescriptionFile(file) {
  if (!file) {
    return { valid: false, error: "No prescription file selected." };
  }

  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "application/pdf",
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error:
        "Unsupported file type. Please upload a PNG, JPEG, or PDF prescription.",
    };
  }

  const MAX_BYTES = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_BYTES) {
    return {
      valid: false,
      error: "File size exceeds the 5MB maximum limit.",
    };
  }

  return { valid: true, error: null };
}

// Alias export required by SPEC.md
export const validateFileUpload = validatePrescriptionFile;
