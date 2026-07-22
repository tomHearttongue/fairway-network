import { currentUser } from "@clerk/nextjs/server";
import { SupabaseMemberStore } from "@/application/member-flow/supabase-member-store";
import { requiredEnvironmentVariables } from "@/application/member-flow/authenticated-context";
import { SupabaseFacilitiesStore } from "@/application/facilities-flow/supabase-facilities-store";
import type { AuthPrincipal } from "@/domains/identity/types";
import { clerkEnvironmentConfigured } from "@/integrations/auth/clerk-boundary";
import { createSupabaseAdminClient, supabaseAdminEnvironmentConfigured } from "@/integrations/supabase/server";
import { systemClock } from "@/shared/clock";

export type FacilitiesContextResult =
  | { kind: "ready"; principal: AuthPrincipal; memberProfileId: string; store: SupabaseFacilitiesStore }
  | { kind: "setup_required"; missing: string[] }
  | { kind: "unauthenticated" }
  | { kind: "forbidden"; memberProfileId: string };

export async function getAuthenticatedFacilitiesContext(): Promise<FacilitiesContextResult> {
  const missing = requiredEnvironmentVariables().filter((name) => !process.env[name]);
  if (!clerkEnvironmentConfigured() || !supabaseAdminEnvironmentConfigured() || missing.length > 0) {
    return { kind: "setup_required", missing };
  }

  const user = await currentUser();
  if (!user) return { kind: "unauthenticated" };

  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
  if (!email) throw new Error("AUTHENTICATED_USER_EMAIL_REQUIRED");

  const principal: AuthPrincipal = { id: `clerk:${user.id}`, provider: "clerk", externalId: user.id, email };
  const supabase = createSupabaseAdminClient();
  const memberStore = new SupabaseMemberStore(supabase, systemClock);
  const memberProfileId = await memberStore.bootstrapMember(principal);
  const store = new SupabaseFacilitiesStore(supabase, systemClock);

  if (isDevelopmentFacilitiesEmail(email)) {
    const state = await memberStore.getMemberState(memberProfileId);
    await store.grantDevelopmentFacilities({ memberProfileId, locationId: state.location.id, reason: "Development facilities bootstrap from FAIRWAY_DEVELOPMENT_FACILITIES_EMAILS" });
  }

  try {
    await store.getFacilitiesState(memberProfileId);
  } catch (error) {
    if (error instanceof Error && error.message.includes("FACILITIES_FORBIDDEN")) return { kind: "forbidden", memberProfileId };
    throw error;
  }

  return { kind: "ready", principal, memberProfileId, store };
}

function isDevelopmentFacilitiesEmail(email: string): boolean {
  const configured = process.env.FAIRWAY_DEVELOPMENT_FACILITIES_EMAILS;
  if (!configured) return false;
  return configured.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}