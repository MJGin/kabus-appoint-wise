// When a staff session expires mid-task, the person should be able to sign in
// again and land back on the exact page they were working on (for example the
// Administrator's account setup), instead of being dumped on the dashboard.
//
// The path is kept in sessionStorage: it survives the round-trip through the
// sign-in page but never leaks to another tab, site or device, and it is wiped
// the moment it is used.

const KEY = "kabu-slotin-resume-path";

/** Only same-origin app paths are accepted, never external or protocol-relative URLs. */
function safePath(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/** Remember where to come back to after the next successful sign-in. */
export function storeResumePath(path: string): void {
  const safe = safePath(path);
  if (!safe) return;
  try {
    sessionStorage.setItem(KEY, safe);
  } catch {
    /* storage unavailable (private mode) — resume silently becomes unavailable */
  }
}

/** Read and clear the remembered path. Returns null when there is nothing to resume. */
export function takeResumePath(): string | null {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return value ? safePath(value) : null;
  } catch {
    return null;
  }
}
