import { isEduEmail, normalizeEmail } from "../../convex/lib/edu";

// Client checks that mirror the server's, so mistakes show before a round trip. The server
// still decides (CLAUDE.md §8.8).

export type Checked = { ok: true; value: string } | { ok: false; error: string };

export const EDU_REFUSED = "Melos is only open to students with a .edu email right now.";

export function checkSchoolEmail(raw: string): Checked {
  const value = normalizeEmail(raw);
  if (value.length === 0) return { ok: false, error: "Enter your school email." };
  if (!value.includes("@")) return { ok: false, error: "That doesn't look like an email address." };
  if (!isEduEmail(value)) return { ok: false, error: EDU_REFUSED };
  return { ok: true, value };
}

export function checkEmail(raw: string): Checked {
  const value = normalizeEmail(raw);
  if (value.length === 0) return { ok: false, error: "Enter the email your Spotify account uses." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { ok: false, error: "That doesn't look like an email address." };
  return { ok: true, value };
}

export function checkFirstName(raw: string): Checked {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length === 0) return { ok: false, error: "Enter your first name." };
  if (value.length > 40) return { ok: false, error: "Keep it to 40 characters." };
  if (/[@\d]/.test(value)) return { ok: false, error: "Use just your first name, without numbers." };
  return { ok: true, value };
}

// Keeps only digits, at most six, so paste and autofill both work.
export function codeDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

// A US number (10 digits, optional leading 1) or an international one starting with +.
// Returned in E.164 form. We check the format only; we never claim a number is verified.
export function checkPhone(raw: string): Checked {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, error: "Enter your phone number." };
  if (/[^\d\s()+.\-]/.test(trimmed)) return { ok: false, error: "Use only digits, spaces and a leading +." };
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (digits.length < 8 || digits.length > 15) return { ok: false, error: "That number looks too short or too long." };
    return { ok: true, value: `+${digits}` };
  }
  if (digits.length === 10) return { ok: true, value: `+1${digits}` };
  if (digits.length === 11 && digits.startsWith("1")) return { ok: true, value: `+${digits}` };
  return { ok: false, error: "Enter a 10 digit US number, or start with + and your country code." };
}

// "+15105550123" → "(510) 555-0123"; other numbers show as stored.
export function formatPhone(value: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(value);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : value;
}

// Instagram handles: 1 to 30 letters, numbers, periods and underscores; no leading, trailing or
// double period. Stored without the @, lowercase.
export function checkInstagram(raw: string): Checked {
  const value = raw.trim().replace(/^@/, "").toLowerCase();
  if (value.length === 0) return { ok: false, error: "Enter your Instagram handle." };
  if (value.length > 30) return { ok: false, error: "Instagram handles are 30 characters at most." };
  if (!/^[a-z0-9._]+$/.test(value)) return { ok: false, error: "Use only letters, numbers, periods and underscores." };
  if (value.startsWith(".") || value.endsWith(".") || value.includes(".."))
    return { ok: false, error: "That doesn't look like an Instagram handle." };
  return { ok: true, value };
}

export function instagramDisplay(value: string): string {
  return value.startsWith("@") ? value : `@${value}`;
}

export function checkNote(raw: string, max: number, emptyError: string): Checked {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, error: emptyError };
  if (value.length > max) return { ok: false, error: `Keep it under ${max} characters.` };
  return { ok: true, value };
}
