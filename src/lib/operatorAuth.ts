// Operator password gate (see docs/FRAT-HOUSE-RUNTIME-PLAN.md §6). Everything
// is protected except published client sites and what they need to work.

const PUBLIC_PREFIXES = ["/s/", "/api/public/", "/api/cron/", "/_next/"];
const PUBLIC_EXACT = new Set(["/privacy", "/terms", "/robots.txt", "/icon.svg", "/favicon.ico"]);
const OPERATOR_ROOTS = ["/api/", "/builder", "/leads", "/outreach", "/pipeline", "/stats", "/house", "/villa"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  // Static files from public/ (have an extension) — unless under an operator route.
  const isFile = /\.[a-z0-9]+$/i.test(pathname);
  return isFile && !OPERATOR_ROOTS.some((r) => pathname.startsWith(r));
}

/** Constant-time string comparison (length leak only). */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export type AuthResult = "ok" | "unauthorized" | "unconfigured";

/** Checks an `Authorization: Basic …` header. Any username; password must match. */
export function checkBasicAuth(header: string | null, password: string | undefined): AuthResult {
  if (!password) return "unconfigured";
  if (!header?.startsWith("Basic ")) return "unauthorized";

  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return "unauthorized";
  }
  const colon = decoded.indexOf(":");
  if (colon === -1) return "unauthorized";

  return safeEqual(decoded.slice(colon + 1), password) ? "ok" : "unauthorized";
}
