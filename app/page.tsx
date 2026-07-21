import { appEnvironmentConfigured } from "@/application/member-flow/environment";
import { EnvironmentSetupNotice } from "../src-page/environment-setup-notice";
import { MemberExperience } from "../src-page/member-experience";

export const dynamic = "force-dynamic";

export default function Home() {
  if (!appEnvironmentConfigured()) return <EnvironmentSetupNotice />;
  return <MemberExperience />;
}
