// The Spotify OAuth state: binds the student, the app, the redirect address, and an expiry, signed with HMAC-SHA256 keyed by
// SPOTIFY_STATE_SECRET, so a callback can't be replayed later or crossed between students (§8.8).

export const STATE_TTL_MS = 15 * 60 * 1000;

export type OAuthState = { userId: string; appId: string; redirectUri: string; expiresAt: number; nonce: string };

function secret(): string {
  const value = process.env.SPOTIFY_STATE_SECRET;
  if (!value) throw new Error("SPOTIFY_STATE_SECRET is not set on this Convex deployment");
  return value;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function key(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signState(userId: string, appId: string, redirectUri: string, now: number): Promise<string> {
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(12)));
  const payload: OAuthState = { userId, appId, redirectUri, expiresAt: now + STATE_TTL_MS, nonce };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(body)));
  return `${body}.${toBase64Url(signature)}`;
}

// Null for anything forged, malformed, or expired.
export async function verifyState(state: string, now: number): Promise<OAuthState | null> {
  const [body, signature, extra] = state.split(".");
  if (!body || !signature || extra !== undefined) return null;
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await key(),
      fromBase64Url(signature),
      new TextEncoder().encode(body),
    );
  } catch {
    return null;
  }
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as OAuthState;
    if (typeof payload.userId !== "string" || typeof payload.appId !== "string") return null;
    if (typeof payload.redirectUri !== "string") return null;
    if (typeof payload.expiresAt !== "number" || payload.expiresAt < now) return null;
    return payload;
  } catch {
    return null;
  }
}
