export const SITE_NAME = "Signal Atlas";
export const SITE_DESCRIPTION =
  "A private editorial instrument for discovering clustered world news stories and surfacing overlooked coverage.";
export const SAVED_STORIES_COOKIE = "signal-atlas-saved-stories";
export const DEFAULT_PAGE_SIZE = 24;

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isDemoModeForced() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function getConfiguredMode(): "demo" | "live" {
  if (isDemoModeForced()) {
    console.warn("[Signal Atlas] Demo mode forced via NEXT_PUBLIC_DEMO_MODE=true");
    return "demo";
  }

  if (!hasSupabaseConfig()) {
    console.warn(
      "[Signal Atlas] Missing Supabase config — falling back to demo mode.",
      `NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "MISSING"}`,
      `SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING"}`,
    );
    return "demo";
  }

  return "live";
}
