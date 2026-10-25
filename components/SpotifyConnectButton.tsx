import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

// The one place Spotify green appears (design/components/SpotifyConnectButton). Never themed.
//
// PLACEHOLDER: Spotify's official logo goes in the slot (from Spotify's developer branding
// guidelines, 28px, black on the green; never drawn, recolored or cropped). Until the real asset
// is added, the slot shows the design's dashed placeholder. Pass it as `logo` once it's in public/.
export function SpotifyConnectButton({
  state = "idle",
  logo,
  label = "Connect Spotify",
  account,
  note,
  onClick,
  disabled,
}: {
  state?: "idle" | "connecting" | "connected";
  logo?: ReactNode;
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
        className="inline-flex min-h-13 cursor-pointer items-center justify-center gap-3 rounded-pill bg-spotify py-2.5 pr-6 pl-3.5 text-body font-bold text-on-spotify aria-busy:cursor-progress disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="grid size-7 flex-none place-items-center">
          {connecting ? (
            <Spinner />
          ) : (
            (logo ?? (
              <span
                aria-hidden="true"
                data-placeholder="spotify-logo"
                className="grid size-full place-items-center rounded-full border-[1.5px] border-dashed border-on-spotify text-[0.5rem] font-bold"
              >
                logo
              </span>
            ))
          )}
        </span>
        {connecting ? "Connecting to Spotify" : label}
      </button>
      {note ? <p className="text-center text-caption text-ink-muted">{note}</p> : null}
    </div>
  );
}
