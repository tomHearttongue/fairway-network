import { NextResponse } from "next/server";
import { requiredEnvironmentVariables } from "@/application/member-flow/authenticated-context";
import { getAuthenticatedFacilitiesContext } from "@/application/facilities-flow/authenticated-facilities-context";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await getAuthenticatedFacilitiesContext();
    if (context.kind === "setup_required") return NextResponse.json({ error: "ENVIRONMENT_NOT_CONFIGURED", required: requiredEnvironmentVariables(), missing: context.missing }, { status: 503 });
    if (context.kind === "unauthenticated") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (context.kind === "forbidden") return NextResponse.json({ error: "FACILITIES_FORBIDDEN" }, { status: 403 });
    return NextResponse.json(await context.store.getFacilitiesState(context.memberProfileId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 500 });
  }
}