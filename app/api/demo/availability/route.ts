import { NextResponse } from "next/server";
import { demoStore } from "@/application/demo/demo-store";
import { clerkEnvironmentConfigured } from "@/integrations/auth/clerk-boundary";
import { supabaseEnvironmentConfigured } from "@/integrations/supabase/client";

export async function GET() {
  const availability = await demoStore.reservationService.getAvailability();

  return NextResponse.json({
    environment: { clerkConfigured: clerkEnvironmentConfigured(), supabaseConfigured: supabaseEnvironmentConfigured() },
    location: demoStore.location,
    member: {
      person: demoStore.person,
      profile: demoStore.memberProfile,
      membershipPlan: demoStore.membershipPlan,
      availableCredits: demoStore.ledger.availableBalance(demoStore.memberProfile.id),
    },
    availability,
    auditEvents: demoStore.auditLog.list(),
  });
}
