// Structured logger that never accepts free-form PII (CLAUDE.md §4, SEC-03).
// Only event names, ids and error codes are allowed through.
type Safe = string | number | boolean | null | undefined;

export function logEvent(event: string, fields: Record<string, Safe> = {}) {
  if (process.env.NODE_ENV === "test" && !process.env.LOG_IN_TESTS) return;
  console.info(JSON.stringify({ t: new Date().toISOString(), event, ...fields }));
}

export function logError(event: string, err: unknown, fields: Record<string, Safe> = {}) {
  // Messages from drivers can echo user input (e.g. unique-constraint values), so log name/code only.
  const e = err as { name?: string; code?: string };
  console.error(JSON.stringify({ t: new Date().toISOString(), event, error: e?.name ?? "Error", code: e?.code ?? null, ...fields }));
}
