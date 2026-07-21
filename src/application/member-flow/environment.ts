import { clerkEnvironmentConfigured } from "@/integrations/auth/clerk-boundary";
import { supabaseAdminEnvironmentConfigured } from "@/integrations/supabase/server";

export function appEnvironmentConfigured(): boolean {
  return clerkEnvironmentConfigured() && supabaseAdminEnvironmentConfigured() && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function requiredAppEnvironmentVariables(): string[] {
  return [
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
    "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
    "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
    "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
}
