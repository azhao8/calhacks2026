import { cx } from "./cx";

// The bright screen background: grain gradient, horizon streak, one blurred thermal object
// (design/docs/backgrounds.md). Styles live in components/backdrop.css. Nothing moves.
const PARTS = {
  speaker: ["a", "b thermal-hot", "c thermal-hot"],
  headphones: ["a", "b thermal-hot", "c thermal-hot"],
  cassette: ["a", "b", "c"],
  ticket: ["a", "b"],
  records: ["a", "b"],
  mic: ["a", "b", "c thermal-hot"],
  radio: ["a", "b", "c thermal-hot"],
} as const;

export type BackdropObject = keyof typeof PARTS | "none";

export function Backdrop({
  object = "none",
  quiet,
  fixed,
  className,
}: {
  object?: BackdropObject;
  quiet?: boolean;
  // Pin to the viewport, so long screens scroll over a still background.
  fixed?: boolean;
  className?: string;
}) {
  const parts = object === "none" ? null : PARTS[object];
  return (
    <div
      aria-hidden="true"
      className={cx("backdrop pointer-events-none inset-0 overflow-hidden", fixed ? "fixed" : "absolute", quiet && "backdrop--quiet", className)}
    >
      <div className="backdrop__haze" />
      <div className="backdrop__streak" />
      <div className="backdrop__core" />
      <div className="backdrop__floor" />
      {parts ? <div className="backdrop__cast" /> : null}
      {parts ? (
        <div className={`backdrop__stage obj-${object}`}>
          {parts.map((part) => (
            <div key={part} className={part} />
          ))}
        </div>
      ) : null}
      <div className="backdrop__vignette" />
      <div className="backdrop__grain" />
    </div>
  );
}
