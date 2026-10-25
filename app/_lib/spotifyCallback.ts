// What /spotify/callback should do right now (S07). The code and state from Spotify are handed
// to Convex only once the session is known to be signed in; otherwise the call would fail with
// not_signed_in and the one-time code would be wasted.

export type CallbackStep = "declined" | "missing_params" | "wait_for_auth" | "signed_out" | "connect";

export function callbackStep(input: {
  error: string | null;
  code: string | null;
  state: string | null;
  authLoading: boolean;
  authenticated: boolean;
}): CallbackStep {
  // Declining consent on Spotify's page comes back as ?error=access_denied.
  if (input.error !== null) return "declined";
  if (!input.code || !input.state) return "missing_params";
  if (input.authLoading) return "wait_for_auth";
  return input.authenticated ? "connect" : "signed_out";
}
