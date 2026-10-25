"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { codeDigits } from "@/app/_lib/validate";

// Six boxes for the sign-in code (mockup verify.png). Typing moves forward, Backspace moves back,
// and pasting or autofilling the whole code fills every box.
export function CodeInput({
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  function focus(index: number) {
    refs.current[Math.max(0, Math.min(5, index))]?.focus();
  }

  function setAt(index: number, typed: string) {
    const clean = codeDigits(typed);
    if (clean.length > 1) {
      // Autofill or a paste into one box: spread it from here.
      const next = codeDigits(value.slice(0, index) + clean);
      onChange(next);
      focus(next.length);
      return;
    }
    const chars = digits.slice();
    chars[index] = clean;
    // The code is kept without gaps, so a digit typed past the end lands in the next empty box.
    const next = chars.join("");
    onChange(next);
    if (clean) focus(Math.min(next.length, index + 1));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Backspace" && digits[index] === "" && index > 0) {
      event.preventDefault();
      const chars = digits.slice();
      chars[index - 1] = "";
      onChange(chars.join(""));
      focus(index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focus(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focus(index + 1);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = codeDigits(event.clipboardData.getData("text"));
    if (pasted.length === 0) return;
    event.preventDefault();
    onChange(pasted);
    focus(pasted.length);
  }

  return (
    <div role="group" aria-label="Your 6 digit code" aria-describedby={describedBy} className="grid grid-cols-6 gap-1 min-[360px]:gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className="h-14 min-w-0 rounded-sm border-[1.5px] border-line-strong bg-backdrop-vignette text-center font-display text-[1.5rem] font-bold text-ink tabular-nums focus:border-accent aria-invalid:border-danger disabled:opacity-60"
        />
      ))}
    </div>
  );
}
