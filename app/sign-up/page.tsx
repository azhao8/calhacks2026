import { SignInFlow } from "@/app/sign-in/SignInFlow";

// S03 in the register flow (Welcome, Get started, School): step 2 of onboarding. A separate route,
// so a reload here stays in the register flow.
export default function SignUpPage() {
  return <SignInFlow mode="register" />;
}
