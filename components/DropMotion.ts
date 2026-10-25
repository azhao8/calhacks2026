// Small Web Animations helpers for the Drop screen. Nothing moves under reduced motion.

export function reducedMotion(): boolean {
  return typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function animate(el: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation | null {
  if (!el || reducedMotion() || typeof el.animate !== "function") return null;
  return el.animate(keyframes, options);
}

// The timer's once a second beat.
export const PULSE: Keyframe[] = [{ transform: "scale(1.04)", opacity: 1 }, { transform: "scale(1)", opacity: 0.9 }];

// The beat in the last 10 minutes: a little stronger.
export const PULSE_HOT: Keyframe[] = [{ transform: "scale(1.08)", opacity: 1 }, { transform: "scale(1)", opacity: 0.92 }];

// Each of the last ten seconds.
export const KICK: Keyframe[] = [{ transform: "scale(1.16)" }, { transform: "scale(0.98)" }, { transform: "scale(1)" }];

// A card arriving from the right.
export const ENTER: Keyframe[] = [
  { transform: "translateX(24px) scale(0.98)", opacity: 0 },
  { transform: "translateX(0) scale(1)", opacity: 1 },
];

// See more turns the card over: the front turns away, then the event turns in from the other side.
export const FLIP_OUT: Keyframe[] = [
  { transform: "perspective(1000px) rotateY(0deg)" },
  { transform: "perspective(1000px) rotateY(90deg)" },
];
export const FLIP_IN: Keyframe[] = [
  { transform: "perspective(1000px) rotateY(-90deg)" },
  { transform: "perspective(1000px) rotateY(0deg)" },
];
