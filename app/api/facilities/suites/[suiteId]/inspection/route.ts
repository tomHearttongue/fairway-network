import { NextRequest, NextResponse } from "next/server";
import { requiredEnvironmentVariables } from "@/application/member-flow/authenticated-context";
import { getAuthenticatedFacilitiesContext } from "@/application/facilities-flow/authenticated-facilities-context";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, routeContext: { params: Promise<{ suiteId: string }> }) {
  const body = await request.json().catch(() => ({}));
  const { suiteId } = await routeContext.params;
  try {
    const context = await getAuthenticatedFacilitiesContext();
    if (context.kind === "setup_required") return NextResponse.json({ error: "ENVIRONMENT_NOT_CONFIGURED", required: requiredEnvironmentVariables(), missing: context.missing }, { status: 503 });
    if (context.kind === "unauthenticated") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (context.kind === "forbidden") return NextResponse.json({ error: "FACILITIES_FORBIDDEN" }, { status: 403 });
    const reason = String(body.reason ?? "").trim();
    if (!reason) return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 });
    return NextResponse.json(await context.store.flagInspection({ actorMemberProfileId: context.memberProfileId, suiteId, reason, idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()) }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 409 });
  }
}