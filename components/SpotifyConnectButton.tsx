import { Icon } from "./Icon";
import { Spinner } from "./Spinner";
import { SpotifyIcon } from "./SpotifyIcon";

// The one place Spotify green appears (design/components/SpotifyConnectButton). Never themed.
// Brand colors come from the design tokens `spotify` (Spotify Green #1ED760) and `on-spotify`
// (black), the colors Spotify's Design & Branding Guidelines allow for the icon and its button.
// The icon is 28px (the guidelines' digital minimum is 21px) with 14px of clear space on every
// side (half its height). It is decorative, so the button's accessible name is just its text.
// The label says what Melos does; it never implies Spotify endorses or partners with Melos.
export function SpotifyConnectButton({
  state = "idle",
  label = "Connect Spotify",
  account,
  note,
  onClick,
  disabled,
}: {
  state?: "idle" | "connecting" | "connected";
  label?: string;
  account?: string;
  note?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  if (state === "connected") {
    return (
      <div className="flex flex-col gap-2">
        <div role="status" className="flex items-center gap-3 rounded-pill border-[1.5px] border-line-strong px-4 py-3 text-ink">
          <Icon name="check" className="text-success" />
          <span>
            Spotify connected
            {account ? <span className="text-small text-ink-muted"> as {account}</span> : null}
          </span>
        </div>
        {note ? <p className="text-caption text-ink-muted">{note}</p> : null}
      </div>
    );
  }
  const connecting = state === "connecting";
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={connecting ? undefined : onClick}
        disabled={disabled}
        aria-busy={connecting || undefined}
        className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-3.5 rounded-pill bg-spotify py-3.5 pr-6 pl-3.5 text-body font-bold text-on-spotify aria-busy:cursor-progress disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden="true" className="grid size-7 flex-none place-items-center">
          {connecting ? <Spinner /> : <SpotifyIcon className="size-7" />}
        </span>
        {connecting ? "Connecting to Spotify" : label}
      </button>
      {note ? <p className="text-center text-caption text-ink-muted">{note}</p> : null}
    </div>
  );
}
