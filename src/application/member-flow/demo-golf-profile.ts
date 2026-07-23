import { demoGolfProfileForEmail as profileForEmail, deriveDemoGolfProfile, buildDemoUniverse, type DemoGolfProfile } from "@/demo-universe/universe";

export type { DemoGolfProfile };

const demoUniverse = buildDemoUniverse();
const demoTom = demoUniverse.members.find((member) => member.id === "demo-tom");
if (!demoTom) throw new Error("DEMO_TOM_NOT_FOUND");

export const TOM_DEMO_GOLF_PROFILE: DemoGolfProfile = deriveDemoGolfProfile(demoUniverse, demoTom.memberProfileId);

export function demoGolfProfileForEmail(email: string): DemoGolfProfile {
  return profileForEmail(email);
}
