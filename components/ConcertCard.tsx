import { Button } from "./Button";
import { Card, Meta, MetaItem, Tag } from "./Card";

// A weekly ask (design/components/ConcertCard). Before a match it shows only the day, time, price
// and distance; the event stays a surprise. The toggle's label says the current state.
export function ConcertCard({
  day,
  time,
  price,
  distance,
  going,
  onToggle,
  loading,
  locked,
  revealed,
  artist,
  venue,
  kind,
}: {
  day: string;
  time: string;
  price: string;
  distance?: string;
  going: boolean;
  onToggle?: () => void;
  loading?: boolean;
  locked?: boolean;
  revealed?: boolean;
  artist?: string;
  venue?: string;
  kind?: string;
}) {
  return (
    <Card selected={going}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {revealed ? (
          <Tag>{kind ?? "Concert"}</Tag>
        ) : (
          <Tag accent icon="spark">
            Revealed when you match
          </Tag>
        )}
        {distance ? <span className="text-caption text-ink-muted">{distance}</span> : null}
      </div>
      <div className="flex flex-col gap-1">
        {revealed && artist ? <p className="text-headline">{artist}</p> : null}
        <h2 className="font-display text-display leading-[1.05]">{day}</h2>
        <p className="text-headline tabular-nums">{time}</p>
      </div>
      <Meta>
        <MetaItem icon="ticket">{price}</MetaItem>
        {revealed && venue ? <MetaItem icon="pin">{venue}</MetaItem> : null}
      </Meta>
      <Button
        block
        variant={going ? "secondary" : "primary"}
        pressed={going}
        icon={going ? "check" : undefined}
        onClick={onToggle}
        loading={loading}
        disabled={locked}
      >
        {going ? "You can make it" : "I can make it"}
      </Button>
    </Card>
  );
}
