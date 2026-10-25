import type { ReactNode } from "react";
import { Card, Tag } from "./Card";
import { Icon } from "./Icon";

// A local or recommended artist with Spotify attribution (design/components/ArtistCard).
// Ported for completeness; unused while there is no local artists page (CLAUDE.md §2).
export function ArtistCard({
  name,
  genres = [],
  local,
  why,
  next,
  image,
  spotifyUrl,
  logo,
}: {
  name: string;
  genres?: string[];
  local?: boolean;
  why?: string;
  next?: string;
  image?: string;
  spotifyUrl: string;
  logo?: ReactNode;
}) {
  return (
    <Card>
      <div
        role={image ? "img" : undefined}
        aria-label={image ? name : undefined}
        style={image ? { backgroundImage: `url(${image})` } : undefined}
        className="aspect-square max-w-full rounded-sm bg-surface-raised bg-cover bg-center"
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          {local ? (
            <Tag accent icon="pin">
              Local
            </Tag>
          ) : null}
          {genres.map((g) => (
            <Tag key={g}>{g}</Tag>
          ))}
        </div>
        <h3 className="text-headline">{name}</h3>
        {why ? <p className="text-small text-ink-muted">{why}</p> : null}
        {next ? (
          <p className="flex items-center gap-1 text-small text-ink">
            <Icon name="calendar" /> {next}
          </p>
        ) : null}
      </div>
      <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center gap-2 text-caption font-semibold text-ink-muted no-underline">
        {logo ?? <span aria-hidden="true" className="size-5 flex-none rounded-full border-[1.5px] border-dashed border-ink-muted" />}
        Listen on Spotify
      </a>
    </Card>
  );
}
