import { cx } from "./cx";
import { Icon } from "./Icon";

const KIND = {
  instagram: { icon: "at", share: "Share Instagram", sent: "Instagram shared" },
  phone: { icon: "phone", share: "Share my number", sent: "Number shared" },
} as const;

// One tap to share a phone number or Instagram handle (design/components/ConnectorButton).
// Instagram uses the generic at sign, never Instagram's logo. After sharing it turns into a
// success confirmation with a check.
export function ConnectorButton({
  kind,
  sent,
  pressed,
  label,
  onClick,
}: {
  kind: keyof typeof KIND;
  sent?: boolean;
  pressed?: boolean;
  label?: string;
  onClick?: () => void;
}) {
  const k = KIND[kind];
  return (
    <button
      type="button"
      aria-disabled={sent || undefined}
      aria-expanded={pressed}
      onClick={sent ? undefined : onClick}
      className={cx(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-pill border-[1.5px] bg-surface py-2 pr-4.5 pl-3.5 font-semibold",
        sent ? "cursor-default border-success text-success" : "cursor-pointer border-line-strong text-ink",
        pressed && !sent && "border-accent",
      )}
    >
      <Icon name={sent ? "check" : k.icon} />
      {sent ? k.sent : (label ?? k.share)}
    </button>
  );
}
