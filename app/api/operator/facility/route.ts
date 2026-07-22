import { NextResponse } from "next/server";
import { requiredEnvironmentVariables } from "@/application/member-flow/authenticated-context";
import { getAuthenticatedOperatorContext } from "@/application/operator-flow/authenticated-operator-context";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await getAuthenticatedOperatorContext();
    if (context.kind === "setup_required") return NextResponse.json({ error: "ENVIRONMENT_NOT_CONFIGURED", required: requiredEnvironmentVariables(), missing: context.missing }, { status: 503 });
    if (context.kind === "unauthenticated") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (context.kind === "forbidden") return NextResponse.json({ error: "OPERATOR_FORBIDDEN" }, { status: 403 });

    return NextResponse.json(await context.store.getFacilityState(context.memberProfileId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 500 });
  }
}