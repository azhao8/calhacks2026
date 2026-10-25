import type { RevealStep } from "./drops";

// What each reveal step says. Only shared taste and the partner's first name; never a pronoun.
export function revealLine(step: RevealStep): { line: string; detail: string | null } {
  switch (step.kind) {
    case "going":
      return { line: "Someone's going with you.", detail: null };
    case "artist":
    case "label":
      return { line: `You both love ${step.name}.`, detail: null };
    case "song":
      return { line: `You both have ${step.title} on repeat.`, detail: step.artist };
    case "name":
      return { line: `Meet ${step.firstName}.`, detail: null };
  }
}

// "2 of 4" for the step counter.
export const revealProgress = (opened: number, total: number) => `${opened} of ${total}`;
