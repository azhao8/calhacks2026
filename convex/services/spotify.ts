import { SPOTIFY } from "../lib/config";

// The one module that talks to Spotify (§8.9). Call it only from actions. Never poll: one fetch per connection.

const ACCOUNTS = "https://accounts.spotify.com";
const API = "https://api.spotify.com/v1";

// Spotify answered 403: the account isn't on the app's allow-list, or it's a different account than the one we added.
export class SpotifyRefusedError extends Error {
  constructor() {
    super("Spotify refused this account");
  }
}

export class SpotifyAuthError extends Error {}

export type SpotifyTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
};

// An app as the token calls need it. `secret` is the one saved on the admin page, if any.
export type SpotifyAppCredentials = { clientId: string; label: string; secret: string | null };

// The saved secret wins; the env var SPOTIFY_CLIENT_SECRET_<LABEL> is the fallback for older apps.
export function clientSecret(app: { label: string; secret: string | null }): string {
  if (app.secret) return app.secret;
  const name = SPOTIFY.secretEnvName(app.label);
  const secret = process.env[name];
  if (!secret) throw new Error(`No client secret saved for ${app.label}, and ${name} is not set`);
  return secret;
}

export function hasClientSecret(app: { label: string; secret: string | null }): boolean {
  return Boolean(app.secret || process.env[SPOTIFY.secretEnvName(app.label)]);
}

// "Check app": Spotify's client credentials grant. It touches no user and needs no allow-list,
// so it only tells us whether Spotify accepts this client ID and secret pair.
export async function checkClientCredentials(clientId: string, secret: string): Promise<"accepted" | "rejected"> {
  const response = await fetch(`${ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });
  if (response.ok) return "accepted";
  if (response.status === 400 || response.status === 401) return "rejected";
  throw new Error(`Spotify token request failed with ${response.status}`);
}

export function authorizeUrl(options: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(`${ACCOUNTS}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("scope", SPOTIFY.scopes.join(" "));
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("state", options.state);
  return url.toString();
}

async function tokenRequest(
  app: SpotifyAppCredentials,
  body: Record<string, string>,
  previousRefreshToken?: string,
): Promise<SpotifyTokenSet> {
  const response = await fetch(`${ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${app.clientId}:${clientSecret(app)}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  if (response.status === 400 || response.status === 401) {
    throw new SpotifyAuthError(`Spotify token request failed with ${response.status}`);
  }
  if (!response.ok) throw new Error(`Spotify token request failed with ${response.status}`);
  const json = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
  const refreshToken = json.refresh_token ?? previousRefreshToken;
  if (!refreshToken) throw new SpotifyAuthError("Spotify returned no refresh token");
  return {
    accessToken: json.access_token,
    refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
    scopes: (json.scope ?? "").split(" ").filter(Boolean),
  };
}

export async function exchangeCode(
  app: SpotifyAppCredentials,
  code: string,
  redirectUri: string,
): Promise<SpotifyTokenSet> {
  return await tokenRequest(app, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export async function refreshTokens(
  app: SpotifyAppCredentials,
  refreshToken: string,
): Promise<SpotifyTokenSet> {
  return await tokenRequest(app, { grant_type: "refresh_token", refresh_token: refreshToken }, refreshToken);
}

async function get<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.status === 403) throw new SpotifyRefusedError();
  if (response.status === 401) throw new SpotifyAuthError("Spotify access token was rejected");
  if (!response.ok) throw new Error(`Spotify ${path.split("?")[0]} failed with ${response.status}`);
  return (await response.json()) as T;
}

// GET /me no longer returns the email; we only need the account ID. A 403 here means not allow-listed.
export async function currentUserId(accessToken: string): Promise<string> {
  const me = await get<{ id: string }>(accessToken, "/me");
  return me.id;
}

type ApiArtist = { id: string; name: string; genres?: string[] };
type ApiTrack = { id: string | null; name: string; artists: { id: string | null; name: string }[] };

export type SpotifyListening = {
  topArtists: { spotifyId: string; name: string; genres: string[]; rank: number; range: "short_term" | "medium_term" }[];
  topTracks: { spotifyId: string; name: string; artistNames: string[]; rank: number; range: "short_term" | "medium_term" }[];
  likedSongs: { spotifyId: string; name: string; artistIds: string[]; artistNames: string[] }[];
};

// Top artists and tracks for short and medium term (limit 50) and the first 200 liked songs.
export async function fetchListening(accessToken: string): Promise<SpotifyListening> {
  const listening: SpotifyListening = { topArtists: [], topTracks: [], likedSongs: [] };
  for (const range of SPOTIFY.timeRanges) {
    const artists = await get<{ items: ApiArtist[] }>(
      accessToken,
      `/me/top/artists?time_range=${range}&limit=${SPOTIFY.topLimit}`,
    );
    artists.items.forEach((artist, index) =>
      listening.topArtists.push({
        spotifyId: artist.id,
        name: artist.name,
        genres: artist.genres ?? [],
        rank: index + 1,
        range,
      }),
    );
    const tracks = await get<{ items: ApiTrack[] }>(
      accessToken,
      `/me/top/tracks?time_range=${range}&limit=${SPOTIFY.topLimit}`,
    );
    tracks.items.forEach((track, index) =>
      listening.topTracks.push({
        spotifyId: track.id ?? "",
        name: track.name,
        artistNames: track.artists.map((artist) => artist.name),
        rank: index + 1,
        range,
      }),
    );
  }
  const pageSize = 50;
  for (let offset = 0; offset < SPOTIFY.likedSongsLimit; offset += pageSize) {
    const page = await get<{ items: { track: ApiTrack | null }[]; next: string | null }>(
      accessToken,
      `/me/tracks?limit=${pageSize}&offset=${offset}`,
    );
    for (const { track } of page.items) {
      if (track === null) continue;
      listening.likedSongs.push({
        spotifyId: track.id ?? "",
        name: track.name,
        artistIds: track.artists.map((artist) => artist.id ?? ""),
        artistNames: track.artists.map((artist) => artist.name),
      });
    }
    if (page.next === null) break;
  }
  return listening;
}
