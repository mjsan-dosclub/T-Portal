import { NextResponse, type NextRequest } from "next/server";

// Proxy (Next 16's renamed middleware; see node_modules/next/dist/docs/.../proxy.md).
// 1) Security headers + nonce CSP on every page (SEC-07).
// 2) Cheap redirect to /login when there's no session cookie. Real authorisation is
//    always repeated on the server (requirePageAdmin / withAuth). This is only UX.

const PUBLIC_PATHS = ["/login", "/login/totp", "/login/recovery", "/enrol-2fa", "/how-it-works"];
// Phase 2 student pages that work before sign-in (PH2-5).
const STUDENT_PUBLIC = ["/student/login", "/student/activate", "/student/forgot", "/student/totp", "/student/recovery", "/student/enrol"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api")) {
    const isStudentArea = pathname === "/student" || pathname.startsWith("/student/");
    if (isStudentArea) {
      if (!STUDENT_PUBLIC.includes(pathname) && !request.cookies.has("dos_student_session")) {
        return withSecurityHeaders(NextResponse.redirect(new URL("/student/login", request.url)), null);
      }
    } else if (!PUBLIC_PATHS.includes(pathname) && !request.cookies.has("dos_session")) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/login", request.url)), null);
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the nonce from the request's CSP header and applies it to its own scripts.
  requestHeaders.set("Content-Security-Policy", buildCsp(nonce));
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  return withSecurityHeaders(res, nonce);
}

function buildCsp(nonce: string | null) {
  const isDev = process.env.NODE_ENV === "development";
  const https = (process.env.APP_ORIGIN ?? "").startsWith("https://");
  return [
    "default-src 'self'",
    nonce ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}` : "script-src 'self'",
    // style attributes (React style={}) need 'unsafe-inline'; scripts stay nonce-locked.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function withSecurityHeaders(res: NextResponse, nonce: string | null) {
  const https = (process.env.APP_ORIGIN ?? "").startsWith("https://");
  const csp = buildCsp(nonce);
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (https) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  return res;
}

export const config = {
  matcher: [
    {
      // Static files in public/ (brand/, help/ screenshots) need no session or CSP nonce.
      source: "/((?!_next/static|_next/image|favicon.ico|brand/|help/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
