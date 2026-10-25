import type { ReactNode } from "react";
import { Button } from "./Button";
import { Card, Ok, Tag } from "./Card";

// The short read on someone's taste, which they confirm or correct (design/components/TasteSummary).
// "That's me" and "Not quite" get equal weight.
export function TasteSummary({
  summary,
  artists = [],
  labels = [],
  eyebrow = "Here is how you sound",
  confirmed,
  onConfirm,
  onCorrect,
  busy,
  children,
}: {
  summary: string;
  artists?: string[];
  labels?: string[];
  eyebrow?: string;
  confirmed?: boolean;
  onConfirm?: () => void;
  onCorrect?: () => void;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <Card>
      <p className="text-caption text-ink-muted">{eyebrow}</p>
      <p className="font-display text-[1.5rem] leading-[1.25] font-semibold tracking-[-0.01em] text-pretty">{summary}</p>
      {artists.length > 0 ? (
        <ul aria-label="Artists" className="m-0 flex list-none flex-wrap gap-2 p-0">
          {artists.map((a) => (
            <li key={a}>
              <Tag icon="music">{a}</Tag>
            </li>
          ))}
        </ul>
      ) : null}
      {labels.length > 0 ? (
        <ul aria-label="Sounds like" className="m-0 flex list-none flex-wrap gap-2 p-0">
          {labels.map((l) => (
            <li key={l}>
              <Tag>{l}</Tag>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
      {confirmed ? (
        <Ok>Saved. You can change this anytime.</Ok>
      ) : onConfirm || onCorrect ? (
        <div className="grid grid-cols-2 gap-3">
          <Button block onClick={onConfirm} loading={busy}>
            That&apos;s me
          </Button>
          <Button block variant="secondary" onClick={onCorrect} disabled={busy}>
            Not quite
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
