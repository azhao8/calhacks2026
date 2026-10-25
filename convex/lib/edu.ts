// Sign-up is open to any address whose domain ends in .edu, subdomains included (CLAUDE.md S03).

const EDU_EMAIL = /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+edu$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEduEmail(email: string): boolean {
  return EDU_EMAIL.test(normalizeEmail(email));
}

export function emailDomain(email: string): string {
  return normalizeEmail(email).split("@")[1] ?? "";
}
