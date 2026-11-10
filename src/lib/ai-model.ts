// Single place to change the AI models used by the app (Google Gemini, own key).
export const GEMINI_MODEL_VISION = "gemini-2.5-flash"; // photo analysis, nutrition labels
export const GEMINI_MODEL_TEXT = "gemini-2.5-flash-lite"; // text-only analysis, corrections, categories
export const GEMINI_MODEL_TRANSCRIBE = "gemini-2.5-flash-lite"; // voice dictation (can be raised to gemini-2.5-flash)
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
