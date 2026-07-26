import { deriveDemoGolfProfile, buildDemoUniverse, type DemoGolfProfile } from "@/demo-universe/universe";
import { projectMemberGolfProfile, type CompletedSessionActivityFact } from "@/application/member-flow/member-activity";

export type { DemoGolfProfile };

const demoUniverse = buildDemoUniverse();
const demoTom = demoUniverse.members.find((member) => member.id === "demo-tom");
if (!demoTom) throw new Error("DEMO_TOM_NOT_FOUND");
const canonicalDemoTom = demoTom;

export const TOM_DEMO_GOLF_PROFILE: DemoGolfProfile = deriveDemoGolfProfile(demoUniverse, canonicalDemoTom.memberProfileId);

export function demoGolfProfileForEmail(email: string, completedSessions: CompletedSessionActivityFact[] = []): DemoGolfProfile {
  const normalized = email.toLowerCase();
  const member = demoUniverse.members.find((item) => item.email.toLowerCase() === normalized) ?? canonicalDemoTom;
  const baseProfile = deriveDemoGolfProfile(demoUniverse, member.memberProfileId);
  if (completedSessions.length === 0) return baseProfile;
  const seededSessionIds = new Set(
    demoUniverse.sessions
      .filter((session) => session.memberProfileId === member.memberProfileId && session.endedAt)
      .map((session) => session.id),
  );
  return projectMemberGolfProfile({ baseProfile, completedSessions, seededSessionIds });
}
