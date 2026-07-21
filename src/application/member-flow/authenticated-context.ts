import { currentUser } from "@clerk/nextjs/server";
import type { AuthPrincipal } from "@/domains/identity/types";
import { SupabaseMemberStore } from "@/application/member-flow/supabase-member-store";
import { clerkEnvironmentConfigured } from "@/integrations/auth/clerk-boundary";
import { createSupabaseAdminClient, supabaseAdminEnvironmentConfigured } from "@/integrations/supabase/server";
import { systemClock } from "@/shared/clock";

export type MemberContextResult =
  | { kind: "ready"; principal: AuthPrincipal; memberProfileId: string; store: SupabaseMemberStore }
  | { kind: "setup_required"; missing: string[] }
  | { kind: "unauthenticated" };

export async function getAuthenticatedMemberContext(): Promise<MemberContextResult> {
  const missing = requiredEnvironmentVariables().filter((name) => !process.env[name]);
  if (!clerkEnvironmentConfigured() || !supabaseAdminEnvironmentConfigured() || missing.length > 0) {
    return { kind: "setup_required", missing };
  }

  const user = await currentUser();
  if (!user) return { kind: "unauthenticated" };

  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
  if (!email) throw new Error("AUTHENTICATED_USER_EMAIL_REQUIRED");

  const principal: AuthPrincipal = {
    id: `clerk:${user.id}`,
    provider: "clerk",
    externalId: user.id,
    email,
  };

  const store = new SupabaseMemberStore(createSupabaseAdminClient(), systemClock);
  const memberProfileId = await store.bootstrapMember(principal);

  return { kind: "ready", principal, memberProfileId, store };
}

export function requiredEnvironmentVariables(): string[] {
  return [
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
}
