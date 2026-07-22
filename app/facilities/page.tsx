import { appEnvironmentConfigured } from "@/application/member-flow/environment";
import { EnvironmentSetupNotice } from "../../src-page/environment-setup-notice";
import { FacilitiesExperience } from "../../src-page/facilities-experience";

export const dynamic = "force-dynamic";

export default function FacilitiesPage() {
  if (!appEnvironmentConfigured()) return <EnvironmentSetupNotice />;
  return <FacilitiesExperience />;
}