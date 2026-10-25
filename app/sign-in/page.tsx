import { SignInFlow } from "./SignInFlow";

// S03 for a returning student ("I already have an account"): no onboarding steps.
export default function SignInPage() {
  return <SignInFlow mode="sign_in" />;
}
