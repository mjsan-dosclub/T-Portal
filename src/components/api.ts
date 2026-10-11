"use client";

export const UNAUTHORIZED_EVENT = "dos:unauthorized";

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string; fields?: Record<string, string>; data: Record<string, unknown> };

/** Same-origin JSON fetch. 401 → back to sign-in. Never puts PII in the URL; send it in the body. */
export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? (init.body !== undefined || init.form ? "POST" : "GET"),
      headers: init.form ? undefined : init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      credentials: "same-origin",
      signal: init.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return { ok: false, status: 0, error: "Network error. Check your connection and try again.", data: {} };
  }
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await res.json().catch(() => ({})) : {};
  if (res.status === 401 && !url.startsWith("/api/auth/")) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)); // AuthWatcher (app layout) sends the user to /login
  }
  if (!res.ok) {
    const d = data as { error?: string; fields?: Record<string, string> };
    return { ok: false, status: res.status, error: d.error ?? `Request failed (${res.status})`, fields: d.fields, data: data as Record<string, unknown> };
  }
  return { ok: true, status: res.status, data: data as T };
}

/** Download a file from a POST endpoint (keeps filters/PII out of URLs). */
export async function downloadPost(url: string, body: unknown, fallbackName: string): Promise<string | null> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    return d.error ?? `Download failed (${res.status})`;
  }
  saveBlob(await res.blob(), filenameFrom(res) ?? fallbackName);
  return null;
}

export async function downloadGet(url: string, fallbackName: string): Promise<string | null> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    return d.error ?? `Download failed (${res.status})`;
  }
  saveBlob(await res.blob(), filenameFrom(res) ?? fallbackName);
  return null;
}

function filenameFrom(res: Response) {
  return /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1];
}

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}
