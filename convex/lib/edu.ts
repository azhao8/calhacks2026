// Sign-up is open to any address whose domain ends in .edu, subdomains included (CLAUDE.md S03).

const EDU_EMAIL = /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+edu$/;
// Printable ASCII only, so no Unicode lookalike can pass the check and then reach a different inbox.
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;

// Normalize before validating, and store and send to exactly this form.
export function normalizeEmail(email: string): string {
  return email.normalize("NFKC").trim().toLowerCase();
}

export function isEduEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return PRINTABLE_ASCII.test(normalized) && EDU_EMAIL.test(normalized);
}

export function emailDomain(email: string): string {
  return normalizeEmail(email).split("@")[1] ?? "";
}
