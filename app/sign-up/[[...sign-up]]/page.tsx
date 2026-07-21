import { SignUp } from "@clerk/nextjs";
import { EnvironmentSetupNotice } from "../../../src-page/environment-setup-notice";
import { appEnvironmentConfigured } from "@/application/member-flow/environment";

export default function SignUpPage() {
  if (!appEnvironmentConfigured()) return <EnvironmentSetupNotice />;
  return <main className="auth-page"><SignUp /></main>;
}
