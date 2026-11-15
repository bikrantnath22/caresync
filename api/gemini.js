/**
 * CareSync AI — Vercel Serverless Gemini Proxy Function (/api/gemini)
 *
 * Forwards LLM requests securely to Google Generative AI API using server-side
 * environment variable process.env.GEMINI_API_KEY.
 *
 * Security & Reliability Guardrails:
 * - Keeps API keys strictly server-side (zero VITE_ exposure in client bundle).
 * - Restricts requests to allowed HTTP POST methods.
 * - Caps maximum payload size to protect against denial-of-service.
 * - Allow-lists approved Gemini models only.
 *
 * Note: Model names should default to the current stable Flash model on Google's
 * models page (e.g. gemini-2.5-flash or gemini-1.5-flash). Re-check model availability
 * periodically at https://ai.google.dev/models.
 */

// Allow-list of approved Gemini models
const ALLOWED_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
]);

// Maximum payload size allowed (7MB to support high-res prescription photos)
const MAX_PAYLOAD_BYTES = 7 * 1024 * 1024;

export default async function handler(req, res) {
  // CORS & Method Check
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return res.status(503).json({
      error: "Server configuration error: GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY in your environment variables.",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { model, payload } = body || {};

    // Use requested model (e.g. gemini-3.5-flash) or environment preference
    let targetModel = (
      model ||
      process.env.GEMINI_MODEL ||
      process.env.VITE_GEMINI_MODEL ||
      "gemini-3.5-flash"
    ).trim().replace(/^models\//, "");

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({
        error: "Missing or invalid payload in request body.",
      });
    }

    const payloadString = JSON.stringify(payload);
    if (Buffer.byteLength(payloadString, "utf8") > MAX_PAYLOAD_BYTES) {
      return res.status(413).json({
        error: "Payload exceeds 7MB maximum size limit.",
      });
    }

    let googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    let googleResponse = await fetch(googleUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payloadString,
    });

    // If targetModel returned 404, dynamically query ListModels to find the user's active supported Flash model
    if (googleResponse.status === 404) {
      try {
        const listResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        if (listResp.ok) {
          const listData = await listResp.json();
          const availableModels = (listData.models || []).filter(
            (m) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes("generateContent")
          );

          // Find the best matching model available on this API key
          const matchedModel =
            availableModels.find((m) => m.name.includes("3.5-flash")) ||
            availableModels.find((m) => m.name.includes("2.5-flash")) ||
            availableModels.find((m) => m.name.includes("2.0-flash")) ||
            availableModels.find((m) => m.name.includes("flash")) ||
            availableModels[0];

          if (matchedModel && matchedModel.name) {
            const cleanModelName = matchedModel.name.replace(/^models\//, "");
            const retryUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${apiKey}`;
            const retryResp = await fetch(retryUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: payloadString,
            });
            if (retryResp.ok || retryResp.status !== 404) {
              googleResponse = retryResp;
            }
          }
        }
      } catch {
        // Fallback gracefully
      }
    }

    const data = await googleResponse.json();
    return res.status(googleResponse.status).json(data);
  } catch (err) {
    return res.status(500).json({
      error: "Internal server error while processing Gemini proxy request.",
      details: err?.message || String(err),
    });
  }
}
