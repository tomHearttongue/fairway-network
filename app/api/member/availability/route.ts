import { NextResponse } from "next/server";
import { getAuthenticatedMemberContext, requiredEnvironmentVariables } from "@/application/member-flow/authenticated-context";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await getAuthenticatedMemberContext();
    if (context.kind === "setup_required") {
      return NextResponse.json({ error: "ENVIRONMENT_NOT_CONFIGURED", required: requiredEnvironmentVariables(), missing: context.missing }, { status: 503 });
    }
    if (context.kind === "unauthenticated") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const state = await context.store.getMemberState(context.memberProfileId);
    return NextResponse.json({
      environment: { clerkConfigured: true, supabaseConfigured: true },
      location: state.location,
      member: {
        person: state.person,
        profile: state.profile,
        membershipPlan: state.membershipPlan,
        availableCredits: state.availableCredits,
      },
      availability: state.availability,
      auditEvents: state.auditEvents,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 500 });
  }
}
