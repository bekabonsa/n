import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../config.js";

function normalize(value) {
  return String(value || "").trim();
}

function looksLikePlaceholder(value) {
  const normalized = normalize(value).toLowerCase();
  return !normalized
    || normalized.includes("your_")
    || normalized.includes("your-")
    || normalized.includes("example")
    || normalized.includes("changeme");
}

export function hasAuthConfig() {
  return !looksLikePlaceholder(SUPABASE_URL) && !looksLikePlaceholder(SUPABASE_ANON_KEY);
}

export function getMissingAuthConfigFields() {
  const missing = [];
  if (looksLikePlaceholder(SUPABASE_URL)) {
    missing.push("SUPABASE_URL");
  }
  if (looksLikePlaceholder(SUPABASE_ANON_KEY)) {
    missing.push("SUPABASE_ANON_KEY");
  }
  return missing;
}
