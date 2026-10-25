// Small Web Animations helpers for the Drop screen. Nothing moves under reduced motion.

function reduced(): boolean {
  return typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function animate(el: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  if (!el || reduced() || typeof el.animate !== "function") return;
  el.animate(keyframes, options);
}

// The timer's once a second beat.
export const PULSE: Keyframe[] = [{ transform: "scale(1.04)", opacity: 1 }, { transform: "scale(1)", opacity: 0.9 }];

// A card arriving from the right.
export const ENTER: Keyframe[] = [
  { transform: "translateX(24px) scale(0.98)", opacity: 0 },
  { transform: "translateX(0) scale(1)", opacity: 1 },
];
