"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { reducedMotion } from "./DropMotion";

// A soundwave ring around a card: fine accent strands that follow the card's rounded edge and
// ripple slowly, with a small spring every 4 seconds. It sits outside the card in its own layer,
// so nothing on the page moves. Under reduced motion it is drawn once and holds still.

const STRANDS = 7;
const GAP = 7; // px between the card's edge and the ring's middle
const AMP = 2.6; // px, the resting ripple
const SPRING_EVERY = 4000; // ms
const RADIUS = 24; // the card's radius-lg
const POINTS = 220;
const BLEED = GAP + AMP * 2 + 2; // room outside the card; stays inside the 16px screen gutter

// A point at `t` (0 to 1) along a rounded rectangle, with its outward normal.
function perimeter(w: number, h: number, r: number, t: number): [number, number, number, number] {
  const straightW = w - 2 * r;
  const straightH = h - 2 * r;
  const arc = (Math.PI / 2) * r;
  const total = 2 * straightW + 2 * straightH + 4 * arc;
  let s = t * total;
  const corner = (cx: number, cy: number, from: number): [number, number, number, number] => {
    const a = from + s / r;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a)];
  };
  // Top edge, left to right.
  if (s < straightW) return [r + s, 0, 0, -1];
  s -= straightW;
  if (s < arc) return corner(w - r, r, -Math.PI / 2);
  s -= arc;
  if (s < straightH) return [w, r + s, 1, 0];
  s -= straightH;
  if (s < arc) return corner(w - r, h - r, 0);
  s -= arc;
  if (s < straightW) return [w - r - s, h, 0, 1];
  s -= straightW;
  if (s < arc) return corner(r, h - r, Math.PI / 2);
  s -= arc;
  if (s < straightH) return [0, h - r - s, -1, 0];
  s -= straightH;
  return corner(r, r, Math.PI);
}

// A damped spring: rises fast, overshoots a little, settles within about a second.
function spring(msSince: number): number {
  const t = msSince / 1000;
  return Math.exp(-4 * t) * Math.sin(10 * t);
}

function draw(paths: SVGPathElement[], w: number, h: number, ms: number) {
  const phase = ms / 2600;
  const boost = 1 + 1.3 * spring(ms % SPRING_EVERY);
  const r = RADIUS + GAP;
  const ww = w + 2 * GAP;
  const hh = h + 2 * GAP;
  paths.forEach((path, i) => {
    const offset = i / STRANDS;
    let d = "";
    for (let p = 0; p <= POINTS; p++) {
      const t = p / POINTS;
      const [x, y, nx, ny] = perimeter(ww, hh, r, t);
      // Whole numbers of waves around the loop, so every strand closes on itself.
      const wave =
        Math.sin(2 * Math.PI * (5 * t + phase + offset * 0.9)) * 0.65 +
        Math.sin(2 * Math.PI * (9 * t - phase * 0.7 + offset * 1.7)) * 0.35;
      const n = AMP * boost * wave * (0.55 + 0.45 * Math.sin(Math.PI * offset * 2 + phase));
      d += `${p === 0 ? "M" : "L"}${(x + BLEED - GAP + nx * n).toFixed(1)} ${(y + BLEED - GAP + ny * n).toFixed(1)}`;
    }
    path.setAttribute("d", d + "Z");
  });
}

export function WaveRing({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = box.current;
    const root = svg.current;
    if (!el || !root) return;
    const paths = Array.from(root.querySelectorAll("path"));
    let size = { w: el.offsetWidth, h: el.offsetHeight };
    let frame = 0;
    const start = performance.now();
    const still = reducedMotion();

    const render = (ms: number) => {
      root.setAttribute("viewBox", `0 0 ${size.w + 2 * BLEED} ${size.h + 2 * BLEED}`);
      draw(paths, size.w, size.h, ms);
    };
    const tick = (now: number) => {
      render(now - start);
      frame = requestAnimationFrame(tick);
    };

    const resize = new ResizeObserver(() => {
      size = { w: el.offsetWidth, h: el.offsetHeight };
      if (still) render(0);
    });
    resize.observe(el);
    if (still) render(0);
    else frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, []);

  return (
    <div ref={box} className="relative">
      <svg
        ref={svg}
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute overflow-visible fill-none stroke-accent"
        style={{ inset: -BLEED, width: `calc(100% + ${2 * BLEED}px)`, height: `calc(100% + ${2 * BLEED}px)` }}
      >
        {Array.from({ length: STRANDS }, (_, i) => (
          <path key={i} strokeWidth={i % 3 === 0 ? 1.25 : 0.75} strokeOpacity={0.25 + 0.5 * ((i * 3) % STRANDS) / STRANDS} />
        ))}
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}
