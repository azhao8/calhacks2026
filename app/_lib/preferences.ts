// The S05 questions and how answers map to savePreferences (CLAUDE.md §5 S05).

export type Gender = "woman" | "man" | "non_binary";
export type MeetWho = "anyone" | Gender[];

export const BUDGETS = [
  { id: "free", label: "Free only", max: 0 },
  { id: "15", label: "Up to $15", max: 15 },
  { id: "25", label: "Up to $25", max: 25 },
  { id: "50", label: "Up to $50", max: 50 },
  { id: "any", label: "Any price", max: null },
] as const;

export type BudgetId = (typeof BUDGETS)[number]["id"];

export function budgetMax(id: BudgetId): number | null {
  return BUDGETS.find((b) => b.id === id)!.max;
}

// The saved maximum back to a choice. A value that isn't one of the choices picks the largest
// choice under it, so nothing shown is more than the student agreed to.
export function budgetIdFor(max: number | null): BudgetId {
  if (max === null) return "any";
  const fits = BUDGETS.filter((b) => b.max !== null && b.max <= max);
  return fits.length > 0 ? fits[fits.length - 1].id : "free";
}

export const MEET_OPTIONS = [
  { id: "anyone", label: "Anyone" },
  { id: "woman", label: "Women" },
  { id: "man", label: "Men" },
  { id: "non_binary", label: "Other" },
] as const;

export const SELF_OPTIONS = [
  { id: "woman", label: "Woman" },
  { id: "man", label: "Man" },
  { id: "non_binary", label: "Other" },
  { id: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export type GenderSelf = (typeof SELF_OPTIONS)[number]["id"];

export const YEAR_OPTIONS = [
  { id: "first", label: "1st" },
  { id: "second", label: "2nd" },
  { id: "third", label: "3rd" },
  { id: "fourth_plus", label: "4th+" },
  { id: "grad", label: "Grad" },
] as const;

export type Year = (typeof YEAR_OPTIONS)[number]["id"];

export const AREA_OPTIONS = [
  { id: "campus", label: "Campus" },
  { id: "berkeley_oakland", label: "Berkeley and Oakland" },
  { id: "bart", label: "Anywhere BART goes" },
] as const;

export type Area = (typeof AREA_OPTIONS)[number]["id"];

// "Anyone" stands alone; picking a specific group clears it, and clearing every group leaves no answer.
export function toggleMeetWho(current: MeetWho | null, id: "anyone" | Gender): MeetWho | null {
  if (id === "anyone") return current === "anyone" ? null : "anyone";
  const list = current === null || current === "anyone" ? [] : current;
  const next = list.includes(id) ? list.filter((g) => g !== id) : [...list, id];
  return next.length === 0 ? null : next;
}

export function meetWhoSelection(value: MeetWho | null): string[] {
  if (value === null) return [];
  return value === "anyone" ? ["anyone"] : value;
}

export function toggleSingle<T extends string>(current: T | null, id: T): T | null {
  return current === id ? null : id;
}
