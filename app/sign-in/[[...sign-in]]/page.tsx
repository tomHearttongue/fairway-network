import { SignIn } from "@clerk/nextjs";
import { EnvironmentSetupNotice } from "../../../src-page/environment-setup-notice";
import { appEnvironmentConfigured } from "@/application/member-flow/environment";

export default function SignInPage() {
  if (!appEnvironmentConfigured()) return <EnvironmentSetupNotice />;
  return <main className="auth-page"><SignIn /></main>;
}
