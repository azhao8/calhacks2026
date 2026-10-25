// What we keep on the device. The school picked in S02 stays here until sign-in (CLAUDE.md §5 S02);
// the rest are per-device conveniences. Storage can be missing or blocked, so every call is guarded.

export type DeviceSchool = { id: string; themeId: string };

const SCHOOL_KEY = "melos.school";
const SCHOOL_EVENT = "melos:school";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

export function parseDeviceSchool(raw: string | null): DeviceSchool | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && "id" in value && "themeId" in value) {
      const { id, themeId } = value as Record<string, unknown>;
      if (typeof id === "string" && typeof themeId === "string") return { id, themeId };
    }
  } catch {
    // Ignore anything we didn't write.
  }
  return null;
}

export function getDeviceSchool(): DeviceSchool | null {
  return parseDeviceSchool(read(SCHOOL_KEY));
}

export function setDeviceSchool(school: DeviceSchool | null): void {
  write(SCHOOL_KEY, school === null ? null : JSON.stringify(school));
  window.dispatchEvent(new Event(SCHOOL_EVENT));
}

export function subscribeDeviceSchool(onChange: () => void): () => void {
  window.addEventListener(SCHOOL_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SCHOOL_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getFlag(key: string): boolean {
  return read(`melos.flag.${key}`) === "1";
}

export function setFlag(key: string): void {
  write(`melos.flag.${key}`, "1");
}
