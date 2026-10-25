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

// How each step fills its own screen in the full screen reveal: an optional small lead, the big
// line, and an optional small tail. Shared artists, genres and songs are set in capitals.
export type RevealScreen = { lead: string | null; big: string; tail: string | null; caps: boolean };

export function revealScreen(step: RevealStep): RevealScreen {
  switch (step.kind) {
    case "going":
      return { lead: null, big: "Someone's going with you.", tail: null, caps: false };
    case "artist":
    case "label":
      return { lead: "You both love", big: step.name, tail: null, caps: true };
    case "song":
      return { lead: "You both have", big: step.title, tail: "on repeat", caps: true };
    case "name":
      return { lead: null, big: `Meet ${step.firstName}`, tail: null, caps: false };
  }
}

// "2 of 4" for the step counter.
export const revealProgress = (opened: number, total: number) => `${opened} of ${total}`;
