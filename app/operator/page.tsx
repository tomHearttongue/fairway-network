import { appEnvironmentConfigured } from "@/application/member-flow/environment";
import { EnvironmentSetupNotice } from "../../src-page/environment-setup-notice";
import { OperatorExperience } from "../../src-page/operator-experience";

export const dynamic = "force-dynamic";

export default function OperatorPage() {
  if (!appEnvironmentConfigured()) return <EnvironmentSetupNotice />;
  return <OperatorExperience />;
}